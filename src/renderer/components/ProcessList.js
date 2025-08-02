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
    this.sortOption = 'default';
    this.groupFilter = '';
    this.categoryFilter = '';
    
    this.categories = {
      'xray': { name: '엑스레이', color: '#e3f2fd', borderColor: '#2196f3' },
      'other-server': { name: '타서버', color: '#fff3e0', borderColor: '#ff9800' },
      'new-server': { name: '새서버', color: '#f3e5f5', borderColor: '#9c27b0' },
      'old-server': { name: '구서버', color: '#fce4ec', borderColor: '#e91e63' }
    };

    this.setupEventListeners();
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
      case 'name':
        return processes.sort((a, b) => {
          const nameA = this.getDisplayName(a).toLowerCase();
          const nameB = this.getDisplayName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        });

      case 'pid':
        return processes.sort((a, b) => a.pid - b.pid);

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

      case 'default':
      default:
        return processes.sort((a, b) => {
          // 연결 상태 우선, 그 다음 생성 시간
          if (a.status !== b.status) {
            const statusOrder = { 'connected': 0, 'reconnected': 1, 'disconnected': 2 };
            return statusOrder[a.status] - statusOrder[b.status];
          }
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

    return `
      <div class="process-item ${categoryClass} ${process.status}" 
           data-process-id="${process.id}" 
           style="${categoryStyle}">
        
        <div class="process-header">
          <div class="process-status">
            <span class="status-icon" title="${this.getStatusText(process.status)}">${statusIcon}</span>
            ${process.isMinimized ? '<span class="minimized-indicator" title="최소화됨">🔽</span>' : ''}
            ${process.isHidden ? '<span class="hidden-indicator" title="숨김">👁️‍🗨️</span>' : ''}
          </div>
          
          <div class="process-info">
            <div class="process-name" title="${process.windowTitle}">
              ${displayName}
            </div>
            <div class="process-details">
              <span class="process-type">${process.type.toUpperCase()}</span>
              <span class="process-pid">PID: ${process.pid}</span>
              ${connectionTime ? `<span class="connection-time">${connectionTime}</span>` : ''}
            </div>
          </div>

          <div class="process-badges">
            ${groupBadge}
            ${this.getCategoryBadge(process.category)}
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
              <option value="">그룹 없음</option>
              <!-- 그룹 옵션들이 동적으로 추가됩니다 -->
            </select>
            
            <select class="form-select form-select-sm category-select" data-action="category-change" title="카테고리 선택">
              <option value="">카테고리 없음</option>
              <option value="xray" ${process.category === 'xray' ? 'selected' : ''}>엑스레이</option>
              <option value="other-server" ${process.category === 'other-server' ? 'selected' : ''}>타서버</option>
              <option value="new-server" ${process.category === 'new-server' ? 'selected' : ''}>새서버</option>
              <option value="old-server" ${process.category === 'old-server' ? 'selected' : ''}>구서버</option>
            </select>

            ${process.status === 'disconnected' ? 
              '<button class="btn btn-sm btn-danger" data-action="remove" title="제거">🗑️ 제거</button>' : 
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

    // 그룹 정보는 실제 그룹 서비스에서 가져와야 하지만, 
    // 여기서는 단순화하여 ID만 표시
    return `<span class="group-badge">${groupId.slice(-8)}</span>`;
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
        if (confirm('이 프로세스를 목록에서 제거하시겠습니까?')) {
          this.processService.removeDisconnectedProcess(processId);
        }
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
    const newLabel = prompt('프로세스 라벨 편집:', currentLabel);
    
    if (newLabel !== null && newLabel !== currentLabel) {
      this.processService.setProcessLabel(processId, newLabel);
    }
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