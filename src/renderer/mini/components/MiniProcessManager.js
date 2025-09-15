/**
 * MiniProcessManager - 미니창의 프로세스 편집 관리 클래스
 * 프로세스 라벨 편집, 카테고리 설정 기능을 담당
 */
export class MiniProcessManager {
  constructor(miniApp) {
    this.miniApp = miniApp;
    this.currentEditingProcess = null;
    this.selectedCategory = 'uncategorized'; // 기본 카테고리

    this.initialize();
  }

  /**
   * 초기화
   */
  initialize() {
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 카테고리 다이얼로그 - 카테고리 선택
    document.querySelectorAll('#mini-category-picker .category-option').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectCategory(e.target.closest('.category-option').dataset.category);
      });
    });

    // 프로세스 다이얼로그 - 저장 버튼
    document.getElementById('mini-process-save')?.addEventListener('click', () => {
      this.handleSaveProcess();
    });

    // 프로세스 다이얼로그 - 취소/닫기 버튼
    document.getElementById('mini-process-cancel')?.addEventListener('click', () => {
      this.hideProcessDialog();
    });
    document.getElementById('mini-process-dialog-close')?.addEventListener('click', () => {
      this.hideProcessDialog();
    });

    // Enter 키로 프로세스 저장
    document.getElementById('mini-process-label')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSaveProcess();
      }
    });

    // 키보드 이벤트로 다이얼로그 제어
    document.addEventListener('keydown', (e) => {
      const processDialog = document.getElementById('mini-process-dialog');
      const isDialogOpen = processDialog && processDialog.style.display !== 'none';

      if (!isDialogOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideProcessDialog();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSaveProcess();
      }
    });

    // 다이얼로그 외부 클릭으로 닫기
    document.getElementById('mini-process-dialog')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hideProcessDialog();
      }
    });
  }

  /**
   * 프로세스 편집 다이얼로그 표시
   * @param {Object} process - 편집할 프로세스 정보
   */
  showEditProcessDialog(process) {
    const dialog = document.getElementById('mini-process-dialog');
    const title = document.getElementById('mini-process-dialog-title');
    const labelInput = document.getElementById('mini-process-label');
    const processInfo = document.getElementById('process-info');

    if (!dialog || !title || !labelInput) {
      console.error('프로세스 편집 다이얼로그 요소를 찾을 수 없습니다.');
      return;
    }

    // 다이얼로그에 클래스 추가
    dialog.classList.add('mini-process-dialog');

    title.textContent = '프로세스 편집';
    labelInput.value = process.customLabel || '';

    // 선택한 process 정보 
    let displayInfo = process.computerName || ''; // 컴퓨터 이름 기본값 설정
    if (process.ip) { // IP 정보가 있을 경우
      displayInfo += `[${process.ip}]`; // "[IP]" 형식으로 추가
    }
    processInfo.textContent = displayInfo; 


    // 현재 카테고리 선택
    const currentCategory = process.category || 'uncategorized';
    this.selectCategory(currentCategory);

    this.currentEditingProcess = process;

    dialog.style.display = 'flex';
    labelInput.focus();
    labelInput.select();

    console.log('📝 프로세스 편집 다이얼로그 열림:', {
      processId: process.id,
      currentLabel: process.customLabel,
      currentCategory: currentCategory
    });
  }

  /**
   * 프로세스 다이얼로그 숨김
   */
  hideProcessDialog() {
    const dialog = document.getElementById('mini-process-dialog');
    if (dialog) {
      dialog.style.display = 'none';
      dialog.classList.remove('mini-process-dialog');
    }
    this.currentEditingProcess = null;
    this.resetInputs();
  }

  /**
   * 입력 필드 초기화
   */
  resetInputs() {
    const labelInput = document.getElementById('mini-process-label');
    if (labelInput) {
      labelInput.value = '';
    }
    this.selectCategory('uncategorized');
  }

  /**
   * 카테고리 선택
   * @param {string} category - 선택할 카테고리
   */
  selectCategory(category) {
    // 모든 카테고리 옵션에서 선택 해제
    document.querySelectorAll('#mini-category-picker .category-option').forEach(option => {
      option.classList.remove('selected');
    });

    // 선택된 카테고리에 선택 표시
    const selectedOption = document.querySelector(`#mini-category-picker .category-option[data-category="${category}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }

    this.selectedCategory = category;
    console.log('🏷️ 카테고리 선택:', category);
  }

  /**
   * 프로세스 저장 처리
   */
  async handleSaveProcess() {
    if (!this.currentEditingProcess) {
      console.error('편집 중인 프로세스가 없습니다.');
      return;
    }

    const labelInput = document.getElementById('mini-process-label');
    const customLabel = labelInput?.value.trim() || null;

    // 라벨 길이 검증
    if (customLabel && customLabel.length > 100) {
      this.miniApp.showNotification('라벨은 100자 이하로 입력해주세요.', 'error');
      labelInput?.focus();
      return;
    }

    try {
      console.log('💾 프로세스 저장 시작:', {
        processId: this.currentEditingProcess.id,
        customLabel,
        category: this.selectedCategory
      });

      const result = await this.updateProcess(
        this.currentEditingProcess.id,
        customLabel,
        this.selectedCategory
      );

      console.log('📋 프로세스 저장 결과:', result);

      if (result.success) {
        this.hideProcessDialog();
        this.miniApp.showNotification('프로세스가 수정되었습니다.', 'success');
      } else {
        console.warn('⚠️ 프로세스 저장 실패:', result.error);
        this.miniApp.showNotification(result.error || '저장에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('❌ 프로세스 저장 실패:', error);
      this.miniApp.showNotification('저장 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 프로세스 업데이트
   * @param {string} processId - 프로세스 ID
   * @param {string} customLabel - 커스텀 라벨
   * @param {string} category - 카테고리
   * @returns {Promise<Object>} 수정 결과
   */
  async updateProcess(processId, customLabel, category) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'process-management',
      action: 'update',
      data: {
        processId,
        customLabel,
        category
      }
    });
  }

  /**
   * 카테고리 표시명 반환
   * @param {string} category - 카테고리 값
   * @returns {string} 표시명
   */
  getCategoryDisplayName(category) {
    const categoryMap = {
      'uncategorized': '미분류',
      'xray': '엑스레이',
      'new-server': '새서버',
      'old-server': '구서버',
      'other-server': '타서버'
    };
    return categoryMap[category] || category;
  }

  /**
   * 정리
   */
  destroy() {
    this.hideProcessDialog();
    this.currentEditingProcess = null;
  }
}