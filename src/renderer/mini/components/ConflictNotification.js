/**
 * ConflictNotification - 미니창용 충돌 알림 컴포넌트
 * 메인창에서 충돌이 발생했을 때 미니창에 알림을 표시하고 클릭 시 메인창으로 전환
 */

export class ConflictNotification {
  constructor() {
    this.isVisible = false;
    this.currentConflictInfo = null;
    this.notification = null;
    this.hideTimer = null;
    
    // DOM이 로드되면 알림 엘리먼트 생성
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createNotificationElement());
    } else {
      this.createNotificationElement();
    }
  }

  /**
   * 알림 DOM 엘리먼트 생성
   */
  createNotificationElement() {
    this.notification = document.createElement('div');
    this.notification.className = 'conflict-notification hidden';
    this.notification.innerHTML = `
      <div class="conflict-notification-content">
        <div class="conflict-notification-icon">⚠️</div>
        <div class="conflict-notification-text">
          <div class="conflict-notification-title">연결 충돌 감지</div>
          <div class="conflict-notification-message">메인창에서 처리가 필요합니다</div>
        </div>
        <div class="conflict-notification-action">
          <button class="conflict-notification-btn">처리하기</button>
          <button class="conflict-notification-close" aria-label="닫기">&times;</button>
        </div>
      </div>
    `;

    // 이벤트 리스너 추가
    this.addEventListeners();
    
    // body에 추가
    document.body.appendChild(this.notification);
  }

  /**
   * 이벤트 리스너 추가
   */
  addEventListeners() {
    // 처리하기 버튼 클릭 - 메인창으로 전환
    const actionBtn = this.notification.querySelector('.conflict-notification-btn');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleGoToMain();
    });

    // 닫기 버튼 클릭
    const closeBtn = this.notification.querySelector('.conflict-notification-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 이벤트 버블링 방지
      e.preventDefault();
      console.log('🔕 X 버튼 클릭 - 알림 숨김');
      this.hide();
    });

    // 알림 영역 클릭 시에도 메인창으로 전환 (버튼들 제외)
    this.notification.addEventListener('click', (e) => {
      // 버튼들과 그 자식 요소들은 제외
      if (e.target.closest('.conflict-notification-btn') || 
          e.target.closest('.conflict-notification-close')) {
        return;
      }
      this.handleGoToMain();
    });

    // Escape 키로 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * 충돌 알림 표시
   * @param {Object} conflictInfo - 충돌 정보
   */
  show(conflictInfo) {
    console.log('🔔 미니창 충돌 알림 표시 요청:', {
      computerName: conflictInfo.computerName,
      isVisible: this.isVisible,
      notificationExists: !!this.notification
    });
    
    if (!this.notification) {
      console.error('❌ 알림 엘리먼트가 존재하지 않습니다');
      return;
    }

    // 같은 컴퓨터명에 대한 중복 알림 방지
    if (this.isVisible && 
        this.currentConflictInfo && 
        this.currentConflictInfo.computerName === conflictInfo.computerName) {
      console.log('🚫 같은 컴퓨터에 대한 중복 알림 차단:', conflictInfo.computerName);
      return;
    }

    if (this.isVisible) {
      // 이미 표시 중이면 정보만 업데이트
      console.log('🔄 기존 알림 업데이트:', conflictInfo.computerName);
      this.updateContent(conflictInfo);
      this.currentConflictInfo = conflictInfo;
      
      // 타이머 제거 - 계속 표시 유지
      this.clearHideTimer();
      return;
    }

    this.currentConflictInfo = conflictInfo;
    this.updateContent(conflictInfo);
    
    // 알림 표시
    this.notification.style.display = ''; // display 복원
    this.notification.classList.remove('hidden');
    this.notification.classList.add('visible');
    this.isVisible = true;

    console.log('✅ 충돌 알림 표시됨:', conflictInfo.computerName);

    // 자동 숨김 타이머 제거 - 사용자가 직접 처리할 때까지 유지
    this.clearHideTimer();
  }

  /**
   * 알림 내용 업데이트
   * @param {Object} conflictInfo - 충돌 정보
   */
  updateContent(conflictInfo) {
    const titleEl = this.notification.querySelector('.conflict-notification-title');
    const messageEl = this.notification.querySelector('.conflict-notification-message');
    
    titleEl.textContent = `${conflictInfo.computerName} 연결 충돌`;
    
    if (conflictInfo.ipChanged) {
      messageEl.textContent = `IP 변경 감지: ${conflictInfo.oldIP} → ${conflictInfo.newIP}`;
    } else {
      messageEl.textContent = '동일 컴퓨터명 중복 연결이 감지되었습니다';
    }
  }

  /**
   * 메인창으로 전환 처리
   */
  async handleGoToMain() {
    try {
      // IPC를 통해 메인창으로 전환 요청
      if (window.electronAPI && window.electronAPI.switchToMainWindow) {
        await window.electronAPI.switchToMainWindow();
        console.log('📋 메인창 전환 요청 전송');
      }
      
      // 알림 숨기기
      this.hide();
    } catch (error) {
      console.error('❌ 메인창 전환 실패:', error);
    }
  }

  /**
   * 알림 숨기기
   */
  hide() {
    console.log('🔕 hide() 호출됨, isVisible:', this.isVisible);
    
    if (!this.notification) {
      console.error('❌ notification 엘리먼트가 없음');
      return;
    }

    // 강제로 상태 리셋
    this.notification.classList.remove('visible');
    this.notification.classList.add('hidden');
    this.notification.style.display = 'none'; // 강제로 숨김
    this.isVisible = false;
    this.currentConflictInfo = null;
    
    this.clearHideTimer();
    console.log('🔕 충돌 알림 강제 숨김 완료');
    
    // 잠시 후 display를 다시 복원 (다음 알림을 위해)
    setTimeout(() => {
      if (this.notification && !this.isVisible) {
        this.notification.style.display = '';
      }
    }, 100);
  }

  /**
   * 자동 숨김 타이머 정리
   */
  clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * 현재 알림이 표시 중인지 확인
   */
  isNotificationVisible() {
    return this.isVisible;
  }

  /**
   * 현재 충돌 정보 반환
   */
  getCurrentConflictInfo() {
    return this.currentConflictInfo;
  }

  /**
   * 컴포넌트 정리
   */
  destroy() {
    this.clearHideTimer();
    if (this.notification && this.notification.parentNode) {
      this.notification.parentNode.removeChild(this.notification);
    }
    this.notification = null;
    this.isVisible = false;
    this.currentConflictInfo = null;
  }
}