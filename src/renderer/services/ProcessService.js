/**
 * ProcessService - 프로세스 관련 비즈니스 로직
 * 프로세스 감지, 상태 관리, 윈도우 조작 등의 핵심 기능
 */

import { KeyManager } from './KeyManager.js';

export class ProcessService {
  constructor(processStore, notificationService, groupStore = null) {
    this.processStore = processStore;
    this.notificationService = notificationService;
    this.groupStore = groupStore;
    this.isLoading = false;
    this.lastLoadTime = null;
  }

  /**
   * GroupStore 설정
   * @param {GroupStore} groupStore - 그룹 스토어 인스턴스
   */
  setGroupStore(groupStore) {
    this.groupStore = groupStore;
  }

  /**
   * 프로세스 목록 로드 (메인 프로세스에서 감지)
   */
  async loadProcesses() {
    if (this.isLoading) {
      return; // 이미 로딩 중인 경우 중복 실행 방지
    }

    this.isLoading = true;
    
    try {
      const result = await window.electronAPI.detectProcesses();
      if (result.success) {
        this.updateProcessStatuses(result.data);
        this.lastLoadTime = new Date();
      } else {
        throw new Error(result.error || '프로세스 감지 실패');
      }
    } catch (error) {
      console.error('프로세스 로드 실패:', error);
      this.notificationService?.showError('프로세스 감지 실패', error.message);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 프로세스 상태 업데이트 (안정적 키 기반 그룹 정보 복원 포함)
   * @param {Array} currentProcesses - 현재 감지된 프로세스 목록
   */
  async updateProcessStatuses(currentProcesses) {
    const normalizedProcesses = currentProcesses.map(p => 
      KeyManager.normalizeProcessInfo(p)
    );

    // 유효한 원격 프로세스만 필터링
    const remoteProcesses = normalizedProcesses.filter(p => 
      this.isValidRemoteProcess(p)
    );

    const currentProcessIds = new Set();
    const connectionEvents = [];

    // 현재 프로세스들 처리
    for (const processInfo of remoteProcesses) {
      try {
        const process = await this.processStore.updateProcess(processInfo);
        currentProcessIds.add(process.id);

        // 그룹/카테고리 정보는 이미 프로세스 생성 시점에 설정됨 (중복 방지)
        // this.restoreProcessMetadata(process);

        // 연결 상태 변경 감지
        if (process.status === 'reconnected') {
          connectionEvents.push({
            type: 'reconnection',
            process: process,
            message: `${KeyManager.getDisplayKey(process)} 재연결됨`,
          });
        } else if (process.createdAt && 
                   Date.now() - process.createdAt.getTime() < 1000) {
          // 새로 감지된 프로세스 (1초 이내 생성)
          connectionEvents.push({
            type: 'connection',
            process: process,
            message: `${KeyManager.getDisplayKey(process)} 연결됨`,
          });
        }
      } catch (error) {
        console.error('프로세스 업데이트 실패:', error);
      }
    }

    // 사라진 프로세스들을 끊어진 상태로 표시
    const disconnectedProcesses = this.processStore.markMissingAsDisconnected(currentProcessIds);
    
    // 끊어진 프로세스 알림
    for (const processId of disconnectedProcesses || []) {
      const process = this.processStore.getProcess(processId);
      if (process) {
        connectionEvents.push({
          type: 'disconnection',
          process: process,
          message: `${KeyManager.getDisplayKey(process)} 연결 끊김`,
        });
      }
    }

    // 연결 상태 변경 알림
    this.notifyConnectionEvents(connectionEvents);

    // 오래된 프로세스 정리
    this.processStore.cleanupOldProcesses();
  }

  /**
   * 유효한 원격 프로세스인지 확인
   * @param {Object} process - 프로세스 정보
   * @returns {boolean} 유효성 여부
   */
  isValidRemoteProcess(process) {
    if (!process.computerName) {
      return false;
    }

    const type = process.type;
    
    if (type === 'ezhelp') {
      // ezHelp는 IP 주소가 있어야 함
      return !!process.ipAddress;
    } else if (type === 'teamviewer') {
      // TeamViewer는 컴퓨터명만 있으면 됨
      return true;
    }

    return false;
  }

  /**
   * 프로세스 메타데이터 복원 (그룹/카테고리 정보)
   * @param {Object} process - 프로세스 객체
   */
  restoreProcessMetadata(process) {
    if (!this.groupStore) {
      return;
    }

    try {
      // 안정적 키 기반으로 그룹/카테고리 정보 복원
      const restored = this.groupStore.restoreProcessGroupInfo(process);
      
      if (restored.groupId || restored.category) {
        console.log(`프로세스 ${process.id} 메타데이터 복원:`, {
          groupId: restored.groupId,
          category: restored.category,
          computerName: process.computerName,
          stableKey: KeyManager.getStableIdentifier(process)
        });
      }
    } catch (error) {
      console.error('프로세스 메타데이터 복원 실패:', error);
    }
  }

  /**
   * 연결 상태 변경 이벤트 알림
   * @param {Array} events - 연결 이벤트 배열
   */
  notifyConnectionEvents(events) {
    if (!this.notificationService) {
      return;
    }

    for (const event of events) {
      switch (event.type) {
        case 'connection':
          this.notificationService.showSuccess(event.message);
          break;
        case 'reconnection':
          this.notificationService.showInfo(event.message);
          break;
        case 'disconnection':
          this.notificationService.showWarning(event.message);
          break;
      }
    }
  }

  /**
   * 프로세스 윈도우에 포커스
   * @param {string} processId - 프로세스 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  async focusProcess(processId) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        throw new Error('프로세스를 찾을 수 없습니다.');
      }

      // WindowHandle이 있으면 우선 사용, 없으면 PID 사용
      const targetId = process.windowHandle || process.pid;
      const useHandle = !!process.windowHandle;
      
      const result = await window.electronAPI.focusWindow({
        id: targetId,
        useHandle: useHandle,
        processName: process.processName,
        windowTitle: process.windowTitle
      });
      
      if (result.success) {
        this.notificationService?.showSuccess(
          `${KeyManager.getDisplayKey(process)} 창이 포커스되었습니다.`
        );
        return true;
      } else {
        throw new Error(result.error || '윈도우 포커스 실패');
      }
    } catch (error) {
      console.error('프로세스 포커스 실패:', error);
      this.notificationService?.showError('윈도우 포커스 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스 정보 복사
   * @param {string} processId - 프로세스 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  async copyProcessInfo(processId) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        throw new Error('프로세스를 찾을 수 없습니다.');
      }

      const copyText = KeyManager.getCopyText(process);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        // 폴백: 임시 텍스트 영역 사용
        const textArea = document.createElement('textarea');
        textArea.value = copyText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      this.notificationService?.showSuccess(
        `${copyText} 복사되었습니다.`
      );
      return true;
    } catch (error) {
      console.error('프로세스 정보 복사 실패:', error);
      this.notificationService?.showError('복사 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스 커스텀 라벨 설정
   * @param {string} processId - 프로세스 ID
   * @param {string} customLabel - 커스텀 라벨
   * @returns {boolean} 성공 여부
   */
  setProcessLabel(processId, customLabel) {
    try {
      const success = this.processStore.updateProcessSettings(processId, {
        customLabel: customLabel.trim() || null,
      });

      if (success) {
        this.notificationService?.showSuccess('라벨이 변경되었습니다.');
      }

      return success;
    } catch (error) {
      console.error('프로세스 라벨 설정 실패:', error);
      this.notificationService?.showError('라벨 설정 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스 카테고리 설정 (안정적 키 기반 저장 포함)
   * @param {string} processId - 프로세스 ID
   * @param {string} category - 카테고리
   * @returns {boolean} 성공 여부
   */
  setProcessCategory(processId, category) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        throw new Error('프로세스를 찾을 수 없습니다.');
      }

      // 1. 프로세스 설정 업데이트
      const success = this.processStore.updateProcessSettings(processId, {
        category: category || null,
      });

      if (!success) {
        throw new Error('프로세스 설정 업데이트 실패');
      }

      // 2. 안정적 키 기반으로 카테고리 저장 (그룹과 동일한 방식)
      if (this.groupStore) {
        this.groupStore.setCategoryByStableKey(process, category);
        console.log('💾 카테고리 안정적 키 저장:', {
          processId: processId,
          category: category,
          stableKey: KeyManager.getStableIdentifier(process),
          computerName: process.computerName
        });
      } else {
        console.warn('⚠️ GroupStore가 없어서 카테고리 안정적 키 저장 불가');
      }

      if (success) {
        this.notificationService?.showSuccess('카테고리가 변경되었습니다.');
      }

      return success;
    } catch (error) {
      console.error('프로세스 카테고리 설정 실패:', error);
      this.notificationService?.showError('카테고리 설정 실패', error.message);
      return false;
    }
  }

  /**
   * 끊어진 프로세스 제거
   * @param {string} processId - 프로세스 ID
   * @returns {boolean} 성공 여부
   */
  removeDisconnectedProcess(processId) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        return false;
      }

      if (process.status !== 'disconnected') {
        this.notificationService?.showWarning('연결된 프로세스는 제거할 수 없습니다.');
        return false;
      }

      const success = this.processStore.removeProcess(processId);
      
      if (success) {
        this.notificationService?.showSuccess(
          `${KeyManager.getDisplayKey(process)} 제거되었습니다.`
        );
      }

      return success;
    } catch (error) {
      console.error('프로세스 제거 실패:', error);
      this.notificationService?.showError('프로세스 제거 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스 통계 정보 가져오기
   * @returns {Object} 통계 정보
   */
  getStatistics() {
    return this.processStore.getStatistics();
  }

  /**
   * 특정 타입의 프로세스들 가져오기
   * @param {string} type - 프로세스 타입 ('ezhelp', 'teamviewer')
   * @returns {Array} 해당 타입의 프로세스 배열
   */
  getProcessesByType(type) {
    return this.processStore.getAllProcesses().filter(p => p.type === type);
  }

  /**
   * 최근 활동 프로세스들 가져오기
   * @param {number} minutes - 분 단위 시간 (기본: 30분)
   * @returns {Array} 최근 활동 프로세스 배열
   */
  getRecentActiveProcesses(minutes = 30) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    return this.processStore.getAllProcesses().filter(p => 
      p.lastSeen && p.lastSeen.getTime() > cutoffTime
    );
  }

  /**
   * 수동으로 프로세스 추가 (테스트/디버깅용)
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object|null} 추가된 프로세스
   */
  addManualProcess(processInfo) {
    try {
      // 유효성 검사
      if (!processInfo.processName || !processInfo.windowTitle) {
        throw new Error('프로세스명과 윈도우 제목은 필수입니다.');
      }

      // PID 중복 확인
      const existingProcess = this.processStore.getAllProcesses()
        .find(p => p.pid === processInfo.pid);
      
      if (existingProcess) {
        throw new Error(`PID ${processInfo.pid}는 이미 사용 중입니다.`);
      }

      const normalizedInfo = KeyManager.normalizeProcessInfo(processInfo);
      
      if (!this.isValidRemoteProcess(normalizedInfo)) {
        throw new Error('유효하지 않은 원격 프로세스 정보입니다.');
      }

      const process = this.processStore.addNewProcess(normalizedInfo);
      
      this.notificationService?.showSuccess(
        `${KeyManager.getDisplayKey(process)} 수동으로 추가되었습니다.`
      );

      return process;
    } catch (error) {
      console.error('수동 프로세스 추가 실패:', error);
      this.notificationService?.showError('프로세스 추가 실패', error.message);
      return null;
    }
  }

  /**
   * 로딩 상태 확인
   * @returns {boolean} 로딩 중 여부
   */
  isLoading() {
    return this.isLoading;
  }

  /**
   * 마지막 로드 시간 가져오기
   * @returns {Date|null} 마지막 로드 시간
   */
  getLastLoadTime() {
    return this.lastLoadTime;
  }
}