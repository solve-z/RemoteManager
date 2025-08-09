/**
 * ConflictDialog - 프로세스 충돌 해결을 위한 사용자 확인 다이얼로그
 */

export class ConflictDialog {
  constructor() {
    this.dialog = null;
    this.resolve = null;
    this.isOpen = false;

    // 생성자에서 handleKeydown을 미리 바인딩 (오류 해결)
    this.handleKeydown = this.handleKeydown.bind(this);
    console.log('✅ ConflictDialog 인스턴스 생성됨');
  }

  /**
   * 충돌 해결 다이얼로그 표시
   */
  showConflictDialog(conflictInfo) {
    // --- 1. 이 함수가 호출되는지 확인 ---
    console.log('1. showConflictDialog 호출됨. isOpen 상태:', this.isOpen);

    if (this.isOpen) {
      console.warn('   -> 다이얼로그가 이미 열려있어, 새로운 요청을 무시합니다.');
      return Promise.resolve('different');
    }

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.isOpen = true;
      console.log('   -> Promise 생성, 다이얼로그를 엽니다.');
      this.createDialog(conflictInfo);
    });
  }

  /**
   * 다이얼로그 HTML 생성
   */
  createDialog(conflictInfo) {
    // --- 2. 다이얼로그가 실제로 생성되는지 확인 ---
    console.log('2. createDialog 호출됨.');

    this.removeDialog();

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
          <div class="conflict-question"><p>같은 컴퓨터입니까?</p></div>
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

    this.addEventListeners();

    // --- 3. DOM에 추가 직전인지 확인 ---
    console.log('3. 다이얼로그를 document.body에 추가합니다.');
    document.body.appendChild(this.dialog);
    console.log('4. 다이얼로그 추가 완료.');

    const firstButton = this.dialog.querySelector('.conflict-btn-same');
    if (firstButton) {
      firstButton.focus();
    }
  }

  /**
   * 이벤트 리스너 추가
   */
  addEventListeners() {
    const buttons = this.dialog.querySelectorAll('[data-choice]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const choice = e.currentTarget.getAttribute('data-choice');
        this.handleChoice(choice);
      });
    });

    const closeBtn = this.dialog.querySelector('.conflict-dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.handleChoice('different'));
    }

    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.handleChoice('different');
    });

    document.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * 키보드 이벤트 처리 (변경 없음)
   */
  handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.handleChoice('different');
    } else if (e.key === 'Enter') {
      const focusedButton = this.dialog.querySelector('[data-choice]:focus');
      if (focusedButton) {
        e.preventDefault();
        const choice = focusedButton.getAttribute('data-choice');
        this.handleChoice(choice);
      }
    } else if (e.key === 'Tab') {
      const focusableElements = this.dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
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
   */
  handleChoice(choice) {
    // --- 5. 선택이 처리되는지 확인 ---
    console.log('5. handleChoice 호출됨, 선택:', choice);
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
    // --- 6. 다이얼로그가 닫히는지 확인 ---
    console.log('6. close 호출됨.');
    document.removeEventListener('keydown', this.handleKeydown);
    this.removeDialog();
    this.isOpen = false;
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
   */
  isDialogOpen() {
    return this.isOpen;
  }
}