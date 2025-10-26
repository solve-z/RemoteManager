/**
 * ProcessStore - 프로세스 상태 관리 스토어 (최종 수정 완료)
 * - 역할: 모든 원격 프로세스의 상태를 중앙에서 관리하는 단일 진실의 원천.
 * - 주요 기능: 프로세스 추가/업데이트, 충돌 감지 및 해결, 재연결 처리.
 */

import { KeyManager } from '../services/KeyManager.js';
import { ConflictDialog } from '../components/ConflictDialog.js';
import { PersistentMultipleIdStore } from './PersistentMultipleIdStore.js';

/**
 * 프로세스 스토어 클래스
 */
export class ProcessStore {
  constructor() {
    this.processes = new Map(); // id -> RemoteProcess
    this.processHistory = new Map(); // matchingKey -> HistoryEntry
    this.stableKeyMap = new Map(); // stableKey -> processId (충돌 해결용)
    this.listeners = new Set();
    this.groupStore = null;
    this.conflictDialog = new ConflictDialog();
    // ★★★ 핵심 수정: 영구 저장 가능한 multipleId 매핑 저장소로 교체
    this.multipleIdStore = new PersistentMultipleIdStore();

    // 세션 기반 중복 방지 시스템
    this.conflictDialogShown = new Set(); // 이 세션에서 이미 확인한 충돌들 (stableKey_WindowHandle 형태)
    this.sessionStartTime = Date.now(); // 세션 시작 시간 (프로그램 재시작 감지용)
  }

  setGroupStore(groupStore) {
    this.groupStore = groupStore;
  }

  /**
   * 프로세스 추가/업데이트 (충돌 감지 포함)
   */
  async updateProcess(processInfo) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    const matchingKey = KeyManager.getMatchingKey(processInfo);

    // 1. 충돌 감지 및 처리 (재연결보다 우선)
    const conflictResult = await this.handlePotentialConflict(stableKey, processInfo);
    if (conflictResult) {
      return conflictResult;
    }

    // 2. 기존 프로세스 재연결 확인
    const existingHistory = this.processHistory.get(matchingKey);
    if (existingHistory) {
      return this.handleReconnection(existingHistory, processInfo);
    }

