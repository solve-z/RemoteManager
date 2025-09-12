/**
 * ConflictDialog - 프로세스 충돌 해결을 위한 사용자 확인 다이얼로그
 */

import { KeyManager } from '../services/KeyManager.js';

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

      // 자동 새로고침 일시 정지 알림
      window.dispatchEvent(new CustomEvent('conflict-dialog-opened'));

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
          <div class="conflict-summary">
            <p><strong>${conflictInfo.computerName}</strong> 
            <span class="process-details-compact">${conflictInfo.existingProcess.type ? conflictInfo.existingProcess.type.toUpperCase() : 'TeamViewr'} | PID: ${conflictInfo.existingProcess.pid}</span></p>
            ${conflictInfo.ipChanged ? `
              <p class="ip-change-notice">${conflictInfo.oldIP} → ${conflictInfo.newIP}</p>
            ` : ''}
          </div>
        </div>
        <div class="conflict-dialog-actions">
          <div class="same-computer-options">
            <h5>어떻게 처리할까요?</h5>
            
            ${conflictInfo.availableExistingProcesses && conflictInfo.availableExistingProcesses.length > 0 ? `
              <div class="existing-process-selector">
                <h6>유지할 기존 연결을 선택하세요:</h6>
                <div class="existing-process-list">
                  ${conflictInfo.availableExistingProcesses.map(proc => `
                    <div class="existing-process-item" data-process-id="${proc.id}">
                      <input type="radio" name="selectedExisting" value="${proc.id}" id="existing_${proc.id}">
                      <label for="existing_${proc.id}" class="process-item-label">
                        <div class="process-item-main">
                          <span class="process-name">${proc.displayName}</span>
                        </div>
                        <div class="process-item-details">
                          <span class="process-time">등록: ${new Date(proc.createdAt).toLocaleString()}</span>
                          <span class="process-pid">PID: ${proc.pid}</span>
                        </div>
                      </label>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            <div class="same-options-group">
              <button class="conflict-btn conflict-btn-keep-existing" data-choice="keep_existing" disabled>
                <span class="btn-text">📍 기존 연결 유지</span>
                <span class="btn-desc">새 정보로 업데이트</span>
              </button>
              <button class="conflict-btn conflict-btn-different" data-choice="different">
                <span class="btn-text">🆕 새 원격지로 등록</span>
                <span class="btn-desc">별도 프로세스로 관리</span>
              </button>
            </div>
          </div>
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

        // keep_existing 선택 시 선택된 프로세스 ID 포함
        if (choice === 'keep_existing') {
          const selectedProcess = this.getSelectedExistingProcess();
          if (!selectedProcess) {
            // 선택된 프로세스가 없으면 무시
            return;
          }
          this.handleChoice(choice, { selectedProcessId: selectedProcess });
        } else {
          this.handleChoice(choice);
        }
      });
    });

    // 라디오 버튼 선택 시 keep_existing 버튼 활성화/비활성화
    const radioButtons = this.dialog.querySelectorAll('input[name="selectedExisting"]');
    const keepExistingBtn = this.dialog.querySelector('.conflict-btn-keep-existing');

    radioButtons.forEach(radio => {
      radio.addEventListener('change', () => {
        if (keepExistingBtn) {
          keepExistingBtn.disabled = !this.getSelectedExistingProcess();

          // 선택되었을 때 스타일 변경
          if (!keepExistingBtn.disabled) {
            keepExistingBtn.classList.add('enabled');
          } else {
            keepExistingBtn.classList.remove('enabled');
          }
        }
      });
    });

    const closeBtn = this.dialog.querySelector('.conflict-dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.handleChoice('different'));
    }

    // 다이얼로그 밖 클릭 무시
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // 다이얼로그 내부 클릭 시 이벤트 버블링 방지
    this.dialog.querySelector('.conflict-dialog').addEventListener('click', (e) => {
      e.stopPropagation();
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
   * 선택된 기존 프로세스 ID 가져오기
   */
  getSelectedExistingProcess() {
    const selectedRadio = this.dialog.querySelector('input[name="selectedExisting"]:checked');
    return selectedRadio ? selectedRadio.value : null;
  }

  /**
   * 사용자 선택 처리 (추가 데이터 지원)
   */
  handleChoice(choice, additionalData = null) {
    // --- 5. 선택이 처리되는지 확인 ---
    console.log('5. handleChoice 호출됨, 선택:', choice, '추가 데이터:', additionalData);
    if (this.resolve) {
      const result = additionalData ? { choice, ...additionalData } : choice;
      this.resolve(result);
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

    // 자동 새로고침 재개 알림
    window.dispatchEvent(new CustomEvent('conflict-dialog-closed'));
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

  /**
   * 프로세스 표시명 가져오기 (ProcessList와 동일한 로직)
   * @param {Object} process - 프로세스 객체
   * @returns {string} 표시명
   */
  getDisplayName(process) {
    // 기본 정보는 항상 표시
    const baseInfo = KeyManager.getDisplayKey(process);
    
    // 라벨이 있으면 기본 정보 + 라벨 형태로 표시
    if (process.customLabel) {
      return `${baseInfo} - ${process.customLabel}`;
    }
    
    return baseInfo;
  }
}