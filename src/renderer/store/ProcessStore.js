/**
 * ProcessStore - 프로세스 상태 관리 스토어
 * 단일 진실의 원천으로 모든 프로세스 데이터를 중앙 집중 관리
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
  }

  /**
   * 그룹 스토어 설정
   * @param {GroupStore} groupStore - 그룹 스토어 인스턴스
   */
  setGroupStore(groupStore) {
    this.groupStore = groupStore;
  }

  /**
   * 프로세스 추가/업데이트 (충돌 감지 포함)
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object|Promise<Object>} 추가/업데이트된 프로세스 (충돌 시 Promise)
   */
  async updateProcess(processInfo) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    const matchingKey = KeyManager.getMatchingKey(processInfo);
    
    // 1. 기존 프로세스 재연결 확인
    const existingHistory = this.processHistory.get(matchingKey);
    if (existingHistory) {
      return this.handleReconnection(existingHistory, processInfo);
    }

    // 2. 충돌 감지 및 처리
    const conflictResult = await this.handlePotentialConflict(stableKey, processInfo);
    if (conflictResult) {
      return conflictResult;
    }

    // 3. 새 프로세스 추가
    return this.addNewProcess(processInfo);
  }

  /**
   * 잠재적 충돌 처리
   * @param {string} stableKey - 안정적 식별자
   * @param {Object} processInfo - 새 프로세스 정보
   * @returns {Object|null} 기존 프로세스 또는 null
   */
  async handlePotentialConflict(stableKey, processInfo) {
    const existingProcessId = this.stableKeyMap.get(stableKey);
    if (!existingProcessId) {
      return null; // 충돌 없음
    }

    const existingProcess = this.processes.get(existingProcessId);
    if (!existingProcess) {
      // 맵에는 있지만 프로세스가 없음 (정리 필요)
      this.stableKeyMap.delete(stableKey);
      return null;
    }

    // 사용자 기본 설정 확인
    const userPref = this.userPreferences.get(stableKey);
    if (userPref === 'always_new') {
      return this.createNewProcessWithSuffix(processInfo, stableKey);
    }

    // IP 변경 감지
    const comparison = KeyManager.compareProcessInfo(existingProcess, processInfo);
    if (!comparison.ipChanged && !comparison.sameComputer) {
      return null; // 실제로는 다른 프로세스
    }

    if (comparison.ipChanged) {
      // IP가 변경된 경우 사용자 확인 필요
      const choice = await this.conflictDialog.showConflictDialog(comparison);
      return this.handleUserChoice(choice, existingProcess, processInfo, stableKey);
    }

    // 동일한 프로세스로 판단 (기존 프로세스 업데이트)
    return this.updateExistingProcess(existingProcess, processInfo);
  }

  /**
   * 사용자 선택 처리
   * @param {string} choice - 사용자 선택
   * @param {Object} existingProcess - 기존 프로세스
   * @param {Object} newProcessInfo - 새 프로세스 정보
   * @param {string} stableKey - 안정적 식별자
   * @returns {Object} 처리된 프로세스
   */
  handleUserChoice(choice, existingProcess, newProcessInfo, stableKey) {
    switch (choice) {
      case 'same':
        // 같은 컴퓨터 - 기존 프로세스 업데이트
        return this.updateExistingProcess(existingProcess, newProcessInfo);
      
      case 'different':
        // 다른 컴퓨터 - 새 프로세스 생성
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
      
      case 'always_new':
        // 항상 새로 등록 - 설정 저장 후 새 프로세스 생성
        this.userPreferences.set(stableKey, 'always_new');
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
      
      default:
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
    }
  }

  /**
   * 기존 프로세스 업데이트 (IP 변경 등)
   * @param {Object} existingProcess - 기존 프로세스
   * @param {Object} newProcessInfo - 새 프로세스 정보
   * @returns {Object} 업데이트된 프로세스
   */
  updateExistingProcess(existingProcess, newProcessInfo) {
    // 기존 프로세스 정보 업데이트
    existingProcess.pid = newProcessInfo.pid;
    existingProcess.windowTitle = newProcessInfo.windowTitle;
    existingProcess.windowHandle = newProcessInfo.windowHandle;
    existingProcess.ipAddress = newProcessInfo.ipAddress; // IP 업데이트
    existingProcess.status = 'connected';
    existingProcess.isMinimized = newProcessInfo.isMinimized || false;
    existingProcess.isHidden = newProcessInfo.isHidden || false;
    existingProcess.lastSeen = new Date();
    existingProcess.disconnectedAt = null;

    // 히스토리 업데이트
    const matchingKey = KeyManager.getMatchingKey(newProcessInfo);
    const historyEntry = this.processHistory.get(matchingKey);
    if (historyEntry) {
      historyEntry.currentPid = newProcessInfo.pid;
      historyEntry.status = 'connected';
      historyEntry.lastSeen = new Date();
      historyEntry.disconnectedTime = null;
    }

    this.notifyListeners();
    return existingProcess;
  }

  /**
   * 접미사를 붙여 새 프로세스 생성
   * @param {Object} processInfo - 프로세스 정보
   * @param {string} baseStableKey - 기본 안정적 식별자
   * @returns {Object} 새로 생성된 프로세스
   */
  createNewProcessWithSuffix(processInfo, baseStableKey) {
    // 고유한 stableKey 생성
    let suffix = 1;
    let uniqueStableKey = baseStableKey;
    while (this.stableKeyMap.has(uniqueStableKey)) {
      uniqueStableKey = `${baseStableKey}_${suffix}`;
      suffix++;
    }

    // 새 프로세스 생성
    const process = this.addNewProcess(processInfo);
    
    // 고유한 안정적 키로 맵핑
    this.stableKeyMap.set(uniqueStableKey, process.id);
    
    return process;
  }

  /**
   * 새 프로세스 추가
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 새로 추가된 프로세스
   */
  addNewProcess(processInfo) {
    const processId = KeyManager.generateProcessId();
    const matchingKey = KeyManager.getMatchingKey(processInfo);
    const stableKey = KeyManager.getStableIdentifier(processInfo);

    // 프로세스 생성 **전에** 저장된 그룹/카테고리 정보 확인
    let savedGroupId = null;
    let savedCategory = null;
    
    if (this.groupStore) {
      savedGroupId = this.groupStore.getGroupByStableKey(processInfo);
      savedCategory = this.groupStore.getCategoryByStableKey(processInfo);
      
      console.log('🎯 프로세스 생성 시 그룹 정보 미리 확인:', {
        processId: processId,
        stableKey: stableKey,
        computerName: processInfo.computerName,
        savedGroupId: savedGroupId,
        savedCategory: savedCategory,
        groupExists: savedGroupId ? this.groupStore.groups.has(savedGroupId) : false
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
      category: savedCategory, // 생성 시점에 바로 설정
      groupId: savedGroupId && this.groupStore?.groups.has(savedGroupId) ? savedGroupId : null, // 생성 시점에 바로 설정
    };

    // 프로세스 맵에 추가
    this.processes.set(processId, process);

    // 안정적 키 매핑 추가
    this.stableKeyMap.set(stableKey, processId);

    // 그룹이 할당된 경우 그룹의 processIds 배열에도 추가
    if (savedGroupId && this.groupStore?.groups.has(savedGroupId)) {
      const group = this.groupStore.groups.get(savedGroupId);
      if (!group.processIds.includes(processId)) {
        group.processIds.push(processId);
        console.log('✅ 프로세스 생성 시 그룹에 즉시 추가:', {
          groupName: group.name,
          processId: processId,
          groupProcessCount: group.processIds.length
        });
      }
    }

    // 히스토리에 추가
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

  /**
   * 기존 프로세스 재연결 처리
   * @param {Object} historyEntry - 히스토리 엔트리
   * @param {Object} processInfo - 새 프로세스 정보
   * @returns {Object} 업데이트된 프로세스
   */
  handleReconnection(historyEntry, processInfo) {
    const process = this.processes.get(historyEntry.processId);
    
    if (process) {
      // 기존 프로세스 업데이트
      process.pid = processInfo.pid;
      process.windowTitle = processInfo.windowTitle;
      process.windowHandle = processInfo.windowHandle;
      process.status = historyEntry.status === 'disconnected' ? 'reconnected' : 'connected';
      process.isMinimized = processInfo.isMinimized || false;
      process.isHidden = processInfo.isHidden || false;
      process.lastSeen = new Date();
      process.disconnectedAt = null;

      // 히스토리 업데이트
      historyEntry.currentPid = processInfo.pid;
      historyEntry.status = 'connected';
      historyEntry.lastSeen = new Date();
      historyEntry.disconnectedTime = null;

      this.notifyListeners();
      return process;
    }

    // 프로세스가 없으면 새로 생성
    return this.addNewProcess(processInfo);
  }

  /**
   * 프로세스를 연결 끊김 상태로 표시
   * @param {string} processId - 프로세스 ID
   */
  markAsDisconnected(processId) {
    const process = this.processes.get(processId);
    if (process && process.status !== 'disconnected') {
      process.status = 'disconnected';
      process.disconnectedAt = new Date();

      // 히스토리 업데이트
      const matchingKey = KeyManager.getMatchingKey(process);
      const historyEntry = this.processHistory.get(matchingKey);
      if (historyEntry) {
        historyEntry.status = 'disconnected';
        historyEntry.disconnectedTime = new Date();
      }

      this.notifyListeners();
    }
  }

  /**
   * 현재 프로세스 목록에 없는 프로세스들을 끊어진 상태로 표시
   * @param {Set} currentProcessIds - 현재 감지된 프로세스 ID 집합
   */
  markMissingAsDisconnected(currentProcessIds) {
    let hasChanges = false;

    for (const [id, process] of this.processes) {
      if (!currentProcessIds.has(id) && process.status === 'connected') {
        this.markAsDisconnected(id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  /**
   * 프로세스 제거
   * @param {string} processId - 프로세스 ID
   * @param {boolean} keepHistory - 히스토리 유지 여부 (기본: false)
   */
  removeProcess(processId, keepHistory = false) {
    const process = this.processes.get(processId);
    if (process) {
      // 그룹에서도 제거 (안정적 키 저장을 위해 processInfo 전달)
      if (process.groupId && this.groupStore) {
        this.groupStore.unassignProcessFromGroup(processId, process);
      }

      // 프로세스 제거
      this.processes.delete(processId);

      // 히스토리 처리
      if (!keepHistory) {
        const matchingKey = KeyManager.getMatchingKey(process);
        this.processHistory.delete(matchingKey);
      } else {
        // 히스토리는 유지하되 상태를 disconnected로 변경
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

  /**
   * 오래된 끊어진 프로세스 자동 정리
   */
  cleanupOldProcesses() {
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    let hasChanges = false;

    for (const [id, process] of this.processes) {
      // 그룹에 속하지 않고, 30초 이상 끊어진 프로세스만 삭제
      if (!process.groupId && 
          process.status === 'disconnected' && 
          process.disconnectedAt && 
          process.disconnectedAt.getTime() < thirtySecondsAgo) {
        
        // 히스토리는 유지하면서 프로세스만 제거 (재연결 시 복원 가능)
        this.removeProcess(id, true);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  /**
   * 프로세스 설정 업데이트
   * @param {string} processId - 프로세스 ID
   * @param {Object} updates - 업데이트할 설정
   */
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
   * 특정 프로세스 가져오기
   * @param {string} processId - 프로세스 ID
   * @returns {Object|null} 프로세스 객체
   */
  getProcess(processId) {
    return this.processes.get(processId) || null;
  }

  /**
   * 모든 프로세스 가져오기
   * @returns {Array} 프로세스 배열
   */
  getAllProcesses() {
    return Array.from(this.processes.values());
  }

  /**
   * 연결된 프로세스만 가져오기
   * @returns {Array} 연결된 프로세스 배열
   */
  getConnectedProcesses() {
    return this.getAllProcesses().filter(p => p.status === 'connected');
  }

  /**
   * 끊어진 프로세스만 가져오기
   * @returns {Array} 끊어진 프로세스 배열
   */
  getDisconnectedProcesses() {
    return this.getAllProcesses().filter(p => p.status === 'disconnected');
  }

  /**
   * 특정 그룹의 프로세스들 가져오기
   * @param {string} groupId - 그룹 ID
   * @returns {Array} 해당 그룹의 프로세스 배열
   */
  getProcessesByGroup(groupId) {
    return this.getAllProcesses().filter(p => p.groupId === groupId);
  }

  /**
   * 특정 카테고리의 프로세스들 가져오기
   * @param {string} category - 카테고리
   * @returns {Array} 해당 카테고리의 프로세스 배열
   */
  getProcessesByCategory(category) {
    return this.getAllProcesses().filter(p => p.category === category);
  }

  /**
   * 통계 정보 가져오기
   * @returns {Object} 통계 객체
   */
  getStatistics() {
    const processes = this.getAllProcesses();
    return {
      total: processes.length,
      connected: processes.filter(p => p.status === 'connected').length,
      disconnected: processes.filter(p => p.status === 'disconnected').length,
      ezhelp: processes.filter(p => p.type === 'ezhelp').length,
      teamviewer: processes.filter(p => p.type === 'teamviewer').length,
      grouped: processes.filter(p => p.groupId).length,
      ungrouped: processes.filter(p => !p.groupId).length,
    };
  }

  /**
   * 리스너 등록
   * @param {Function} listener - 상태 변경 리스너
   * @returns {Function} 언구독 함수
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 모든 리스너에게 변경 알림
   */
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

  /**
   * 스토어 초기화
   */
  clear() {
    this.processes.clear();
    this.processHistory.clear();
    this.notifyListeners();
  }

  /**
   * 스토어 정리
   */
  cleanup() {
    this.listeners.clear();
    this.processes.clear();
    this.processHistory.clear();
  }
}