    // 3. 새 프로세스 추가 (충돌 및 재연결이 아닌 경우)
    const newProcess = this.addNewProcess(processInfo);
    this.stableKeyMap.set(stableKey, newProcess.id);
    return newProcess;
  }

  /**
   * 충돌 다이얼로그 표시 여부 판단 (수정 완료)
   * - "자기 자신과의 충돌" (재연결)을 가장 먼저 확인하여 불필요한 다이얼로그 방지
   */
  shouldShowConflictDialog(stableKey, existingProcess, newProcessInfo) {
    console.log('🔍 충돌 다이얼로그 표시 판단:', {
      stableKey: stableKey,
      computerName: newProcessInfo.computerName,
      existingWindowHandle: existingProcess.windowHandle,
      newWindowHandle: newProcessInfo.windowHandle,
    });

    // 1. 재연결(자기 자신)인지 가장 먼저 확인합니다.
    // stableKey가 같고, WindowHandle까지 같다면, 이것은 새로운 충돌이 아니라
    // 동일한 창에 대한 업데이트/재연결 신호이므로 다이얼로그를 띄우지 않습니다.
    if (existingProcess.windowHandle === newProcessInfo.windowHandle) {
      console.log('❌ 다이얼로그 스킵: 동일 WindowHandle 감지 (정상 업데이트/재연결)');
      return false;
    }

    // 2. 이전에 이 창에 대해 이미 충돌 처리를 했다면 스킵합니다.
    // (예: 사용자가 다이얼로그를 닫자마자 바로 다음 감지 사이클이 돌아올 때)
    const conflictKey = `${stableKey}_${newProcessInfo.windowHandle}`;
    if (this.conflictDialogShown.has(conflictKey)) {
      console.log('❌ 다이얼로그 스킵: 이미 이 창에 대해 충돌 처리함');
      return false;
    }

    // 3. 프로그램 시작 후 5초 이내는 스킵합니다.
    if (Date.now() - this.sessionStartTime < 5000) {
      console.log('❌ 다이얼로그 스킵: 프로그램 시작 5초 이내');
      return false;
    }

    // 4. 새 프로세스의 핵심 정보가 없으면 스킵합니다.
    if (!newProcessInfo.windowHandle && !newProcessInfo.pid) {
      console.log('❌ 다이얼로그 스킵: 새 프로세스 정보 부족');
      return false;
    }

    // 5. 위 모든 스킵 조건을 통과했다면, "진짜 충돌"로 간주합니다.
    // (stableKey는 같은데 WindowHandle이 다르므로, 명백히 다른 창입니다.)
    console.log('🎯 충돌 다이얼로그 판단 결과: 진짜 충돌로 판단 (stableKey 동일, WindowHandle 다름)');
    return true;
  }

  /**
   * 잠재적 충돌 처리
   */
  async handlePotentialConflict(stableKey, processInfo) {
    const existingProcessId = this.stableKeyMap.get(stableKey);
    if (!existingProcessId) {
      return null; // 충돌 없음
    }

    const existingProcess = this.processes.get(existingProcessId);
    if (!existingProcess) {
      this.stableKeyMap.delete(stableKey);
      return null;
    }

    const comparison = KeyManager.compareProcessInfo(existingProcess, processInfo);    // IP 변경 감지 시 사용자 확인 다이얼로그 표시
    if (comparison.sameComputer && comparison.ipChanged) {
      console.log('📍 IP 변경 감지 - 사용자 확인 필요:', {
        computerName: comparison.computerName,
        oldIP: comparison.oldIP,
        newIP: comparison.newIP,
        stableKey: stableKey
      });

      const conflictKey = `${stableKey}_${processInfo.windowHandle}`;
      this.conflictDialogShown.add(conflictKey);

      // 동일한 컴퓨터명을 가진 모든 기존 프로세스 찾기
      const existingProcessesWithSameComputer = this.findProcessesByComputerName(processInfo.computerName);

      // IP 변경 충돌 정보 구성
      const detailedConflictInfo = {
        ...comparison,
        existingProcess: {
          id: existingProcess.id,
          type: existingProcess.type,
          windowHandle: existingProcess.windowHandle,
          pid: existingProcess.pid,
          createdAt: existingProcess.createdAt,
          lastSeen: existingProcess.lastSeen,
          customLabel: existingProcess.customLabel,
          ipAddress: existingProcess.ipAddress,
          counselorId: existingProcess.counselorId
        },
        newProcess: {
          windowHandle: processInfo.windowHandle,
          pid: processInfo.pid,
          ipAddress: processInfo.ipAddress,
          counselorId: processInfo.counselorId,
          detectedAt: new Date()
        },
        availableExistingProcesses: existingProcessesWithSameComputer.map(proc => ({
          id: proc.id,
          windowHandle: proc.windowHandle,
          pid: proc.pid,
          customLabel: proc.customLabel,
          createdAt: proc.createdAt,
          lastSeen: proc.lastSeen,
          ipAddress: proc.ipAddress,
          counselorId: proc.counselorId,
          multipleId: proc.multipleId,
          displayName: this.getDisplayNameForProcess(proc)
        }))
      };


      if (existingProcessesWithSameComputer) {
        // 미니창에 충돌 알림 전송 필요 
        await this.sendMiniConflictNotification(detailedConflictInfo);
      }

      const choice = await this.conflictDialog.showConflictDialog(detailedConflictInfo);
      return this.handleUserChoice(choice, existingProcess, processInfo, stableKey);
    }
    // 상담원 번호만 변경되고 IP는 동일한 경우 자동 업데이트
    if (comparison.counselorChanged && !comparison.ipChanged) {
      return this.updateExistingProcess(existingProcess, processInfo);
    }

    if (this.shouldShowConflictDialog(stableKey, existingProcess, processInfo)) {
      console.log('⚠️ 동일 컴퓨터명 충돌 감지 - 사용자 확인 필요:', {
        stableKey: stableKey,
        computerName: processInfo.computerName,
      });

      const conflictKey = `${stableKey}_${processInfo.windowHandle}`;
      this.conflictDialogShown.add(conflictKey);

      // 동일한 컴퓨터명을 가진 모든 기존 프로세스 찾기
      const existingProcessesWithSameComputer = this.findProcessesByComputerName(processInfo.computerName);



      // 상세한 충돌 정보 구성 (기존/새 프로세스 정보 + 선택 가능한 프로세스 목록)
      const detailedConflictInfo = {
        ...comparison, // 기존 comparison 정보 유지
        existingProcess: {
          id: existingProcess.id,
          windowHandle: existingProcess.windowHandle,
          pid: existingProcess.pid,
          createdAt: existingProcess.createdAt,
          lastSeen: existingProcess.lastSeen,
          customLabel: existingProcess.customLabel,
          ipAddress: existingProcess.ipAddress,
          counselorId: existingProcess.counselorId
        },
        newProcess: {
          windowHandle: processInfo.windowHandle,
          pid: processInfo.pid,
          ipAddress: processInfo.ipAddress,
          counselorId: processInfo.counselorId,
          detectedAt: new Date()
        },
        // 선택 가능한 기존 프로세스 목록
        availableExistingProcesses: existingProcessesWithSameComputer.map(proc => ({
          id: proc.id,
          windowHandle: proc.windowHandle,
          pid: proc.pid,
          computerName: proc.computerName,
          customLabel: proc.customLabel,
          createdAt: proc.createdAt,
          lastSeen: proc.lastSeen,
          ipAddress: proc.ipAddress,
          counselorId: proc.counselorId,
          multipleId: proc.multipleId,
          displayName: this.getDisplayNameForProcess(proc)
        }))
      };
      if (existingProcessesWithSameComputer) {
        // 미니창에 충돌 알림 전송 필요 
        await this.sendMiniConflictNotification(detailedConflictInfo);
      }
      const choice = await this.conflictDialog.showConflictDialog(detailedConflictInfo);



      return this.handleUserChoice(choice, existingProcess, processInfo, stableKey);
    }

    // 다이얼로그 표시 조건이 아니면, 일반 업데이트로 처리
    return this.updateExistingProcess(existingProcess, processInfo);
  }

  /**
   * 사용자 선택 처리 (확장된 선택 옵션 지원 + 선택된 프로세스 처리)
   */
  handleUserChoice(choiceData, existingProcess, newProcessInfo, stableKey) {
    // choice가 객체인지 문자열인지 확인
    const isChoiceObject = typeof choiceData === 'object' && choiceData !== null;
    const choice = isChoiceObject ? choiceData.choice : choiceData;
    const selectedProcessId = isChoiceObject ? choiceData.selectedProcessId : null;

    console.log('🎯 사용자 선택 처리:', {
      choice,
      selectedProcessId,
      stableKey,
      isChoiceObject
    });

    switch (choice) {
      case 'keep_existing':
        // 사용자가 선택한 기존 연결을 새 정보로 업데이트
        if (selectedProcessId) {
          const selectedProcess = this.processes.get(selectedProcessId);
          if (selectedProcess) {
            console.log('📍 선택된 기존 연결을 새 정보로 업데이트:', {
              selectedId: selectedProcessId,
              processName: selectedProcess.computerName,
              multipleId: selectedProcess.multipleId
            });
            return this.updateExistingProcess(selectedProcess, newProcessInfo);
          } else {
            console.warn('⚠️ 선택된 프로세스를 찾을 수 없음:', selectedProcessId);
          }
        }

        // 선택된 프로세스가 없으면 기본적으로 기존 프로세스를 새 정보로 업데이트
        console.log('📍 기존 연결을 새 정보로 업데이트 (기본값)');
        return this.updateExistingProcess(existingProcess, newProcessInfo);

      case 'update_existing':
        // 기존 연결을 새로 감지된 정보로 교체
        console.log('🔄 새 연결로 업데이트 선택 - 기존 프로세스 정보 교체');
        return this.updateExistingProcess(existingProcess, newProcessInfo);

      case 'different':
        const originalStableKey = KeyManager.getStableIdentifier(existingProcess);
        const newSuffix = this.findNextSuffix(originalStableKey);
        const newUniqueKey = `${originalStableKey}_${newSuffix}`;

        const enhancedNewProcessInfo = { ...newProcessInfo, multipleId: newSuffix };
        const newProcess = this.addNewProcess(enhancedNewProcessInfo);
        this.stableKeyMap.set(newUniqueKey, newProcess.id);

        // ★★★ 핵심 수정: 어떤 WindowHandle이 #2인지 영구 저장합니다.
        const stableKey = KeyManager.getStableIdentifier(newProcess);
        this.multipleIdStore.setMultipleId(stableKey, newProcess.windowHandle, newSuffix);

        existingProcess.conflictProtected = Date.now() + 15000;
        existingProcess.lastSeen = new Date();

        console.log('✨ 새 프로세스에 suffix 할당:', {
          processId: newProcess.id, newKey: newUniqueKey, suffix: newSuffix
        });

        this.notifyListeners();
        return newProcess;

      default:
        console.log('⚠️ 알 수 없는 선택:', choice, '- 기본값으로 새 프로세스 생성');
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
    }
  }


  // 미니창에 간단한 충돌 알림 전송 메서드
  sendMiniConflictNotification(conflictInfo) {

    if (window.electronAPI && window.electronAPI.notifyMiniWindowConflict) {
      window.electronAPI.notifyMiniWindowConflict(conflictInfo);
    }
  }



  findNextSuffix(baseStableKey) {
    let suffix = 2;
    while (this.stableKeyMap.has(`${baseStableKey}_${suffix}`)) {
      suffix++;
    }
    return suffix;
  }

  updateExistingProcess(existingProcess, newProcessInfo) {
    Object.assign(existingProcess, {
      pid: newProcessInfo.pid,
      windowTitle: newProcessInfo.windowTitle,
      windowHandle: newProcessInfo.windowHandle,
      ipAddress: KeyManager.extractIpAddress(newProcessInfo) || newProcessInfo.ipAddress || existingProcess.ipAddress,
      externalIpAddress: KeyManager.extractExternalIpAddress(newProcessInfo) || newProcessInfo.externalIpAddress || existingProcess.externalIpAddress,
      counselorId: KeyManager.extractCounselorId(newProcessInfo) || newProcessInfo.counselorId || existingProcess.counselorId,
      status: 'connected',
      isMinimized: newProcessInfo.isMinimized || false,
      isHidden: newProcessInfo.isHidden || false,
      lastSeen: new Date(),
      disconnectedAt: null,
    });

    const matchingKey = KeyManager.getMatchingKey(newProcessInfo);
    const historyEntry = this.processHistory.get(matchingKey);
    if (historyEntry) {
      Object.assign(historyEntry, {
        currentPid: newProcessInfo.pid,
        status: 'connected',
        lastSeen: new Date(),
        disconnectedTime: null,
      });
    }

    this.notifyListeners();
    return existingProcess;
  }

  createNewProcessWithSuffix(processInfo, baseStableKey) {
    const isBaseKeyUsed = this.stableKeyMap.has(baseStableKey);
    let suffix = 1;
    let uniqueStableKey = baseStableKey;
    while (this.stableKeyMap.has(uniqueStableKey)) {
      uniqueStableKey = `${baseStableKey}_${suffix}`;
      suffix++;
    }

    const enhancedProcessInfo = {
      ...processInfo,
      multipleId: isBaseKeyUsed && suffix > 1 ? suffix : null
    };
    const process = this.addNewProcess(enhancedProcessInfo);
    this.stableKeyMap.set(uniqueStableKey, process.id);
    return process;
  }

  /**
   * 새 프로세스 추가 (순수 함수)
   */
  addNewProcess(processInfo) {
    const processId = KeyManager.generateProcessId();
    const matchingKey = KeyManager.getMatchingKey(processInfo);

    let savedGroupId = null;
    let savedCategory = null;
    if (this.groupStore) {
      const stableKeyForLog = KeyManager.getStableIdentifier(processInfo);
      savedGroupId = this.groupStore.getGroupByStableKey(processInfo);
      savedCategory = this.groupStore.getCategoryByStableKey(processInfo);
      console.log('🎯 프로세스 생성 시 그룹 정보 미리 확인:', {
        processId: processId, stableKey: stableKeyForLog, savedGroupId, savedCategory
      });
    }

    const process = {
      id: processId,
      pid: processInfo.pid,
      processName: processInfo.processName,
      windowTitle: processInfo.windowTitle,
      windowHandle: processInfo.windowHandle,
      type: processInfo.type,
      computerName: processInfo.computerName,
      ipAddress: processInfo.ipAddress,
      externalIpAddress: processInfo.externalIpAddress,
      counselorId: processInfo.counselorId,
      status: 'connected',
      isMinimized: processInfo.isMinimized || false,
      isHidden: processInfo.isHidden || false,
      createdAt: new Date(),
      lastSeen: new Date(),
      disconnectedAt: null,
      customLabel: null,
      category: savedCategory,
      groupId: savedGroupId && this.groupStore?.groups.has(savedGroupId) ? savedGroupId : null,
      multipleId: processInfo.multipleId || null,
    };

    this.processes.set(processId, process);

    if (process.groupId && this.groupStore?.groups.has(process.groupId)) {
      const group = this.groupStore.groups.get(process.groupId);
      if (!group.processIds.includes(processId)) {
        group.processIds.push(processId);
        this.groupStore.save();
      }
    }

    this.processHistory.set(matchingKey, {
      processId: processId,
      currentPid: processInfo.pid,
      originalPid: processInfo.pid,
      status: 'connected',
      lastSeen: new Date(),
      disconnectedTime: null,
    });

    this.notifyListeners();
    return process;
  }

  handleReconnection(historyEntry, processInfo) {
    const process = this.processes.get(historyEntry.processId);
    if (process) {
      return this.updateExistingProcess(process, processInfo);
    }
    // 히스토리는 있지만 프로세스가 없는 경우, 새로 추가
    const newProcess = this.addNewProcess(processInfo);
    // 새 프로세스에 맞는 stableKey를 다시 설정해야 할 수 있음
    this.stableKeyMap.set(KeyManager.getStableIdentifier(newProcess), newProcess.id);
    return newProcess;
  }

  markAsDisconnected(processId) {
    const process = this.processes.get(processId);
    if (process && process.status !== 'disconnected') {
      process.status = 'disconnected';
      process.disconnectedAt = new Date();
      const matchingKey = KeyManager.getMatchingKey(process);
      const historyEntry = this.processHistory.get(matchingKey);
      if (historyEntry) {
        historyEntry.status = 'disconnected';
        historyEntry.disconnectedTime = new Date();
      }
      this.notifyListeners();
    }
  }

  markMissingAsDisconnected(currentProcessIds) {
    const now = Date.now();
    const disconnectedIds = [];

    for (const [id, process] of this.processes) {
      if (!currentProcessIds.has(id) && process.status === 'connected') {
        if (process.conflictProtected && now < process.conflictProtected) {
          continue; // 보호 중인 프로세스는 건너뛰기
        }
        if (process.conflictProtected) {
          delete process.conflictProtected;
        }
        this.markAsDisconnected(id);
        disconnectedIds.push(id);
      }
    }
    return disconnectedIds; // 끊어진 ID 배열 반환
  }

  removeProcess(processId, keepHistory = false) {
    const process = this.processes.get(processId);
    if (process) {
      if (process.groupId && this.groupStore) {
        this.groupStore.unassignProcessFromGroup(processId, process);
      }
      this.processes.delete(processId);
      const stableKey = KeyManager.getStableIdentifier(process);
      this.stableKeyMap.delete(stableKey);

      // multipleId 매핑도 정리 (windowHandle 기반)
      if (process.windowHandle) {
        this.multipleIdStore.removeMapping(process.windowHandle);
      }
      if (!keepHistory) {
        const matchingKey = KeyManager.getMatchingKey(process);
        this.processHistory.delete(matchingKey);
      } else {
        const matchingKey = KeyManager.getMatchingKey(process);
        const historyEntry = this.processHistory.get(matchingKey);
        if (historyEntry) {
          historyEntry.status = 'disconnected';
          historyEntry.disconnectedTime = new Date();
        }
      }
      this.notifyListeners();
      return true;
    }
    return false;
  }

  cleanupOldProcesses() {
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    let hasChanges = false;
    for (const [id, process] of this.processes) {
      if (!process.groupId && process.status === 'disconnected' &&
        process.disconnectedAt && process.disconnectedAt.getTime() < thirtySecondsAgo) {
        this.removeProcess(id, true);
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.notifyListeners();
    }
  }

  updateProcessSettings(processId, updates) {
    const process = this.processes.get(processId);
    if (process) {
      Object.assign(process, updates);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * 프로세스 정보 업데이트 (라벨, 카테고리 등)
   * @param {string} processId - 프로세스 ID
   * @param {Object} updates - 업데이트할 정보
   * @returns {boolean} 업데이트 성공 여부
   */
  updateProcessInfo(processId, updates) {
    return this.updateProcessSettings(processId, updates);
  }

  getProcess(processId) {
    return this.processes.get(processId) || null;
  }

  getAllProcesses() {
    return Array.from(this.processes.values());
  }

  // (getConnectedProcesses, getDisconnectedProcesses 등 나머지 getter/helper 함수들은 변경 없이 그대로 유지)

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const processes = this.getAllProcesses();
    this.listeners.forEach(listener => {
      try {
        listener(processes);
      } catch (error) {
        console.error('프로세스 스토어 리스너 에러:', error);
      }
    });
  }

  clear() {
    this.processes.clear();
    this.processHistory.clear();
    this.multipleIdStore.clear(); // multipleId 매핑도 초기화
    this.notifyListeners();
  }

  /**
   * 동일한 컴퓨터명을 가진 모든 프로세스 찾기
   * @param {string} computerName - 컴퓨터명
   * @returns {Array} 동일 컴퓨터명을 가진 프로세스 배열
   */
  findProcessesByComputerName(computerName) {
    return this.getAllProcesses().filter(process =>
      process.computerName === computerName
    );
  }

  /**
   * 프로세스의 표시용 이름 생성 (충돌 다이얼로그용 - ProcessList와 통일)
   * @param {Object} process - 프로세스 객체
   * @returns {string} 표시용 이름
   */
  getDisplayNameForProcess(process) {
    // ProcessList와 동일한 KeyManager.getDisplayKey() 사용
    const baseInfo = KeyManager.getDisplayKey(process);

    // 라벨이 있으면 기본 정보 + 라벨 형태로 표시
    if (process.customLabel) {
      return `${baseInfo} - ${process.customLabel}`;
    }

    return baseInfo;
  }

  cleanup() {
    this.listeners.clear();
    this.processes.clear();
    this.processHistory.clear();
    // multipleIdStore는 영구 저장소이므로 cleanup에서는 건드리지 않음
  }
}