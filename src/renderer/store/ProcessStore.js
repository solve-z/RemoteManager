/**
 * ProcessStore - 프로세스 상태 관리 스토어
 * 단일 진실의 원천으로 모든 프로세스 데이터를 중앙 집중 관리
 */

import { KeyManager } from '../services/KeyManager.js';

/**
 * 프로세스 스토어 클래스
 */
export class ProcessStore {
  constructor() {
    this.processes = new Map(); // id -> RemoteProcess
    this.processHistory = new Map(); // matchingKey -> HistoryEntry
    this.listeners = new Set();
    this.groupStore = null;
  }

  /**
   * 그룹 스토어 설정
   * @param {GroupStore} groupStore - 그룹 스토어 인스턴스
   */
  setGroupStore(groupStore) {
    this.groupStore = groupStore;
  }

  /**
   * 프로세스 추가/업데이트
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 추가/업데이트된 프로세스
   */
  updateProcess(processInfo) {
    const matchingKey = KeyManager.getMatchingKey(processInfo);
    const existingHistory = this.processHistory.get(matchingKey);

    if (existingHistory) {
      // 기존 프로세스 재연결
      return this.handleReconnection(existingHistory, processInfo);
    } else {
      // 새 프로세스 추가
      return this.addNewProcess(processInfo);
    }
  }

  /**
   * 새 프로세스 추가
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 새로 추가된 프로세스
   */
  addNewProcess(processInfo) {
    const processId = KeyManager.generateProcessId();
    const matchingKey = KeyManager.getMatchingKey(processInfo);

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
      category: null,
      groupId: null,
    };

    // 프로세스 맵에 추가
    this.processes.set(processId, process);

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
      // 그룹에서도 제거
      if (process.groupId && this.groupStore) {
        this.groupStore.unassignProcessFromGroup(processId);
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
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let hasChanges = false;

    for (const [id, process] of this.processes) {
      // 그룹에 속하지 않고, 5분 이상 끊어진 프로세스만 삭제
      if (!process.groupId && 
          process.status === 'disconnected' && 
          process.disconnectedAt && 
          process.disconnectedAt.getTime() < fiveMinutesAgo) {
        
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