/**
 * GroupManager - 그룹 관리 컴포넌트
 * 그룹 다이얼로그 및 고급 그룹 관리 기능
 */

export class GroupManager {
  constructor(groupStore, groupService) {
    this.groupStore = groupStore;
    this.groupService = groupService;
    this.dialog = null;
    this.advancedDialog = null;
    this.contextMenu = null;
    this.confirmDialog = null;
    this.selectedColor = null;
    this.currentEditingGroup = null;
    this.initialize();
  }

  /**
   * 그룹 매니저 초기화
   */
  initialize() {
    this.findDialogElements();
  }

  /**
   * Input 요소 상태 완전 초기화
   */
  resetInputElement() {
    if (!this.inputElement) return;
    
    // 모든 속성 초기화
    this.inputElement.value = '';
    this.inputElement.readOnly = false;
    this.inputElement.disabled = false;
    this.inputElement.placeholder = '그룹명을 입력하세요';
    
    // 스타일 초기화
    this.inputElement.style.backgroundColor = '';
    this.inputElement.style.cursor = '';
    this.inputElement.style.opacity = '';
    this.inputElement.style.pointerEvents = '';
    
    // 클래스 초기화 (HTML의 원래 클래스명 사용)
    this.inputElement.className = 'form-input';
    
    // 포커스 가능하도록 설정
    this.inputElement.tabIndex = 0;
    
    // 강제로 DOM에서 제거하고 다시 추가
    this.inputElement.blur();
  }

  /**
   * 모든 다이얼로그 상태 초기화
   */
  resetAllDialogStates() {
    // 모든 모달 숨기기
    if (this.dialog) {
      this.dialog.style.display = 'none';
    }
    if (this.advancedDialog) {
      this.advancedDialog.style.display = 'none';
    }
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
    if (this.confirmDialog) {
      this.confirmDialog.style.display = 'none';
    }
    
    // 전역 이벤트 리스너 정리
    document.removeEventListener('keydown', this.globalKeyHandler);
    document.removeEventListener('click', this.globalClickHandler);
    
    // input 상태 완전 초기화
    this.resetInputElement();
    
    // 다이얼로그 요소들 재찾기
    setTimeout(() => {
      this.findDialogElements();
    }, 50);
  }

  /**
   * 확인 다이얼로그 DOM 요소들을 다시 찾기
   */
  findConfirmDialogElements() {
    this.confirmDialog = document.getElementById('confirm-dialog');
    this.confirmTitle = document.getElementById('confirm-dialog-title');
    this.confirmMessage = document.getElementById('confirm-dialog-message');
    this.confirmConfirmBtn = document.getElementById('confirm-dialog-confirm');
    this.confirmCancelBtn = document.getElementById('confirm-dialog-cancel');
    this.confirmCloseBtn = document.getElementById('confirm-dialog-close');
  }

  /**
   * 커스텀 확인 다이얼로그 표시
   * @param {string} title - 다이얼로그 제목
   * @param {string} message - 확인 메시지
   * @param {Function} onConfirm - 확인 버튼 클릭 시 콜백
   * @param {Function} onCancel - 취소 버튼 클릭 시 콜백 (선택사항)
   */
  showCustomConfirm(title, message, onConfirm, onCancel = null) {
    // 다시 요소들을 찾기 (DOM이 변경되었을 수 있음)
    this.findConfirmDialogElements();
    
    // 안전성 검사 - 모든 필수 요소가 있는지 확인
    if (!this.confirmDialog || !this.confirmTitle || !this.confirmMessage || 
        !this.confirmConfirmBtn || !this.confirmCancelBtn || !this.confirmCloseBtn) {
      console.warn('확인 다이얼로그 요소들이 준비되지 않음, 기본 confirm 사용');
      // 폴백: 기본 confirm 사용
      if (confirm(message.replace(/<[^>]*>/g, ''))) {
        if (onConfirm) onConfirm();
      } else {
        if (onCancel) onCancel();
      }
      return;
    }

    // 다이얼로그 내용 설정
    this.confirmTitle.textContent = title;
    this.confirmMessage.innerHTML = message.replace(/\n/g, '<br>');

    // 다이얼로그 표시
    this.confirmDialog.style.display = 'flex';

    // 기존 이벤트 리스너 제거 (클로닝으로) - parentNode 안전성 검사 추가
    let newConfirmBtn = this.confirmConfirmBtn;
    let newCancelBtn = this.confirmCancelBtn;
    let newCloseBtn = this.confirmCloseBtn;
    
    if (this.confirmConfirmBtn.parentNode) {
      newConfirmBtn = this.confirmConfirmBtn.cloneNode(true);
      this.confirmConfirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmConfirmBtn);
    }
    if (this.confirmCancelBtn.parentNode) {
      newCancelBtn = this.confirmCancelBtn.cloneNode(true);
      this.confirmCancelBtn.parentNode.replaceChild(newCancelBtn, this.confirmCancelBtn);
    }
    if (this.confirmCloseBtn.parentNode) {
      newCloseBtn = this.confirmCloseBtn.cloneNode(true);
      this.confirmCloseBtn.parentNode.replaceChild(newCloseBtn, this.confirmCloseBtn);
    }
    
