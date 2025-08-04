/**
 * ProcessList - 프로세스 목록 렌더링 컴포넌트
 * 프로세스 목록 표시, 필터링, 정렬, 상호작용 관리
 */

import { KeyManager } from '../services/KeyManager.js';

export class ProcessList {
  constructor(container, processService, groupService, notificationService) {
    this.container = container;
    this.processService = processService;
    this.groupService = groupService;
    this.notificationService = notificationService;
    
    this.processes = [];
    this.filteredProcesses = [];
    this.sortOption = 'latest';
    this.groupFilter = '';
    this.categoryFilter = '';
    this.typeFilter = '';
    
    this.categories = {
      'xray': { name: '엑스레이', color: '#e3f2fd', borderColor: '#2196f3' },
      'other-server': { name: '타서버', color: '#fff3e0', borderColor: '#ff9800' },
      'new-server': { name: '새서버', color: '#f3e5f5', borderColor: '#9c27b0' },
      'old-server': { name: '구서버', color: '#fce4ec', borderColor: '#e91e63' }
    };

    // 커스텀 확인 다이얼로그 요소들
    this.confirmDialog = null;
    this.confirmTitle = null;
    this.confirmMessage = null;
    this.confirmConfirmBtn = null;
    this.confirmCancelBtn = null;
    this.confirmCloseBtn = null;

    this.setupEventListeners();
    this.findConfirmDialogElements();
  }

  /**
   * 커스텀 확인 다이얼로그 요소들 찾기
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
   * @param {Function} onCancel - 취소 버튼 클릭 시 콜백
   */
  showCustomConfirm(title, message, onConfirm, onCancel = null) {
    // 다시 요소들을 찾기 (DOM이 변경되었을 수 있음)
    this.findConfirmDialogElements();
    
    if (!this.confirmDialog || !this.confirmTitle || !this.confirmMessage || 
        !this.confirmConfirmBtn || !this.confirmCancelBtn || !this.confirmCloseBtn) {
      console.warn('커스텀 확인 다이얼로그 요소를 찾을 수 없습니다. 기본 confirm 사용');
      if (confirm(message.replace(/<[^>]*>/g, ''))) { // HTML 태그 제거
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

    // 기존 이벤트 리스너 제거 (클로닝으로)
    const newConfirmBtn = this.confirmConfirmBtn.cloneNode(true);
    const newCancelBtn = this.confirmCancelBtn.cloneNode(true);
    const newCloseBtn = this.confirmCloseBtn.cloneNode(true);
    
    this.confirmConfirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmConfirmBtn);
    this.confirmCancelBtn.parentNode.replaceChild(newCancelBtn, this.confirmCancelBtn);
    this.confirmCloseBtn.parentNode.replaceChild(newCloseBtn, this.confirmCloseBtn);
    
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
        e.preventDefault();
        cleanup();
        if (onCancel) onCancel();
      }
    };
    document.addEventListener('keydown', keyHandler);

