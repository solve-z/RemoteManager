/**
 * MiniGroupManager - 미니창의 그룹 관리 클래스
 * 그룹 생성, 수정, 삭제 기능을 담당
 */
export class MiniGroupManager {
  constructor(miniApp) {
    this.miniApp = miniApp;
    this.currentEditingGroup = null;
    this.selectedColor = '#3b82f6'; // 기본 색상

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
    // 컨텍스트 메뉴 - 새 그룹 추가
    document.getElementById('context-create-group')?.addEventListener('click', () => {
      this.showCreateGroupDialog();
    });

    // 그룹 다이얼로그 - 색상 선택
    document.querySelectorAll('#mini-color-picker .color-option').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectColor(e.target.dataset.color);
      });
    });

    // 그룹 다이얼로그 - 저장 버튼
    document.getElementById('mini-group-save')?.addEventListener('click', () => {
      this.handleSaveGroup();
    });

    // 그룹 다이얼로그 - 취소/닫기 버튼
    document.getElementById('mini-group-cancel')?.addEventListener('click', () => {
      this.hideGroupDialog();
    });
    document.getElementById('mini-group-dialog-close')?.addEventListener('click', () => {
      this.hideGroupDialog();
    });

    // 확인 다이얼로그 - 예/아니오 버튼
    document.getElementById('mini-confirm-yes')?.addEventListener('click', () => {
      this.handleConfirmYes();
    });
    document.getElementById('mini-confirm-no')?.addEventListener('click', () => {
      this.hideConfirmDialog();
    });
    document.getElementById('mini-confirm-dialog-close')?.addEventListener('click', () => {
      this.hideConfirmDialog();
    });

    // Enter 키로 그룹 저장
    document.getElementById('mini-group-name')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSaveGroup();
      }
    });

    // 키보드 이벤트로 다이얼로그 제어
    document.addEventListener('keydown', (e) => {
      const groupDialog = document.getElementById('mini-group-dialog');
      const confirmDialog = document.getElementById('mini-confirm-dialog');

      if (groupDialog && groupDialog.style.display !== 'none') {
        // 그룹 다이얼로그가 열려있을 때
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideGroupDialog();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSaveGroup();
        }
      } else if (confirmDialog && confirmDialog.style.display !== 'none') {
        // 확인 다이얼로그가 열려있을 때
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideConfirmDialog();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.handleConfirmYes();
        }
      }
    });

    // 다이얼로그 외부 클릭으로 닫기
    document.getElementById('mini-group-dialog')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hideGroupDialog();
      }
    });
    document.getElementById('mini-confirm-dialog')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hideConfirmDialog();
      }
    });
  }

  /**
   * 새 그룹 생성 다이얼로그 표시
   */
  showCreateGroupDialog() {
    const dialog = document.getElementById('mini-group-dialog');
    const title = document.getElementById('mini-group-dialog-title');
    const nameInput = document.getElementById('mini-group-name');

    title.textContent = '새 그룹 추가';
    nameInput.value = '';
    this.selectColor('#3b82f6'); // 기본 색상으로 초기화
    this.currentEditingGroup = null;

    dialog.style.display = 'flex';
    nameInput.focus();
  }

  /**
   * 그룹 수정 다이얼로그 표시
   * @param {Object} group - 수정할 그룹 정보
   */
  showEditGroupDialog(group) {
    const dialog = document.getElementById('mini-group-dialog');
    const title = document.getElementById('mini-group-dialog-title');
    const nameInput = document.getElementById('mini-group-name');

    title.textContent = '그룹 수정';
    nameInput.value = group.name;
    this.selectColor(group.color || '#3b82f6');
    this.currentEditingGroup = group;

    dialog.style.display = 'flex';
    nameInput.focus();
    nameInput.select();
  }

  /**
   * 그룹 삭제 확인 다이얼로그 표시
   * @param {Object} group - 삭제할 그룹 정보
   */
  showDeleteGroupDialog(group) {
    const dialog = document.getElementById('mini-confirm-dialog');
    const title = document.getElementById('mini-confirm-dialog-title');
    const message = document.getElementById('mini-confirm-dialog-message');

    title.textContent = '그룹 삭제 확인';
    message.innerHTML = `그룹 '<strong>${group.name}</strong>'을 삭제하시겠습니까?<br><small>⚠️ 이 작업은 되돌릴 수 없습니다.</small>`;
    this.currentEditingGroup = group;

    dialog.style.display = 'flex';
  }

  /**
   * 그룹 다이얼로그 숨김
   */
  hideGroupDialog() {
    const dialog = document.getElementById('mini-group-dialog');
    dialog.style.display = 'none';
    this.currentEditingGroup = null;
  }

  /**
   * 확인 다이얼로그 숨김
   */
  hideConfirmDialog() {
    const dialog = document.getElementById('mini-confirm-dialog');
    dialog.style.display = 'none';
    this.currentEditingGroup = null;
  }

  /**
   * 색상 선택
   * @param {string} color - 선택할 색상
   */
  selectColor(color) {
    // 모든 색상 옵션에서 선택 해제
    document.querySelectorAll('#mini-color-picker .color-option').forEach(option => {
      option.classList.remove('selected');
    });

    // 선택된 색상에 선택 표시
    const selectedOption = document.querySelector(`#mini-color-picker .color-option[data-color="${color}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }

    this.selectedColor = color;
  }

  /**
   * 그룹 저장 처리
   */
  async handleSaveGroup() {
    const nameInput = document.getElementById('mini-group-name');
    const groupName = nameInput.value.trim();

    if (!groupName) {
      this.miniApp.showNotification('그룹명을 입력해주세요.', 'error');
      nameInput.focus();
      return;
    }

    if (groupName.length > 50) {
      this.miniApp.showNotification('그룹명은 50자 이하로 입력해주세요.', 'error');
      nameInput.focus();
      return;
    }

    try {
      let result;

      console.log('📝 미니창 그룹 저장 시작:', {
        isEditing: !!this.currentEditingGroup,
        groupName,
        selectedColor: this.selectedColor
      });

      if (this.currentEditingGroup) {
        // 그룹 수정
        console.log('✏️ 그룹 수정 요청:', this.currentEditingGroup.id);
        result = await this.updateGroup(this.currentEditingGroup.id, groupName, this.selectedColor);
      } else {
        // 새 그룹 생성
        console.log('➕ 그룹 생성 요청');
        result = await this.createGroup(groupName, this.selectedColor);
      }

      console.log('📋 그룹 저장 결과:', result);

      if (result.success) {
        this.hideGroupDialog();
        this.miniApp.showNotification(
          this.currentEditingGroup ? '그룹이 수정되었습니다.' : '그룹이 생성되었습니다.',
          'success'
        );
      } else {
        console.warn('⚠️ 그룹 저장 실패:', result.error);
        this.miniApp.showNotification(result.error || '작업에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('❌ 그룹 저장 실패:', error);
      this.miniApp.showNotification('작업 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 확인 다이얼로그 - 예 버튼 처리
   */
  async handleConfirmYes() {
    if (this.currentEditingGroup) {
      try {
        const result = await this.deleteGroup(this.currentEditingGroup.id);

        if (result.success) {
          this.hideConfirmDialog();
          this.miniApp.showNotification('그룹이 삭제되었습니다.', 'success');
        } else {
          this.miniApp.showNotification(result.error || '삭제에 실패했습니다.', 'error');
        }
      } catch (error) {
        console.error('그룹 삭제 실패:', error);
        this.miniApp.showNotification('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  }

  /**
   * 새 그룹 생성
   * @param {string} name - 그룹명
   * @param {string} color - 그룹 색상
   * @returns {Promise<Object>} 생성 결과
   */
  async createGroup(name, color) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'group-management',
      action: 'create',
      data: { name, color }
    });
  }

  /**
   * 그룹 수정
   * @param {string} groupId - 그룹 ID
   * @param {string} name - 새 그룹명
   * @param {string} color - 새 그룹 색상
   * @returns {Promise<Object>} 수정 결과
   */
  async updateGroup(groupId, name, color) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'group-management',
      action: 'update',
      data: { id: groupId, name, color }
    });
  }

  /**
   * 그룹 삭제
   * @param {string} groupId - 그룹 ID
   * @returns {Promise<Object>} 삭제 결과
   */
  async deleteGroup(groupId) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'group-management',
      action: 'delete',
      data: { id: groupId }
    });
  }

  /**
   * 그룹 순서 변경
   * @param {string} groupId - 그룹 ID
   * @param {'up'|'down'} direction - 이동 방향
   * @returns {Promise<Object>} 변경 결과
   */
  async moveGroup(groupId, direction) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'group-management',
      action: 'move',
      data: { id: groupId, direction }
    });
  }

  /**
   * 프로세스 그룹 변경
   * @param {string} processId - 프로세스 ID
   * @param {string} fromGroupId - 원본 그룹 ID
   * @param {string} toGroupId - 대상 그룹 ID
   * @returns {Promise<Object>} 변경 결과
   */
  async changeProcessGroup(processId, fromGroupId, toGroupId) {
    if (!window.electronAPI?.requestMainRefresh) {
      return { success: false, error: 'IPC API를 사용할 수 없습니다.' };
    }

    return await window.electronAPI.requestMainRefresh({
      type: 'group-management',
      action: 'change-process-group',
      data: { processId, fromGroupId, toGroupId }
    });
  }

  /**
   * 프로세스 순서 변경 (미니창 내부에서만 처리)
   * @param {string} groupId - 그룹 ID
   * @param {string} processId - 프로세스 ID
   * @param {number} newIndex - 새 인덱스
   * @returns {Promise<Object>} 변경 결과
   */
  async reorderProcess(groupId, processId, newIndex) {
    // 미니창에서만 순서 변경, 메인창과 동기화하지 않음
    console.log('🔄 미니창 내부 순서 변경:', { groupId, processId, newIndex });
    return { success: true };
  }
}