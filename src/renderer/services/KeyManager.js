/**
 * KeyManager - 통합 키 관리 서비스
 * 모든 프로세스 식별과 설정 저장을 위한 단일 키 관리 시스템
 */

export class KeyManager {
  /**
   * 프로세스의 고유 ID 생성 (UUID 기반)
   * - 한 번 생성되면 변하지 않음
   * - 모든 설정의 키로 사용
   * @returns {string} 고유한 프로세스 ID
   */
  static generateProcessId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * 안정적 식별자 생성 (프로그램 재시작 후에도 유지) - 수정 완료
     * - 컴퓨터명 기반으로 고유성 확보
     * - 그룹/카테고리 정보 유지를 위한 핵심 키
     * - process.multipleId(suffix)까지 고려하여 다중 세션을 완벽하게 지원
     * @param {Object} process - 프로세스 정보
     * @returns {string} 안정적 식별자
     */
  static getStableIdentifier(process) {
    const type = this.detectProcessType(process);
    const computerName = this.extractComputerName(process);

    if (!computerName) {
      return `${type}_unknown_${process.pid || process.Id}`;
    }

    let baseIdentifier; // 기본 식별자 (suffix 제외)

    if (type === 'ezhelp') {
      const counselorId = this.extractCounselorId(process);
      const ipAddress = this.extractIpAddress(process);
      baseIdentifier = `ezhelp_${computerName}`;
      if (counselorId) {
        baseIdentifier += `_counselor${counselorId}`;
      } else if (ipAddress) {
        baseIdentifier += `_${ipAddress.replace(/\./g, '-')}`;
      }
    } else if (type === 'teamviewer') {
      baseIdentifier = `teamviewer_${computerName}`;
    } else {
      baseIdentifier = `${type}_${computerName}`;
    }

    if (process.multipleId) {
      return `${baseIdentifier}_${process.multipleId}`;
    }

    return baseIdentifier;
  }

  /**
   * 프로세스 매칭 키 생성 (재연결 감지용)
   * - 컴퓨터명 기반으로 동일한 원격지 인식
   * - ezHelp와 TeamViewer별로 다른 키 전략 사용
   * @param {Object} process - 프로세스 정보
   * @returns {string} 매칭 키
   */
  static getMatchingKey(process) {
    // 안정적 식별자를 매칭 키로 사용
    return this.getStableIdentifier(process);
  }

  /**
   * IP 변경 및 상담원 번호 변경 감지를 위한 프로세스 정보 비교
   * @param {Object} existingProcess - 기존 프로세스 정보
   * @param {Object} newProcess - 새로운 프로세스 정보
   * @returns {Object} 비교 결과 { sameComputer, ipChanged, counselorChanged, oldIP, newIP, oldCounselorId, newCounselorId }
   */
  static compareProcessInfo(existingProcess, newProcess) {
    const existingKey = this.getStableIdentifier(existingProcess);
    const newKey = this.getStableIdentifier(newProcess);
    const sameComputer = existingKey === newKey;

    const oldIP = existingProcess.ipAddress || this.extractIpAddress(existingProcess);
    const newIP = newProcess.ipAddress || this.extractIpAddress(newProcess);
    const ipChanged = oldIP && newIP && oldIP !== newIP;

    // 상담원 번호 변경 감지 (ezHelp의 경우)
    const oldCounselorId = existingProcess.counselorId || this.extractCounselorId(existingProcess);
    const newCounselorId = newProcess.counselorId || this.extractCounselorId(newProcess);
    const counselorChanged = oldCounselorId && newCounselorId && oldCounselorId !== newCounselorId;

    return {
      sameComputer,
      ipChanged,
      counselorChanged,
      oldIP,
      newIP,
      oldCounselorId,
      newCounselorId,
      computerName: this.extractComputerName(newProcess)
    };
  }

  /**
   * 설정 저장용 키 생성 (다중세션 지원)
   * - ezHelp: 컴퓨터명 기반 (단일세션)
   * - TeamViewer: 컴퓨터명 + WindowHandle/PID (다중세션)
   * @param {Object} process - 프로세스 정보
   * @returns {string} 설정 키
   */
  static getSettingsKey(process) {
    const type = process.type || this.detectProcessType(process);
    const computerName = process.computerName || this.extractComputerName(process);

    if (!computerName) {
      return `${type}_unknown_${process.pid}`;
    }

    if (type === 'ezhelp') {
      // ezHelp는 컴퓨터명만으로 설정 관리
      return `ezhelp_${computerName}`;
    } else if (type === 'teamviewer') {
      // TeamViewer는 다중세션을 위해 WindowHandle 또는 PID 추가
      const sessionId = process.windowHandle || process.pid;
      return `teamviewer_${computerName}_${sessionId}`;
    }

    return `${type}_${computerName}`;
  }