    // 다이얼로그 외부 클릭 시 닫기
    const clickOutsideHandler = (e) => {
      if (e.target === this.confirmDialog) {
        cleanup();
        if (onCancel) onCancel();
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    // 첫 번째 버튼에 포커스
    this.confirmConfirmBtn.focus();
  }

  /**
   * 프로세스 목록 렌더링
   * @param {Array} processes - 프로세스 배열
   */
  render(processes) {
    this.processes = processes || [];
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 필터링 및 정렬 적용
   */
  applyFiltersAndSort() {
    let filtered = [...this.processes];

    // 그룹 필터 적용
    if (this.groupFilter) {
      if (this.groupFilter === 'ungrouped') {
        filtered = filtered.filter(p => !p.groupId);
      } else {
        filtered = filtered.filter(p => p.groupId === this.groupFilter);
      }
    }

    // 카테고리 필터 적용
    if (this.categoryFilter) {
      if (this.categoryFilter === 'uncategorized') {
        filtered = filtered.filter(p => !p.category);
      } else {
        filtered = filtered.filter(p => p.category === this.categoryFilter);
      }
    }


    // 타입 필터 적용
    if (this.typeFilter) {
      filtered = filtered.filter(p => p.type === this.typeFilter);
    }

    // 정렬 적용
    filtered = this.sortProcesses(filtered);

    this.filteredProcesses = filtered;
  }

  /**
   * 프로세스 정렬
   * @param {Array} processes - 정렬할 프로세스 배열
   * @returns {Array} 정렬된 프로세스 배열
   */
  sortProcesses(processes) {
    switch (this.sortOption) {
      case 'group':
        return processes.sort((a, b) => {
          const groupA = a.groupId || 'zzz_ungrouped';
          const groupB = b.groupId || 'zzz_ungrouped';
          return groupA.localeCompare(groupB);
        });

      case 'category':
        return processes.sort((a, b) => {
          const catA = a.category || 'zzz_uncategorized';
          const catB = b.category || 'zzz_uncategorized';
          return catA.localeCompare(catB);
        });

      case 'latest':
      default:
        return processes.sort((a, b) => {
          // 최신순: 생성 시간 기준 내림차순 (최신이 위로)
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }
  }

  /**
   * 프로세스 목록 HTML 렌더링
   */
  renderProcessList() {
    if (this.filteredProcesses.length === 0) {
      this.container.innerHTML = '<div class="no-processes">표시할 프로세스가 없습니다.</div>';
      return;
    }

    const html = this.filteredProcesses.map(process => 
      this.renderProcessItem(process)
    ).join('');

    this.container.innerHTML = html;
    this.attachItemEventListeners();
  }

  /**
   * 개별 프로세스 아이템 렌더링
   * @param {Object} process - 프로세스 객체
   * @returns {string} HTML 문자열
   */
  renderProcessItem(process) {
    const displayName = this.getDisplayName(process);
    const statusIcon = this.getStatusIcon(process);
    const categoryClass = process.category ? `category-${process.category}` : '';
    const categoryStyle = this.getCategoryStyle(process.category);
    const groupBadge = this.getGroupBadge(process.groupId);
    const connectionTime = this.getConnectionTime(process);
    const groupOptions = this.renderGroupOptions(process.groupId);

    return `
      <div class="process-item ${categoryClass} ${process.status}" 
           data-process-id="${process.id}" 
           style="${categoryStyle}">
        
        <div class="process-header">
          <div class="process-badges">
            ${groupBadge}
            ${this.getCategoryBadge(process.category)}
          </div>
          
          <div class="process-info">
            <div class="process-name" title="${process.windowTitle}">
              ${displayName}
            </div>
            <div class="process-details">
              <span class="process-type ${process.type.toLowerCase()}">${process.type.toUpperCase()}</span>
              <span class="process-pid">PID: ${process.pid}</span>
              ${connectionTime ? `<span class="connection-time">${connectionTime}</span>` : ''}
            </div>
          </div>

          <div class="process-status">
            <span class="status-icon" title="${this.getStatusText(process.status)}">${statusIcon}</span>
            ${process.isMinimized ? '<span class="minimized-indicator" title="최소화됨">🔽</span>' : ''}
            ${process.isHidden ? '<span class="hidden-indicator" title="숨김">👁️‍🗨️</span>' : ''}
          </div>
        </div>

        <div class="process-actions">
          <div class="action-row-1">
            <button class="btn btn-sm btn-primary" data-action="copy" title="정보 복사">
              📋 복사
            </button>
            <button class="btn btn-sm btn-secondary" data-action="focus" title="창 포커스">
              🎯 포커스
            </button>
            <button class="btn btn-sm btn-outline" data-action="edit-label" title="라벨 편집">
              ✏️ 편집
            </button>
          </div>
          
          <div class="action-row-2">
            <select class="form-select form-select-sm group-select" data-action="group-change" title="그룹 선택">
              ${groupOptions}
            </select>
            
            <select class="form-select form-select-sm category-select" data-action="category-change" title="카테고리 선택">
              <option value="">카테고리 없음</option>
              <option value="xray" ${process.category === 'xray' ? 'selected' : ''}>엑스레이</option>
              <option value="other-server" ${process.category === 'other-server' ? 'selected' : ''}>타서버</option>
              <option value="new-server" ${process.category === 'new-server' ? 'selected' : ''}>새서버</option>
              <option value="old-server" ${process.category === 'old-server' ? 'selected' : ''}>구서버</option>
            </select>

            ${process.status !== 'connected' ? 
              '<button class="btn btn-sm btn-danger" data-action="remove" title="완전 삭제">🗑️ 삭제</button>' : 
              ''
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 프로세스 표시명 가져오기
   * @param {Object} process - 프로세스 객체
   * @returns {string} 표시명
   */
  getDisplayName(process) {
    if (process.customLabel) {
      return process.customLabel;
    }
    return KeyManager.getDisplayKey(process);
  }

  /**
   * 상태 아이콘 가져오기
   * @param {Object} process - 프로세스 객체
   * @returns {string} 상태 아이콘
   */
  getStatusIcon(process) {
    switch (process.status) {
      case 'connected': return '🟢';
      case 'reconnected': return '🟡';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  }

  /**
   * 상태 텍스트 가져오기
   * @param {string} status - 상태
   * @returns {string} 상태 텍스트
   */
  getStatusText(status) {
    switch (status) {
      case 'connected': return '연결됨';
      case 'reconnected': return '재연결됨';
      case 'disconnected': return '연결 끊김';
      default: return '알 수 없음';
    }
  }

  /**
   * 카테고리 스타일 가져오기
   * @param {string} category - 카테고리
   * @returns {string} CSS 스타일
   */
  getCategoryStyle(category) {
    if (!category || !this.categories[category]) {
      return '';
    }

    const categoryInfo = this.categories[category];
    return `background-color: ${categoryInfo.color}; border-left-color: ${categoryInfo.borderColor};`;
  }

  /**
   * 카테고리 배지 가져오기
   * @param {string} category - 카테고리
   * @returns {string} HTML 문자열
   */
  getCategoryBadge(category) {
    if (!category || !this.categories[category]) {
      return '';
    }

    const categoryInfo = this.categories[category];
    return `<span class="category-badge" style="background-color: ${categoryInfo.borderColor};">
              ${categoryInfo.name}
            </span>`;
  }

  /**
   * 그룹 배지 가져오기
   * @param {string} groupId - 그룹 ID
   * @returns {string} HTML 문자열
   */
  getGroupBadge(groupId) {
    if (!groupId) {
      return '';
    }

    // 그룹 서비스에서 실제 그룹 정보 가져오기
    const group = this.groupService.groupStore.getGroup(groupId);
    const groupName = group ? group.name : groupId.slice(-8);
    const colorStyle = group && group.color ? `style="background-color: ${group.color};"` : '';
    
    return `<span class="group-badge" ${colorStyle}>${groupName}</span>`;
  }

  /**
   * 연결 시간 정보 가져오기
   * @param {Object} process - 프로세스 객체
   * @returns {string} 연결 시간 문자열
   */
  getConnectionTime(process) {
    if (process.status === 'disconnected' && process.disconnectedAt) {
      const elapsed = Date.now() - process.disconnectedAt.getTime();
      const minutes = Math.floor(elapsed / 60000);
      return `${minutes}분 전 끊김`;
    } else if (process.createdAt) {
      const elapsed = Date.now() - process.createdAt.getTime();
      const minutes = Math.floor(elapsed / 60000);
      if (minutes < 1) {
        return '방금 연결';
      } else if (minutes < 60) {
        return `${minutes}분 연결`;
      } else {
        const hours = Math.floor(minutes / 60);
        return `${hours}시간 연결`;
      }
    }
    return '';
  }

  /**
   * 아이템별 이벤트 리스너 연결
   */
  attachItemEventListeners() {
    const processItems = this.container.querySelectorAll('.process-item');
    
    processItems.forEach(item => {
      const processId = item.dataset.processId;
      
      // 액션 버튼들
      const actionButtons = item.querySelectorAll('[data-action]');
      actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleAction(processId, button.dataset.action, button);
        });
      });

      // 그룹 변경
      const groupSelect = item.querySelector('.group-select');
      if (groupSelect) {
        groupSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          this.handleGroupChange(processId, e.target.value);
        });
      }

      // 카테고리 변경
      const categorySelect = item.querySelector('.category-select');
      if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
          e.stopPropagation();
          this.handleCategoryChange(processId, e.target.value);
        });
      }
    });
  }

  /**
   * 액션 처리
   * @param {string} processId - 프로세스 ID
   * @param {string} action - 액션 타입
   * @param {HTMLElement} element - 액션 요소
   */
  async handleAction(processId, action, element) {
    switch (action) {
      case 'copy':
        await this.processService.copyProcessInfo(processId);
        break;

      case 'focus':
        await this.processService.focusProcess(processId);
        break;

      case 'edit-label':
        this.showLabelEditDialog(processId);
        break;

      case 'remove':
        const process = this.processes.find(p => p.id === processId);
        if (!process) break;
        
        const statusText = this.getStatusText(process.status);
        const displayName = this.getDisplayName(process);
        const message = `<strong>${displayName}</strong><br>상태: ${statusText}<br><br>이 프로세스를 완전히 제거하시겠습니까?<br><small class="text-warning">⚠️ 그룹/카테고리 설정도 함께 삭제됩니다.</small>`;
        
        this.showCustomConfirm(
          '프로세스 완전 삭제 확인',
          message,
          () => {
            // 확인 버튼 클릭 시
            this.processService.removeDisconnectedProcess(processId);
          }
        );
        break;
    }
  }

  /**
   * 그룹 변경 처리
   * @param {string} processId - 프로세스 ID
   * @param {string} groupId - 그룹 ID
   */
  handleGroupChange(processId, groupId) {
    const targetGroupId = groupId || null;
    this.groupService.assignProcessToGroup(processId, targetGroupId);
  }

  /**
   * 카테고리 변경 처리
   * @param {string} processId - 프로세스 ID
   * @param {string} category - 카테고리
   */
  handleCategoryChange(processId, category) {
    const targetCategory = category || null;
    this.processService.setProcessCategory(processId, targetCategory);
  }

  /**
   * 라벨 편집 다이얼로그 표시
   * @param {string} processId - 프로세스 ID
   */
  showLabelEditDialog(processId) {
    const process = this.processes.find(p => p.id === processId);
    if (!process) return;

    const currentLabel = process.customLabel || KeyManager.getDisplayKey(process);
    this.createLabelEditModal(processId, currentLabel);
  }

  /**
   * 라벨 편집 모달 생성
   * @param {string} processId - 프로세스 ID
   * @param {string} currentLabel - 현재 라벨
   */
  createLabelEditModal(processId, currentLabel) {
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('label-edit-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 모달 HTML 생성
    const modalHtml = `
      <div id="label-edit-modal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>프로세스 라벨 편집</h3>
            <button type="button" class="modal-close" aria-label="닫기">&times;</button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label for="label-input">새 라벨:</label>
              <input type="text" 
                     id="label-input" 
                     class="form-control" 
                     value="${this.escapeHtml(currentLabel)}" 
                     placeholder="라벨을 입력하세요..."
                     maxlength="100">
            </div>
            <div class="form-help">
              <small class="text-muted">비워두면 기본 표시명이 사용됩니다.</small>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">취소</button>
            <button type="button" class="btn btn-danger" data-action="reset">기본값으로 초기화</button>
            <button type="button" class="btn btn-primary" data-action="save">저장</button>
          </div>
        </div>
      </div>
    `;

    // DOM에 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 모달 이벤트 리스너 설정
    this.setupModalEventListeners(processId, currentLabel);
    
    // 포커스 설정
    const input = document.getElementById('label-input');
    input.focus();
    input.select();
  }

  /**
   * 모달 이벤트 리스너 설정
   * @param {string} processId - 프로세스 ID
   * @param {string} originalLabel - 원본 라벨
   */
  setupModalEventListeners(processId, originalLabel) {
    const modal = document.getElementById('label-edit-modal');
    const input = document.getElementById('label-input');
    const overlay = modal;

    // 저장 버튼
    const saveBtn = modal.querySelector('[data-action="save"]');
    saveBtn.addEventListener('click', () => {
      this.saveLabelEdit(processId, input.value.trim());
    });

    // 취소 버튼
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    cancelBtn.addEventListener('click', () => {
      this.closeLabelEditModal();
    });

    // 초기화 버튼
    const resetBtn = modal.querySelector('[data-action="reset"]');
    resetBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
    });

    // 닫기 버튼
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      this.closeLabelEditModal();
    });

    // 오버레이 클릭으로 닫기
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeLabelEditModal();
      }
    });

    // 키보드 이벤트
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeLabelEditModal();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveLabelEdit(processId, input.value.trim());
      }
    });
  }

  /**
   * 라벨 편집 저장
   * @param {string} processId - 프로세스 ID
   * @param {string} newLabel - 새 라벨
   */
  saveLabelEdit(processId, newLabel) {
    this.processService.setProcessLabel(processId, newLabel);
    this.closeLabelEditModal();
  }

  /**
   * 라벨 편집 모달 닫기
   */
  closeLabelEditModal() {
    const modal = document.getElementById('label-edit-modal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * HTML 이스케이프
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 그룹 옵션 렌더링
   * @param {string} currentGroupId - 현재 선택된 그룹 ID
   * @returns {string} HTML 옵션 문자열
   */
  renderGroupOptions(currentGroupId) {
    const groups = this.groupService.groupStore.getAllGroups();
    
    let options = '<option value="">그룹 없음</option>';
    
    groups.forEach(group => {
      const selected = group.id === currentGroupId ? 'selected' : '';
      options += `<option value="${group.id}" ${selected}>${group.name}</option>`;
    });
    
    return options;
  }

  /**
   * 그룹 옵션 업데이트
   * @param {Array} groups - 그룹 배열
   */
  updateGroupOptions(groups) {
    const groupSelects = this.container.querySelectorAll('.group-select');
    
    groupSelects.forEach(select => {
      const processId = select.closest('.process-item').dataset.processId;
      const process = this.processes.find(p => p.id === processId);
      const currentGroupId = process?.groupId || '';

      // 기존 옵션 제거 (첫 번째 옵션 제외)
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      // 새 그룹 옵션 추가
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        option.selected = group.id === currentGroupId;
        select.appendChild(option);
      });
    });
  }

  /**
   * 정렬 옵션 설정
   * @param {string} sortOption - 정렬 옵션
   */
  setSortOption(sortOption) {
    this.sortOption = sortOption;
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 그룹 필터 설정
   * @param {string} groupFilter - 그룹 필터
   */
  setGroupFilter(groupFilter) {
    this.groupFilter = groupFilter;
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 카테고리 필터 설정
   * @param {string} categoryFilter - 카테고리 필터
   */
  setCategoryFilter(categoryFilter) {
    this.categoryFilter = categoryFilter;
    this.applyFiltersAndSort();
    this.renderProcessList();
  }


  /**
   * 타입 필터 설정
   * @param {string} typeFilter - 타입 필터
   */
  setTypeFilter(typeFilter) {
    this.typeFilter = typeFilter;
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 모든 필터 초기화
   */
  clearAllFilters() {
    this.groupFilter = '';
    this.categoryFilter = '';
    this.typeFilter = '';
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 복합 필터 설정
   * @param {Object} filters - 필터 객체
   */
  setFilters(filters) {
    if (filters.group !== undefined) this.groupFilter = filters.group;
    if (filters.category !== undefined) this.categoryFilter = filters.category;
    if (filters.type !== undefined) this.typeFilter = filters.type;
    
    this.applyFiltersAndSort();
    this.renderProcessList();
  }

  /**
   * 현재 필터 상태 가져오기
   * @returns {Object} 필터 상태 객체
   */
  getCurrentFilters() {
    return {
      group: this.groupFilter,
      category: this.categoryFilter,
      type: this.typeFilter,
      sort: this.sortOption
    };
  }

  /**
   * 그룹별 프로세스 통계
   * @returns {Object} 그룹별 통계
   */
  getGroupStatistics() {
    const stats = {};
    
    this.processes.forEach(process => {
      const groupId = process.groupId || 'ungrouped';
      
      if (!stats[groupId]) {
        stats[groupId] = {
          total: 0,
          connected: 0,
          disconnected: 0,
          reconnected: 0,
          ezhelp: 0,
          teamviewer: 0
        };
      }
      
      stats[groupId].total++;
      stats[groupId][process.status]++;
      stats[groupId][process.type]++;
    });
    
    return stats;
  }

  /**
   * 카테고리별 프로세스 통계
   * @returns {Object} 카테고리별 통계
   */
  getCategoryStatistics() {
    const stats = {};
    
    this.processes.forEach(process => {
      const category = process.category || 'uncategorized';
      
      if (!stats[category]) {
        stats[category] = {
          total: 0,
          connected: 0,
          disconnected: 0,
          reconnected: 0
        };
      }
      
      stats[category].total++;
      stats[category][process.status]++;
    });
    
    return stats;
  }

  /**
   * 필터링 결과 요약
   * @returns {Object} 필터링 요약 정보
   */
  getFilterSummary() {
    const total = this.processes.length;
    const filtered = this.filteredProcesses.length;
    const hidden = total - filtered;
    
    const statusCounts = {};
    const typeCounts = {};
    
    this.filteredProcesses.forEach(process => {
      statusCounts[process.status] = (statusCounts[process.status] || 0) + 1;
      typeCounts[process.type] = (typeCounts[process.type] || 0) + 1;
    });
    
    return {
      total,
      filtered,
      hidden,
      statusCounts,
      typeCounts,
      hasActiveFilters: this.hasActiveFilters()
    };
  }

  /**
   * 활성 필터가 있는지 확인
   * @returns {boolean} 활성 필터 존재 여부
   */
  hasActiveFilters() {
    return !!(this.groupFilter || 
              this.categoryFilter || 
              this.typeFilter);
  }

  /**
   * 기본 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 드래그 앤 드롭 지원 (향후 구현)
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      // 드래그 앤 드롭 로직 구현
    });
  }

  /**
   * 필터링된 프로세스 수 가져오기
   * @returns {number} 필터링된 프로세스 수
   */
  getFilteredCount() {
    return this.filteredProcesses.length;
  }

  /**
   * 컴포넌트 정리
   */
  cleanup() {
    this.container.innerHTML = '';
    this.processes = [];
    this.filteredProcesses = [];
  }
}