    this.confirmConfirmBtn = newConfirmBtn;
    this.confirmCancelBtn = newCancelBtn;
    this.confirmCloseBtn = newCloseBtn;

    // 정리 함수
    const cleanup = () => {
      this.confirmDialog.style.display = 'none';
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('click', clickOutsideHandler);
    };

    // 확인 버튼
    this.confirmConfirmBtn.addEventListener('click', () => {
      cleanup();
      if (onConfirm) onConfirm();
    });

    // 취소/닫기 버튼
    const cancelHandler = () => {
      cleanup();
      if (onCancel) onCancel();
    };
    this.confirmCancelBtn.addEventListener('click', cancelHandler);
    this.confirmCloseBtn.addEventListener('click', cancelHandler);

    // 키보드 이벤트
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cleanup();
        if (onConfirm) onConfirm();
      } else if (e.key === 'Escape') {
        cleanup();
        if (onCancel) onCancel();
      }
    };
    document.addEventListener('keydown', keyHandler);

    // 다이얼로그 외부 클릭
    const clickOutsideHandler = (e) => {
      if (e.target === this.confirmDialog) {
        cleanup();
        if (onCancel) onCancel();
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    // 확인 버튼에 포커스
    this.confirmConfirmBtn.focus();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (this.colorPicker) {
      this.setupColorPicker();
    }
    
    if (this.advancedDialog) {
      this.setupAdvancedDialog();
    }
    
    if (this.contextMenu) {
      this.setupContextMenu();
    }
    
    // 외부 클릭으로 컨텍스트 메뉴 닫기
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
  }

  /**
   * 색상 선택기 설정
   */
  setupColorPicker() {
    const colorOptions = this.colorPicker.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 이전 선택 해제
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        
        // 새 선택 설정
        option.classList.add('selected');
        this.selectedColor = option.dataset.color;
      });
    });
  }

  /**
   * 고급 다이얼로그 설정
   */
  setupAdvancedDialog() {
    // 탭 전환
    const tabHeaders = this.advancedDialog.querySelectorAll('.tab-header');
    const tabContents = this.advancedDialog.querySelectorAll('.tab-content');
    
    tabHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const tabId = header.dataset.tab;
        
        // 모든 탭 비활성화
        tabHeaders.forEach(h => h.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // 선택된 탭 활성화
        header.classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
        
        // 탭별 데이터 로드
        this.loadTabContent(tabId);
      });
    });
    
    // 닫기 버튼
    this.advancedCloseButton?.addEventListener('click', () => {
      this.hideAdvancedDialog();
    });
  }

  /**
   * 컨텍스트 메뉴 설정
   */
  setupContextMenu() {
    const editGroup = this.contextMenu.querySelector('#edit-group');
    const changeColor = this.contextMenu.querySelector('#change-group-color');
    const viewStats = this.contextMenu.querySelector('#view-group-stats');
    const deleteGroup = this.contextMenu.querySelector('#delete-group');
    
    editGroup?.addEventListener('click', () => {
      if (this.currentEditingGroup) {
        this.showEditDialog(this.currentEditingGroup);
      }
      this.hideContextMenu();
    });
    
    changeColor?.addEventListener('click', () => {
      if (this.currentEditingGroup) {
        this.showColorChangeDialog(this.currentEditingGroup);
      }
      this.hideContextMenu();
    });
    
    viewStats?.addEventListener('click', () => {
      if (this.currentEditingGroup) {
        this.showGroupStatistics(this.currentEditingGroup.id);
      }
      this.hideContextMenu();
    });
    
    deleteGroup?.addEventListener('click', () => {
      if (this.currentEditingGroup) {
        this.confirmDelete(this.currentEditingGroup);
      }
      this.hideContextMenu();
    });
  }

  /**
   * 다이얼로그 요소들 찾기
   */
  findDialogElements() {
    // 기본 그룹 다이얼로그
    this.dialog = document.getElementById('group-dialog');
    this.titleElement = document.getElementById('group-dialog-title');
    this.inputElement = document.getElementById('group-name-input');
    this.saveButton = document.getElementById('group-dialog-save');
    this.cancelButton = document.getElementById('group-dialog-cancel');
    this.closeButton = document.getElementById('group-dialog-close');
    this.colorPicker = document.getElementById('color-picker');
    
    // 고급 그룹 관리 다이얼로그
    this.advancedDialog = document.getElementById('advanced-group-dialog');
    this.advancedCloseButton = document.getElementById('advanced-group-close');
    
    // 컨텍스트 메뉴
    this.contextMenu = document.getElementById('group-context-menu');
    
    // 커스텀 확인 다이얼로그
    this.confirmDialog = document.getElementById('confirm-dialog');
    this.confirmTitle = document.getElementById('confirm-dialog-title');
    this.confirmMessage = document.getElementById('confirm-dialog-message');
    this.confirmConfirmBtn = document.getElementById('confirm-dialog-confirm');
    this.confirmCancelBtn = document.getElementById('confirm-dialog-cancel');
    this.confirmCloseBtn = document.getElementById('confirm-dialog-close');
    
    this.setupEventListeners();
  }

  /**
   * 그룹 추가 다이얼로그 표시
   */
  showAddDialog() {
    if (!this.dialog) return;

    this.titleElement.textContent = '그룹 추가';
    this.inputElement.value = '';
    this.inputElement.placeholder = '그룹명을 입력하세요';
    this.selectedColor = null;
    
    // 첫 번째 색상을 기본으로 선택
    const firstColor = this.colorPicker?.querySelector('.color-option');
    if (firstColor) {
      firstColor.click();
    }
    
    this.showDialog((groupName) => {
      if (groupName.trim()) {
        const group = this.groupService.createGroup(groupName.trim());
        if (group && this.selectedColor) {
          this.groupService.updateGroup(group.id, { color: this.selectedColor });
        }
      }
    });
  }

  /**
   * 그룹 수정 다이얼로그 표시
   * @param {Object} group - 수정할 그룹 객체
   */
  showEditDialog(group) {
    if (!this.dialog || !group) return;

    this.titleElement.textContent = '그룹 수정';
    this.inputElement.value = group.name;
    this.inputElement.placeholder = '그룹명을 입력하세요';
    this.selectedColor = group.color;
    
    // 현재 그룹 색상 선택
    const colorOptions = this.colorPicker?.querySelectorAll('.color-option');
    colorOptions?.forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.color === group.color) {
        option.classList.add('selected');
      }
    });
    
    this.showDialog((groupName) => {
      const updates = {};
      
      if (groupName.trim() && groupName.trim() !== group.name) {
        updates.name = groupName.trim();
      }
      
      if (this.selectedColor && this.selectedColor !== group.color) {
        updates.color = this.selectedColor;
      }
      
      if (Object.keys(updates).length > 0) {
        this.groupService.updateGroup(group.id, updates);
      }
    });
  }

  /**
   * 다이얼로그 표시 및 이벤트 처리
   * @param {Function} onSave - 저장 콜백 함수
   */
  showDialog(onSave) {
    if (!this.dialog) return;

    // Input 상태 완전 초기화
    this.resetInputElement();

    // 다이얼로그 표시
    this.dialog.style.display = 'flex';
    this.inputElement.focus();
    this.inputElement.select();

    // 기존 이벤트 리스너 제거 (클로닝으로)
    const newSaveButton = this.saveButton.cloneNode(true);
    const newCancelButton = this.cancelButton.cloneNode(true);
    const newCloseButton = this.closeButton.cloneNode(true);
    const newInputElement = this.inputElement.cloneNode(true);
    
    this.saveButton.parentNode.replaceChild(newSaveButton, this.saveButton);
    this.cancelButton.parentNode.replaceChild(newCancelButton, this.cancelButton);
    this.closeButton.parentNode.replaceChild(newCloseButton, this.closeButton);
    this.inputElement.parentNode.replaceChild(newInputElement, this.inputElement);
    
    this.saveButton = newSaveButton;
    this.cancelButton = newCancelButton;
    this.closeButton = newCloseButton;
    this.inputElement = newInputElement;

    // Input 다시 초기화 및 포커스
    this.resetInputElement();
    this.inputElement.focus();
    this.inputElement.select();

    // 정리 함수
    const cleanup = () => {
      this.resetInputElement(); // cleanup 시에도 input 초기화
      this.dialog.style.display = 'none';
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('click', clickOutsideHandler);
    };

    // 저장 버튼
    this.saveButton.addEventListener('click', () => {
      onSave(this.inputElement.value);
      cleanup();
    });

    // 취소/닫기 버튼
    const cancelHandler = () => cleanup();
    this.cancelButton.addEventListener('click', cancelHandler);
    this.closeButton.addEventListener('click', cancelHandler);

    // 키보드 이벤트
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(this.inputElement.value);
        cleanup();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    };
    document.addEventListener('keydown', keyHandler);

    // 다이얼로그 외부 클릭
    const clickOutsideHandler = (e) => {
      if (e.target === this.dialog) {
        cleanup();
      }
    };
    document.addEventListener('click', clickOutsideHandler);
  }

  /**
   * 그룹 삭제 확인 다이얼로그
   * @param {Object} group - 삭제할 그룹 객체
   */
  confirmDelete(group) {
    if (!group) return;

    const processCount = group.processIds.length;
    let message = `그룹 '${group.name}'을 삭제하시겠습니까?`;
    
    if (processCount > 0) {
      message += `\n\n⚠️ 이 그룹에는 ${processCount}개의 프로세스가 있습니다.\n삭제하면 프로세스들이 그룹에서 제거됩니다.`;
    }

    // 커스텀 확인 다이얼로그 사용
    this.showCustomConfirm(
      '그룹 삭제 확인',
      message,
      () => {
        // 확인 버튼 클릭 시
        const force = processCount > 0;
        this.groupService.deleteGroup(group.id, force);
        
        // 삭제 후 상태 정리
        setTimeout(() => {
          this.resetAllDialogStates();
        }, 50);
      },
      () => {
        // 취소 버튼 클릭 시 (아무것도 하지 않음)
      }
    );
  }

  /**
   * 그룹 색상 변경 다이얼로그 (모던 UI 버전)
   * @param {Object} group - 색상을 변경할 그룹 객체
   */
  showColorChangeDialog(group) {
    if (!group) return;

    this.titleElement.textContent = `${group.name} 색상 변경`;
    this.inputElement.value = group.name;
    this.inputElement.readOnly = true;
    this.selectedColor = group.color;
    
    // 현재 그룹 색상 선택
    const colorOptions = this.colorPicker?.querySelectorAll('.color-option');
    colorOptions?.forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.color === group.color) {
        option.classList.add('selected');
      }
    });
    
    this.showDialog(() => {
      if (this.selectedColor && this.selectedColor !== group.color) {
        this.groupService.updateGroup(group.id, { color: this.selectedColor });
      }
      // readOnly 해제는 resetInputElement에서 처리됨
    });
  }

  /**
   * 그룹 컨텍스트 메뉴 표시
   * @param {Object} group - 그룹 객체
   * @param {number} x - 마우스 X 좌표
   * @param {number} y - 마우스 Y 좌표
   */
  showContextMenu(group, x, y) {
    if (!this.contextMenu || !group) return;
    
    this.currentEditingGroup = group;
    
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.display = 'block';
    
    // 화면 경계 조정
    const rect = this.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = `${y - rect.height}px`;
    }
  }

  /**
   * 컨텍스트 메뉴 숨기기
   */
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
      this.currentEditingGroup = null;
    }
  }

  /**
   * 고급 그룹 관리 다이얼로그 표시
   */
  showAdvancedDialog() {
    if (!this.advancedDialog) return;
    
    this.advancedDialog.style.display = 'flex';
    
    // 첫 번째 탭 활성화
    const firstTab = this.advancedDialog.querySelector('.tab-header');
    if (firstTab) {
      firstTab.click();
    }
  }

  /**
   * 고급 다이얼로그 숨기기
   */
  hideAdvancedDialog() {
    if (this.advancedDialog) {
      this.advancedDialog.style.display = 'none';
    }
  }

  /**
   * 탭 콘텐츠 로드
   * @param {string} tabId - 탭 ID
   */
  loadTabContent(tabId) {
    switch (tabId) {
      case 'groups':
        this.loadGroupsTab();
        break;
      case 'statistics':
        this.loadStatisticsTab();
        break;
      case 'import-export':
        this.loadImportExportTab();
        break;
    }
  }

  /**
   * 그룹 목록 탭 로드
   */
  loadGroupsTab() {
    const container = document.getElementById('advanced-groups-list');
    const header = this.advancedDialog.querySelector('.group-list-header h4');
    
    if (!container || !header) return;
    
    const groups = this.groupStore.getAllGroups();
    header.textContent = `전체 그룹 (${groups.length}개)`;
    
    container.innerHTML = '';
    
    if (groups.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">생성된 그룹이 없습니다.</p>';
      return;
    }
    
    groups.forEach((group, index) => {
      const stats = this.groupService.getGroupStatistics(group.id);
      const item = document.createElement('div');
      item.className = 'advanced-group-item';
      item.innerHTML = `
        <div class="group-color-indicator" style="background-color: ${group.color}"></div>
        <div class="group-info">
          <div class="group-name">${group.name}</div>
          <div class="group-details">
            프로세스: ${stats?.totalProcesses || 0}개 | 
            연결됨: ${stats?.connectedProcesses || 0}개 | 
            생성일: ${group.createdAt.toLocaleDateString()}
          </div>
        </div>
        <div class="group-item-actions">
          <button class="btn-icon-small btn-secondary" title="위로 이동" data-action="move-up" ${index === 0 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
            ▲
          </button>
          <button class="btn-icon-small btn-secondary" title="아래로 이동" data-action="move-down" ${index === groups.length - 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
            ▼
          </button>
          <button class="btn-icon-small btn-secondary" title="수정" data-action="edit">
            ✏️
          </button>
          <button class="btn-icon-small btn-secondary" title="색상 변경" data-action="color">
            🎨
          </button>
          <button class="btn-icon-small btn-secondary" title="통계" data-action="stats">
            📊
          </button>
          <button class="btn-icon-small btn-danger" title="삭제" data-action="delete">
            🗑️
          </button>
        </div>
      `;
      
      // 액션 버튼 이벤트
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          
          switch (action) {
            case 'move-up':
              this.groupService.moveGroup(group.id, 'up');
              this.loadGroupsTab();
              break;
            case 'move-down':
              this.groupService.moveGroup(group.id, 'down');
              this.loadGroupsTab();
              break;
            case 'edit':
              this.hideAdvancedDialog();
              this.showEditDialog(group);
              break;
            case 'color':
              this.hideAdvancedDialog();
              this.showColorChangeDialog(group);
              break;
            case 'stats':
              this.showGroupStatistics(group.id);
              break;
            case 'delete':
              this.confirmDelete(group);
              break;
          }
        });
      });
      
      container.appendChild(item);
    });
    
    // 빈 그룹 정리 버튼 이벤트
    const cleanupBtn = document.getElementById('cleanup-empty-groups');
    const createBtn = document.getElementById('create-new-group');
    
    if (cleanupBtn) {
      cleanupBtn.onclick = () => this.cleanupEmptyGroups();
    }
    
    if (createBtn) {
      createBtn.onclick = () => {
        this.hideAdvancedDialog();
        this.showAddDialog();
      };
    }
  }

  /**
   * 통계 탭 로드
   */
  loadStatisticsTab() {
    const container = document.getElementById('group-statistics');
    if (!container) return;
    
    const stats = this.groupService.getOverallStatistics();
    
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-value">${stats.totalGroups}</div>
          <div class="stat-label">전체 그룹</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${stats.activeGroups}</div>
          <div class="stat-label">활성 그룹</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${stats.emptyGroups}</div>
          <div class="stat-label">빈 그룹</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalProcesses}</div>
          <div class="stat-label">전체 프로세스</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-value">${stats.groupedProcesses}</div>
          <div class="stat-label">그룹 소속</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${stats.ungroupedProcesses}</div>
          <div class="stat-label">그룹 없음</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.averageProcessesPerGroup}</div>
          <div class="stat-label">그룹당 평균</div>
        </div>
      </div>
      
      <h4>그룹별 상세 통계</h4>
      <div id="detailed-stats">
        ${this.generateDetailedStats()}
      </div>
    `;
  }

  /**
   * 상세 통계 생성
   */
  generateDetailedStats() {
    const groups = this.groupStore.getAllGroups();
    if (groups.length === 0) {
      return '<p style="color: #6b7280;">생성된 그룹이 없습니다.</p>';
    }
    
    return groups.map(group => {
      const stats = this.groupService.getGroupStatistics(group.id);
      return `
        <div class="advanced-group-item">
          <div class="group-color-indicator" style="background-color: ${group.color}"></div>
          <div class="group-info">
            <div class="group-name">${group.name}</div>
            <div class="group-details">
              총 ${stats?.totalProcesses || 0}개 프로세스 | 
              연결됨 ${stats?.connectedProcesses || 0}개 | 
              ezHelp ${stats?.ezhelpProcesses || 0}개 | 
              TeamViewer ${stats?.teamviewerProcesses || 0}개
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 가져오기/내보내기 탭 로드
   */
  loadImportExportTab() {
    const exportBtn = document.getElementById('export-groups');
    const importBtn = document.getElementById('import-groups');
    
    if (exportBtn) {
      exportBtn.onclick = () => this.exportGroups();
    }
    
    if (importBtn) {
      importBtn.onclick = () => this.importGroups();
    }
  }

  /**
   * 그룹 통계 표시
   * @param {string} groupId - 그룹 ID
   */
  showGroupStatistics(groupId) {
    const stats = this.groupService.getGroupStatistics(groupId);
    const group = this.groupStore.getGroup(groupId);
    
    if (!stats || !group) return;

    const message = `
그룹 '${group.name}' 통계:

📊 전체 프로세스: ${stats.totalProcesses}개
🟢 연결됨: ${stats.connectedProcesses}개
🔴 끊어짐: ${stats.disconnectedProcesses}개

💻 ezHelp: ${stats.ezhelpProcesses}개
🖥️ TeamViewer: ${stats.teamviewerProcesses}개

🏷️ 라벨 있음: ${stats.processesWithLabels}개
🎯 카테고리 있음: ${stats.processesWithCategories}개
    `.trim();

    alert(message);
  }

  /**
   * 빈 그룹들 정리
   */
  cleanupEmptyGroups() {
    const emptyGroups = this.groupService.getEmptyGroups();
    
    if (emptyGroups.length === 0) {
      alert('정리할 빈 그룹이 없습니다.');
      return;
    }

    const groupNames = emptyGroups.map(g => g.name).join(', ');
    const message = `다음 빈 그룹들을 삭제하시겠습니까?\n\n${groupNames}`;

    // 커스텀 확인 다이얼로그 사용
    this.showCustomConfirm(
      '빈 그룹 정리',
      message,
      () => {
        // 확인 버튼 클릭 시
        const deletedCount = this.groupService.cleanupEmptyGroups();
        if (deletedCount > 0) {
          alert(`${deletedCount}개의 빈 그룹이 정리되었습니다.`);
        }
      }
    );
  }

  /**
   * 전체 그룹 통계 표시
   */
  showOverallStatistics() {
    const stats = this.groupService.getOverallStatistics();
    
    const message = `
전체 그룹 통계:

📁 전체 그룹: ${stats.totalGroups}개
✅ 활성 그룹: ${stats.activeGroups}개
❌ 빈 그룹: ${stats.emptyGroups}개

💻 전체 프로세스: ${stats.totalProcesses}개
📁 그룹 소속: ${stats.groupedProcesses}개
🆓 그룹 없음: ${stats.ungroupedProcesses}개

📊 그룹당 평균: ${stats.averageProcessesPerGroup}개
    `.trim();

    alert(message);
  }

  /**
   * 그룹 데이터 내보내기
   */
  exportGroups() {
    const data = this.groupService.exportGroups();
    if (!data) return;

    // JSON 데이터를 다운로드 가능한 형태로 변환
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `remotemanager-groups-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 그룹 데이터 가져오기
   */
  importGroups() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const success = this.groupService.importGroups(data);
          
          if (success) {
            alert('그룹 데이터를 성공적으로 가져왔습니다.');
          } else {
            alert('그룹 데이터 가져오기에 실패했습니다.');
          }
        } catch (error) {
          alert('잘못된 파일 형식입니다.');
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }
}