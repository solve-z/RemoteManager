/**
 * ConflictDialog - 프로세스 충돌 해결을 위한 사용자 확인 다이얼로그
 * IP 변경 등으로 인한 충돌 시 사용자 의사 확인
 */

export class ConflictDialog {
  constructor() {
    this.dialog = null;
    this.resolve = null;
    this.isOpen = false;
  }

  /**
   * 충돌 해결 다이얼로그 표시
   * @param {Object} conflictInfo - 충돌 정보
   * @returns {Promise<string>} 사용자 선택 ('same', 'different', 'always_new')
   */
  async showConflictDialog(conflictInfo) {
    if (this.isOpen) {
      return 'different'; // 이미 다이얼로그가 열려있으면 기본값 반환
    }

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.isOpen = true;
      this.createDialog(conflictInfo);
    });
  }

  /**
   * 다이얼로그 HTML 생성
   * @param {Object} conflictInfo - 충돌 정보
   */
  createDialog(conflictInfo) {
    // 기존 다이얼로그가 있으면 제거
    this.removeDialog();

    // 다이얼로그 컨테이너 생성
    this.dialog = document.createElement('div');
    this.dialog.className = 'conflict-dialog-overlay';
    this.dialog.innerHTML = `
      <div class="conflict-dialog">
        <div class="conflict-dialog-header">
          <h3>기존 연결 정보 발견</h3>
          <button class="conflict-dialog-close" aria-label="닫기">&times;</button>
        </div>
        
        <div class="conflict-dialog-content">
          <div class="conflict-info">
            <div class="conflict-computer">
              <strong>컴퓨터명:</strong> ${conflictInfo.computerName}
            </div>
            ${conflictInfo.ipChanged ? `
              <div class="conflict-ip-change">
                <div class="conflict-old-ip">
                  <strong>기존 IP:</strong> ${conflictInfo.oldIP || '알 수 없음'}
                </div>
                <div class="conflict-new-ip">
                  <strong>현재 IP:</strong> ${conflictInfo.newIP || '알 수 없음'}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="conflict-question">
            <p>같은 컴퓨터입니까?</p>
          </div>
        </div>
        
        <div class="conflict-dialog-actions">
          <button class="conflict-btn conflict-btn-same" data-choice="same">
            <span class="btn-text">예</span>
            <span class="btn-desc">기존 그룹/카테고리 정보 유지</span>
          </button>
          <button class="conflict-btn conflict-btn-different" data-choice="different">
            <span class="btn-text">아니오</span>
            <span class="btn-desc">새로운 원격지로 등록</span>
          </button>
          <button class="conflict-btn conflict-btn-always" data-choice="always_new">
            <span class="btn-text">항상 새로 등록</span>
            <span class="btn-desc">이후 자동으로 새 원격지로 처리</span>
          </button>
        </div>
      </div>
    `;

    // 이벤트 리스너 추가
    this.addEventListeners();

    // DOM에 추가
    document.body.appendChild(this.dialog);

    // 포커스 설정
    const firstButton = this.dialog.querySelector('.conflict-btn-same');
    if (firstButton) {
      firstButton.focus();
    }

    // ESC 키 이벤트 추가
    this.handleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * 이벤트 리스너 추가
   */
  addEventListeners() {
    // 버튼 클릭 이벤트
    const buttons = this.dialog.querySelectorAll('[data-choice]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const choice = e.currentTarget.getAttribute('data-choice');
        this.handleChoice(choice);
      });
    });

    // 닫기 버튼
    const closeBtn = this.dialog.querySelector('.conflict-dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.handleChoice('different'); // 기본값으로 처리
      });
    }

    // 오버레이 클릭 (다이얼로그 외부 클릭)
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.handleChoice('different'); // 기본값으로 처리
      }
    });
  }

  /**
   * 키보드 이벤트 처리
   * @param {KeyboardEvent} e - 키보드 이벤트
   */
  handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.handleChoice('different');
    } else if (e.key === 'Enter') {
      // 포커스된 버튼 클릭
      const focusedButton = this.dialog.querySelector('[data-choice]:focus');
      if (focusedButton) {
        e.preventDefault();
        const choice = focusedButton.getAttribute('data-choice');
        this.handleChoice(choice);
      }
    } else if (e.key === 'Tab') {
      // 탭 순환을 다이얼로그 내부로 제한
      const focusableElements = this.dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * 사용자 선택 처리
   * @param {string} choice - 사용자 선택
   */
  handleChoice(choice) {
    if (this.resolve) {
      this.resolve(choice);
      this.resolve = null;
    }
    this.close();
  }

  /**
   * 다이얼로그 닫기
   */
  close() {
    this.removeDialog();
    this.isOpen = false;
    
    // 키보드 이벤트 리스너 제거
    if (this.handleKeydown) {
      document.removeEventListener('keydown', this.handleKeydown);
      this.handleKeydown = null;
    }
  }

  /**
   * 다이얼로그 DOM 제거
   */
  removeDialog() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
    this.dialog = null;
  }

  /**
   * 다이얼로그가 열려있는지 확인
   * @returns {boolean} 열림 상태
   */
  isDialogOpen() {
    return this.isOpen;
  }
}