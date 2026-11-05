/**
 * LogService - 원격 프로세스 접속 기록(히스토리) 관리 서비스
 * 최근 30일간의 원격 접속 및 종료 시간, 유지 시간을 보관
 */

export class LogService {
  constructor() {
    this.storageKey = 'remotemanager_connection_logs';
    this.logs = [];
    this.activeSessions = new Map(); // processId/uniqueKey -> logId
    this.listeners = new Set();
    this.initialize();
  }

  /**
   * 초기화: 기존 로그 로드 및 30일 초과 로그 자동 정리
   */
  initialize() {
    this.loadLogs();
    this.purgeOldLogs(30);
  }

  /**
   * 로컬 스토리지에서 로그 불러오기
   */
  loadLogs() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.logs = JSON.parse(data);
      } else {
        this.logs = [];
      }
    } catch (e) {
      console.error('로그 로드 실패:', e);
      this.logs = [];
    }
  }

  /**
   * 로컬 스토리지에 로그 저장
   */
  saveLogs() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
      this.notifyListeners();
    } catch (e) {
      console.error('로그 저장 실패:', e);
    }
  }

  /**
   * 30일 초과 로그 자동 삭제
   * @param {number} days - 보관 일수 (기본 30일)
   */
  purgeOldLogs(days = 30) {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => {
      const logTime = new Date(log.startTime).getTime();
      return logTime >= cutoffTime;
    });

    if (this.logs.length !== initialCount) {
      console.log(`🧹 오래된 접속 로그 정리 완료: ${initialCount - this.logs.length}개 삭제`);
      this.saveLogs();
    }
  }

  /**
   * 프로세스 목록 변화를 감지하여 접속 시작/종료 로그 기록
   * @param {Array} currentProcesses - 현재 감지된 프로세스 목록
   */
  trackProcessChanges(currentProcesses = []) {
    const currentMap = new Map();
    const now = new Date();

    // 1. 현재 프로세스들 식별
    currentProcesses.forEach(proc => {
      // 프로세스를 식별하는 고유 키 (PID + 프로세스타입 + IP/컴퓨터명)
      const sessionKey = `${proc.pid}_${proc.type}_${proc.ipAddress || proc.computerName || ''}`;
      currentMap.set(sessionKey, proc);

      // 이미 기록 중인 세션이 아니라면 새로 접속 시작 기록
      if (!this.activeSessions.has(sessionKey)) {
        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newLog = {
          id: logId,
          sessionKey: sessionKey,
          pid: proc.pid,
          processName: proc.processName || proc.type || '원격 프로세스',
          processType: proc.type || (proc.processName?.toLowerCase().includes('teamviewer') ? 'TeamViewer' : 'ezHelp'),
          computerName: proc.computerName || proc.windowTitle || '-',
          customLabel: proc.customLabel || '',
          ipAddress: proc.ipAddress || proc.externalIpAddress || '-',
          startTime: now.toISOString(),
          endTime: null,
          durationText: '연결 중',
          durationSeconds: 0,
        };

        this.logs.unshift(newLog); // 최신 로그를 앞에 추가
        this.activeSessions.set(sessionKey, logId);
        console.log('📝 새 원격 접속 감지 로그 생성:', newLog.computerName);
      }
    });

    // 2. 이전에 활성 상태였으나 지금은 사라진(종료된) 프로세스 탐색
    for (const [sessionKey, logId] of this.activeSessions.entries()) {
      if (!currentMap.has(sessionKey)) {
        // 프로세스 종료 감지
        const targetLog = this.logs.find(l => l.id === logId);
        if (targetLog && !targetLog.endTime) {
          targetLog.endTime = now.toISOString();
          const startMs = new Date(targetLog.startTime).getTime();
          const endMs = now.getTime();
          const diffSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
          targetLog.durationSeconds = diffSeconds;
          targetLog.durationText = this.formatDuration(diffSeconds);
          console.log(`📝 원격 세션 종료 기록: ${targetLog.computerName} (${targetLog.durationText})`);
        }
        this.activeSessions.delete(sessionKey);
      }
    }

    this.saveLogs();
  }

  /**
   * 초 단위 시간을 알기 쉬운 문자열로 변환
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}초`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}분 ${remainingSeconds > 0 ? remainingSeconds + '초' : ''}`.trim();
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  }

  /**
   * 로그 목록 조회
   * @param {Object} filter - 검색어 필터
   */
  getLogs(filter = {}) {
    let result = [...this.logs];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(log =>
        (log.computerName && log.computerName.toLowerCase().includes(q)) ||
        (log.customLabel && log.customLabel.toLowerCase().includes(q)) ||
        (log.ipAddress && log.ipAddress.toLowerCase().includes(q)) ||
        (log.processType && log.processType.toLowerCase().includes(q))
      );
    }
    return result;
  }

  /**
   * 전체 로그 비우기
   */
  clearAllLogs() {
    this.logs = [];
    this.activeSessions.clear();
    this.saveLogs();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.logs);
      } catch (e) {
        console.error('로그 리스너 에러:', e);
      }
    }
  }
}