  /**
   * 디스플레이용 키 생성 (UI 표시용)
   * @param {Object} process - 프로세스 정보
   * @returns {string} 표시용 키
   */
  static getDisplayKey(process) {
    const type = process.type || this.detectProcessType(process);

    if (type === 'ezhelp') {
      const computerName = process.computerName || this.extractComputerName(process);
      const ipAddress = process.ipAddress || this.extractIpAddress(process);
      const counselorId = process.counselorId || this.extractCounselorId(process);
      const multipleId = process.multipleId;

      if (counselorId && computerName && ipAddress) {
        let display = `(${counselorId}) ${computerName}[${ipAddress}]`;
        // ezHelp에서도 suffix가 있으면 표시
        if (multipleId) {
          display += ` #${multipleId}`;
        }
        return display;
      } else if (computerName && ipAddress) {
        let display = `${computerName}[${ipAddress}]`;
        if (multipleId) {
          display += ` #${multipleId}`;
        }
        return display;
      }
    } else if (type === 'teamviewer') {
      const computerName = process.computerName || this.extractComputerName(process);
      const multipleId = process.multipleId;

      if (computerName) {
        // TeamViewer에서 suffix 표시 (동일 컴퓨터명 구분용)
        if (multipleId) {
          return `[${computerName} #${multipleId}] TeamViewer`;
        } else {
          return `[${computerName}] TeamViewer`;
        }
      }
    }

    // 기본 표시
    return process.windowTitle || process.processName || 'Unknown Process';
  }

  /**
   * 복사용 텍스트 생성 (업무용 형태)
   * @param {Object} process - 프로세스 정보
   * @returns {string} 복사용 텍스트
   */
  static getCopyText(process) {
    const type = process.type || this.detectProcessType(process);

    if (type === 'ezhelp') {
      const computerName = process.computerName || this.extractComputerName(process);
      const ipAddress = process.ipAddress || this.extractIpAddress(process);

      if (computerName && ipAddress) {
        return `${ipAddress}[${computerName}]`;
      }
    } else if (type === 'teamviewer') {
      const computerName = process.computerName || this.extractComputerName(process);
      if (computerName) {
        return `[${computerName}]`;
      }
    }

    return process.windowTitle || '';
  }

  /**
   * 프로세스 타입 감지
   * @param {Object} process - 프로세스 정보
   * @returns {string} 프로세스 타입 ('ezhelp', 'teamviewer', 'unknown')
   */
  static detectProcessType(process) {
    // ★★★ 속성 이름 호환성 확보
    const processName = (process.processName || process.ProcessName || '').toLowerCase();
    const windowTitle = process.windowTitle || process.MainWindowTitle || '';

    if (processName === 'ezhelpviewer' && (windowTitle.includes('원격지') || windowTitle.includes('Relay'))) {
      return 'ezhelp';
    }

    // TeamViewer 정규식 개선
    if (processName === 'teamviewer' && (/.+ - TeamViewer$/i.test(windowTitle) || /^\[.+\] TeamViewer$/i.test(windowTitle))) {
      return 'teamviewer';
    }

    // 브라우저 테스트 지원
    if (processName === 'chrome') {
      if (windowTitle.includes('원격지 IP') || windowTitle.includes('Relay')) {
        return 'ezhelp';
      }
      if (/.+ - TeamViewer - Chrome$/i.test(windowTitle)) {
        return 'teamviewer';
      }
    }

    return 'unknown';
  }

