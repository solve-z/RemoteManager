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
      // 1. Detector로부터 "날것"의 프로세스 정보를 가져옵니다.
      const result = await window.electronAPI.detectProcesses();
      if (result.success) {
        // 2. 가져온 정보를 바탕으로 상태를 업데이트합니다.
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
  async updateProcessStatuses(rawProcesses) {
    // --- 1. 입력 데이터 확인 ---
    console.log(`[1단계] 입력: Detector로부터 ${rawProcesses.length}개의 원시 프로세스 받음`);
    console.log(JSON.stringify(rawProcesses, null, 2)); // 필요하면 이 주석을 풀어 상세 데이터 확인
    const handleMap = this.processStore.multipleIdStore.handleToMultipleIdMap;

    // 2. KeyManager를 사용하여 "날것"의 데이터를 완전한 객체로 변환합니다.
    const normalizedProcesses = rawProcesses.map(p =>
      KeyManager.normalizeProcessInfo(p, handleMap)
    );
    // --- 2. 정규화 결과 확인 ---
    console.log(`[2단계] 정규화: ${normalizedProcesses.length}개의 프로세스 정보 정규화 완료`);
    // console.log(normalizedProcesses, "정규화된 데이터")

    // 3. 정규화된 정보를 바탕으로 유효한 원격 프로세스만 필터링합니다.
    const remoteProcesses = normalizedProcesses.filter(p =>
      this.isValidRemoteProcess(p)
    );
    // --- 3. 필터링 결과 확인 ---
    console.log(`[3단계] 필터링: ${remoteProcesses.length}개의 유효한 원격 프로세스 필터링됨`);
    if (remoteProcesses.length === 0 && normalizedProcesses.length > 0) {
      console.warn('[경고] 모든 프로세스가 "isValidRemoteProcess" 필터에서 걸러졌습니다. 아래는 필터링 전 데이터입니다:');
      console.log(normalizedProcesses.map(p => ({
        type: p.type,
        computerName: p.computerName,
        ipAddress: p.ipAddress,
        isValid: this.isValidRemoteProcess(p)
      })));
    }

    const currentProcessIds = new Set();
    const connectionEvents = [];

    // 4. 유효한 프로세스들만 Store에 업데이트를 요청합니다.
    console.log(`[4단계] 업데이트 시작: ${remoteProcesses.length}개의 프로세스를 Store에 업데이트합니다.`);
    for (const processInfo of remoteProcesses) {
      try {
        const process = await this.processStore.updateProcess(processInfo);
        currentProcessIds.add(process.id);

        // (이하 로직은 동일)
        if (process.status === 'reconnected') {
          connectionEvents.push({ type: 'reconnection', process: process, message: `${KeyManager.getDisplayKey(process)} 재연결됨` });
        } else if (process.createdAt && Date.now() - process.createdAt.getTime() < 1000) {
          connectionEvents.push({ type: 'connection', process: process, message: `${KeyManager.getDisplayKey(process)} 연결됨` });
        }
      } catch (error) {
        console.error('프로세스 업데이트 실패:', error);
      }
    }

    // 5. 사라진 프로세스들을 처리합니다.
    const disconnectedProcessIds = this.processStore.markMissingAsDisconnected(currentProcessIds);
    console.log(`[5단계] 연결 해제 처리: ${disconnectedProcessIds?.length || 0}개의 프로세스를 연결 해제합니다.`);

    for (const processId of disconnectedProcessIds || []) {
      const process = this.processStore.getProcess(processId);
      if (process) {
        connectionEvents.push({ type: 'disconnection', process: process, message: `${KeyManager.getDisplayKey(process)} 연결 끊김` });
      }
    }

    this.notifyConnectionEvents(connectionEvents);
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
      return !!process.ipAddress; // 이중 부정, 결국 ip가 있으면 true
    } else if (type === 'teamviewer') {
      return true;
    }
    return false;
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
   * 프로세스 윈도우에 포커스 (ezHelp 최소화 시 컨트롤바 자동 표시)
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
        windowTitle: process.windowTitle,
        processType: process.type // ezHelp 컨트롤바 처리를 위한 프로세스 타입 전달
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
        
        // 라벨 변경 이벤트 발생 (미니창 동기화용)
        window.dispatchEvent(new CustomEvent('process-label-updated', {
          detail: { processId, customLabel }
        }));
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

      // 연결된 프로세스만 제거 불가 (disconnected, reconnected 등은 제거 가능)
      if (process.status === 'connected') {
        this.notificationService?.showWarning('연결된 프로세스는 제거할 수 없습니다.');
        return false;
      }

      // 먼저 ProcessStore에서 프로세스 제거 (그룹에서 제거 포함)
      const success = this.processStore.removeProcess(processId, false); // 히스토리도 삭제

      // 수동 제거 시에는 안정적 키 기반 설정도 완전 삭제
      if (success && this.groupStore) {
        const stableKey = KeyManager.getStableIdentifier(process);

        // 그룹과 카테고리 안정적 키 매핑 삭제 (ProcessStore에서 이미 그룹에서는 제거됨)
        this.groupStore.stableKeyGroupMap.delete(stableKey);
        this.groupStore.stableKeyCategoryMap.delete(stableKey);

        console.log('🗑️ 수동 제거로 안정적 키 설정 완전 삭제:', {
          processId: processId,
          computerName: process.computerName,
          stableKey: stableKey,
          deletedGroup: true,
          deletedCategory: true,
          remainingGroupMappings: this.groupStore.stableKeyGroupMap.size,
          remainingCategoryMappings: this.groupStore.stableKeyCategoryMap.size
        });

        // GroupStore 저장
        this.groupStore.save();
      }

      if (success) {
        this.notificationService?.showSuccess(
          `${KeyManager.getDisplayKey(process)} 완전히 제거되었습니다.`
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
   * 프로세스 정보 업데이트 (라벨, 카테고리)
   * @param {string} processId - 프로세스 ID
   * @param {string} customLabel - 커스텀 라벨
   * @param {string} category - 카테고리
   * @returns {boolean} 업데이트 성공 여부
   */
  updateProcessInfo(processId, customLabel, category) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        console.error('프로세스를 찾을 수 없습니다:', processId);
        return false;
      }

      console.log('✏️ 프로세스 정보 업데이트 시작:', {
        processId,
        currentLabel: process.customLabel,
        newLabel: customLabel,
        currentCategory: process.category,
        newCategory: category
      });

      // ProcessStore에서 프로세스 정보 업데이트
      const success = this.processStore.updateProcessInfo(processId, {
        customLabel,
        category
      });

      if (success) {
        // 안정적 키 기반 설정도 업데이트 (GroupStore 사용)
        if (this.groupStore) {
          const stableKey = KeyManager.getStableIdentifier(process);

          // 카테고리 매핑 업데이트
          if (category && category !== 'uncategorized') {
            this.groupStore.stableKeyCategoryMap.set(stableKey, category);
          } else {
            this.groupStore.stableKeyCategoryMap.delete(stableKey);
          }

          // GroupStore 저장
          this.groupStore.save();

          console.log('🔄 안정적 키 기반 카테고리 매핑 업데이트:', {
            stableKey,
            category,
            totalMappings: this.groupStore.stableKeyCategoryMap.size
          });
        }

        // 라벨 업데이트 이벤트 발생 (미니창 동기화용)
        window.dispatchEvent(new CustomEvent('process-label-updated', {
          detail: { processId, customLabel, category }
        }));

        this.notificationService?.showSuccess('프로세스 정보가 업데이트되었습니다.');
      } else {
        this.notificationService?.showError('프로세스 정보 업데이트에 실패했습니다.');
      }

      return success;
    } catch (error) {
      console.error('프로세스 정보 업데이트 실패:', error);
      this.notificationService?.showError('프로세스 정보 업데이트 실패', error.message);
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