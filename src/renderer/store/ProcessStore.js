/**
 * ProcessStore - 프로세스 상태 관리 스토어 (최종 수정 완료)
 * - 역할: 모든 원격 프로세스의 상태를 중앙에서 관리하는 단일 진실의 원천.
 * - 주요 기능: 프로세스 추가/업데이트, 충돌 감지 및 해결, 재연결 처리.
 */

import { KeyManager } from '../services/KeyManager.js';
import { ConflictDialog } from '../components/ConflictDialog.js';

/**
 * 프로세스 스토어 클래스
 */
export class ProcessStore {
  constructor() {
    this.processes = new Map(); // id -> RemoteProcess
    this.processHistory = new Map(); // matchingKey -> HistoryEntry
    this.stableKeyMap = new Map(); // stableKey -> processId (충돌 해결용)
    this.userPreferences = new Map(); // stableKey -> preference ('same', 'different', 'always_new')
    this.listeners = new Set();
    this.groupStore = null;
    this.conflictDialog = new ConflictDialog();
    // ★★★ 핵심 수정: WindowHandle과 multipleId를 매핑하는 "기억 저장소" 추가
    this.handleToMultipleIdMap = new Map(); // windowHandle -> multipleId

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

    const userPref = this.userPreferences.get(stableKey);
    if (userPref === 'always_new') {
      return this.createNewProcessWithSuffix(processInfo, stableKey);
    }

    const comparison = KeyManager.compareProcessInfo(existingProcess, processInfo);
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

      const choice = await this.conflictDialog.showConflictDialog(comparison);
      return this.handleUserChoice(choice, existingProcess, processInfo, stableKey);
    }

    // 다이얼로그 표시 조건이 아니면, 일반 업데이트로 처리
    return this.updateExistingProcess(existingProcess, processInfo);
  }

  /**
   * 사용자 선택 처리
   */
  handleUserChoice(choice, existingProcess, newProcessInfo, stableKey) {
    switch (choice) {
      case 'same':
        return this.updateExistingProcess(existingProcess, newProcessInfo);

      case 'different':
        const originalStableKey = KeyManager.getStableIdentifier(existingProcess);
        const newSuffix = this.findNextSuffix(originalStableKey);
        const newUniqueKey = `${originalStableKey}_${newSuffix}`;

        const enhancedNewProcessInfo = { ...newProcessInfo, multipleId: newSuffix };
        const newProcess = this.addNewProcess(enhancedNewProcessInfo);
        this.stableKeyMap.set(newUniqueKey, newProcess.id);

        // ★★★ 핵심 수정: 어떤 WindowHandle이 #2인지 기억합니다.
        this.handleToMultipleIdMap.set(newProcess.windowHandle, newSuffix);

        existingProcess.conflictProtected = Date.now() + 15000;
        existingProcess.lastSeen = new Date();

        console.log('✨ 새 프로세스에 suffix 할당:', {
          processId: newProcess.id, newKey: newUniqueKey, suffix: newSuffix
        });

        this.notifyListeners();
        return newProcess;

      case 'always_new':
        this.userPreferences.set(stableKey, 'always_new');
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);

      default:
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
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
    this.notifyListeners();
  }

  cleanup() {
    this.listeners.clear();
    this.processes.clear();
    this.processHistory.clear();
  }
}