  /**
   * 윈도우 타이틀에서 컴퓨터명 추출
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} 컴퓨터명
   */
  /**
  * 윈도우 타이틀에서 컴퓨터명 추출 (수정 완료)
  * - TeamViewer의 모든 창 제목 형식(일반, 다중 세션, Chrome 테스트)을 포괄하도록 정규식 개선
  * @param {Object} process - 프로세스 정보
  * @returns {string|null} 컴퓨터명
  */
  static extractComputerName(process) {
    // ★★★ 속성 이름 호환성 확보
    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const type = this.detectProcessType(process); // 여기서는 이미 호환되는 함수를 호출

    if (type === 'ezhelp') {
      let match = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\s+잠김\(/);
      if (match) return match[1].trim();
      match = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\(/);
      if (match) return match[1].trim();
      const fallbackMatch = windowTitle.match(/ezHelp - ([^(]+)/);
      return fallbackMatch ? fallbackMatch[1].trim() : null;
    }

    if (type === 'teamviewer') {
      const match = windowTitle.match(/^(?:\[(.+?)\]|([^\[\]]+?)) - TeamViewer(?: - Chrome)?$/i);
      if (match) {
        const computerName = match[1] || match[2];
        return computerName.trim();
      }
    }

    return null;
  }

  /**
   * 윈도우 타이틀에서 IP 주소 추출 (ezHelp용)
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} IP 주소
   */
  static extractIpAddress(process) {
    // ★★★ 속성 이름 호환성 확보
    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const match = windowTitle.match(/원격지 IP : ([\d.]+)/);
    return match ? match[1] : null;
  }
  /**
   * 윈도우 타이틀에서 상담원 ID 추출 (ezHelp용)
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} 상담원 ID
   */
  static extractCounselorId(process) {
    // ★★★ 속성 이름 호환성 확보
    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const match = windowTitle.match(/상담원\((\d+)\)/);
    return match ? match[1] : null;
  }

  /**
   * 프로세스 정보 정규화
   * @param {Object} rawProcess - 원시 프로세스 정보
   * @returns {Object} 정규화된 프로세스 정보
   */
  static normalizeProcessInfo(rawProcess, handleMap = null) {
    const type = this.detectProcessType(rawProcess);
    let computerName = this.extractComputerName(rawProcess);
    let multipleId = null;

    // ★★★ 핵심 수정: 창 제목보다 "기억"을 먼저 확인합니다.
    if (handleMap && handleMap.has(rawProcess.WindowHandle)) {
      multipleId = handleMap.get(rawProcess.WindowHandle);
    }

    // if (type === 'teamviewer' && computerName && computerName.includes(' #')) {
    //   const match = computerName.match(/^(.*) #(\d+)$/);
    //   if (match) {
    //     computerName = match[1];
    //     multipleId = parseInt(match[2], 10);
    //   }
    // }

    return {
      // ★★★ 속성 이름 호환성 확보
      pid: rawProcess.Id || rawProcess.pid,
      processName: rawProcess.ProcessName || rawProcess.processName,
      windowTitle: rawProcess.MainWindowTitle || rawProcess.windowTitle,
      windowHandle: rawProcess.WindowHandle || rawProcess.windowHandle,
      isMinimized: rawProcess.IsMinimized || rawProcess.isMinimized || false,
      isHidden: !rawProcess.IsVisible && rawProcess.IsVisible !== undefined
        ? true
        : (rawProcess.isHidden || false),
      type: type,
      computerName: computerName,
      multipleId: multipleId,
      ipAddress: type === 'ezhelp' ? this.extractIpAddress(rawProcess) : null,
      counselorId: type === 'ezhelp' ? this.extractCounselorId(rawProcess) : null,
    };
  }

  /**
   * 두 프로세스가 같은 원격지인지 확인
   * @param {Object} process1 - 첫 번째 프로세스
   * @param {Object} process2 - 두 번째 프로세스
   * @returns {boolean} 같은 원격지 여부
   */
  static isSameRemote(process1, process2) {
    return this.getMatchingKey(process1) === this.getMatchingKey(process2);
  }

  /**
   * 프로세스 키 유효성 검사
   * @param {string} key - 검사할 키
   * @returns {boolean} 유효성 여부
   */
  static isValidProcessKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // 기본 패턴 확인
    const patterns = [
      /^proc_\d+_[a-z0-9]+$/, // 프로세스 ID 패턴
      /^ezhelp_.+$/, // ezHelp 매칭 키 패턴
      /^teamviewer_.+$/, // TeamViewer 매칭 키 패턴
    ];

    return patterns.some(pattern => pattern.test(key));
  }

  /**
   * 키에서 프로세스 타입 추출
   * @param {string} key - 프로세스 키
   * @returns {string|null} 프로세스 타입
   */
  static getTypeFromKey(key) {
    if (key.startsWith('ezhelp_')) {
      return 'ezhelp';
    } else if (key.startsWith('teamviewer_')) {
      return 'teamviewer';
    } else if (key.startsWith('proc_')) {
      return 'process';
    }
    return null;
  }

  /**
   * 디버깅용 키 정보 출력
   * @param {Object} process - 프로세스 정보
   * @returns {Object} 키 정보 객체
   */
  static getKeyInfo(process) {
    return {
      processId: process.id,
      matchingKey: this.getMatchingKey(process),
      settingsKey: this.getSettingsKey(process),
      displayKey: this.getDisplayKey(process),
      copyText: this.getCopyText(process),
      type: this.detectProcessType(process),
      computerName: this.extractComputerName(process),
      ipAddress: this.extractIpAddress(process),
      counselorId: this.extractCounselorId(process),
    };
  }
}