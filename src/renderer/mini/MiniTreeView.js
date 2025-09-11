/**
 * MiniTreeView - 트리 구조 기반 프로세스 목록 컴포넌트
 * 그룹별로 접기/펼치기 가능한 계층 구조로 원격 프로세스 표시
 */

/**
 * 이벤트 에미터 클래스 (간단한 구현)
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

/**
 * MiniTreeView 클래스
 */
export class MiniTreeView extends EventEmitter {
  constructor(container) {
    super();
    this.container = container;
    this.groups = [];
    this.expandedGroups = new Set();
    this.selectedProcessId = null;
    this.processCache = new Map();

    // 기본적으로 모든 그룹을 펼친 상태로 시작
    this.defaultExpanded = true;

    this.initialize();
  }

  /**
   * 컴포넌트 초기화
   */
  initialize() {
    if (!this.container) {
      console.error('TreeView container가 필요합니다.');
      return;
    }

    this.container.className = 'tree-container';
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    this.container.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    this.container.addEventListener('dblclick', (e) => {
      this.handleDoubleClick(e);
    });
  }

  /**
   * 클릭 이벤트 처리
   */
  handleClick(event) {
    const target = event.target.closest('[data-group-id], [data-process-id]');
    if (!target) return;

    event.preventDefault();

    // 그룹 헤더 클릭
    if (target.hasAttribute('data-group-id')) {
      const groupId = target.getAttribute('data-group-id');
      this.toggleGroup(groupId);
      return;
    }

    // 프로세스 노드 클릭
    if (target.hasAttribute('data-process-id')) {
      const processId = target.getAttribute('data-process-id');

      // 액션 버튼 클릭 확인
      const actionBtn = event.target.closest('.action-btn');
      if (actionBtn) {
        if (actionBtn.classList.contains('copy-btn')) {
          this.handleProcessCopy(processId);
        } else if (actionBtn.classList.contains('focus-btn')) {
          this.handleProcessFocus(processId);
        } else if (actionBtn.classList.contains('delete-btn')) {
          this.handleProcessDelete(processId);
        }
        return;
      }

      // 일반 프로세스 선택
      this.selectProcess(processId);
    }
  }

  /**
   * 더블클릭 이벤트 처리
   */
  handleDoubleClick(event) {
    // 프로세스 더블클릭을 먼저 확인 (이벤트 버블링 방지)
    const processTarget = event.target.closest('[data-process-id]');
    if (processTarget) {
      // 프로세스 더블클릭: 즉시 포커스
      event.preventDefault();
      event.stopPropagation(); // 이벤트 버블링 방지
      const processId = processTarget.getAttribute('data-process-id');
      this.handleProcessFocus(processId);
      return; // 그룹 더블클릭 처리 방지
    }

    const groupTarget = event.target.closest('[data-group-id]');
    if (groupTarget) {
      // 그룹 더블클릭: 전체 접기/펼치기 토글
      event.preventDefault();
      this.toggleAllGroups();
    }
  }

  /**
   * 데이터 업데이트
   * @param {Array} groups - 그룹별로 분류된 프로세스 데이터
   */
  async updateData(groups) {
    this.groups = groups;

    // 프로세스 캐시 업데이트
    this.updateProcessCache();

    // 첫 번째 렌더링 시 모든 그룹을 펼친 상태로 설정
    if (this.expandedGroups.size === 0 && this.defaultExpanded) {
      groups.forEach(group => {
        this.expandedGroups.add(group.id);
      });
    }

    await this.render();
  }

  /**
   * 프로세스 캐시 업데이트
   */
  updateProcessCache() {
    this.processCache.clear();
    this.groups.forEach(group => {
      group.processes.forEach(process => {
        this.processCache.set(process.id, process);
      });
    });
  }

  /**
   * 렌더링
   */
  async render() {
    const html = this.generateHTML();
    this.container.innerHTML = html;

    // 렌더링 후 이벤트 바인딩
    this.bindEvents();
  }

  /**
   * HTML 생성
   */
  generateHTML() {
    if (this.groups.length === 0) {
      return '<div class="empty-tree">프로세스가 없습니다.</div>';
    }

    return this.groups.map(group => this.renderGroup(group)).join('');
  }

  /**
   * 그룹 렌더링
   */
  renderGroup(group) {
    const isExpanded = this.expandedGroups.has(group.id);
    const processCount = group.processes.length;
    const colorIndicator = group.color ? `<div class="group-color-indicator" style="background-color: ${group.color};"></div>` : '';

    const groupHeader = `
      <div class="group-header ${isExpanded ? 'expanded' : ''}" 
           data-group-id="${group.id}">
        ${colorIndicator}
        <div class="group-toggle ${isExpanded ? 'expanded' : ''}">▶</div>
        <div class="group-name">${this.escapeHtml(group.name)}</div>
        <div class="group-count">${processCount}</div>
      </div>
    `;

    const groupChildren = `
      <div class="group-children ${isExpanded ? '' : 'collapsed'}" 
           data-group-id="${group.id}-children">
        ${group.processes.map(process => this.renderProcess(process)).join('')}
      </div>
    `;

    return `
      <div class="tree-group" data-group-id="${group.id}">
        ${groupHeader}
        ${groupChildren}
      </div>
    `;
  }

  /**
   * 프로세스 렌더링
   */
  renderProcess(process) {
    const isSelected = this.selectedProcessId === process.id;
    const statusIcon = this.getStatusIcon(process.status);
    const processType = this.getProcessTypeLabel(process.type);
    const categoryClass = this.getCategoryClass(process.category);
    const deleteButton = process.status === 'disconnected' ?
      `<button class="action-btn delete-btn" title="삭제">🗑️</button>` : '';

    return `
      <div class="process-node ${categoryClass} ${isSelected ? 'selected' : ''}" 
           data-process-id="${process.id}">
        <div class="process-status ${this.getStatusClass(process.status)}">
          ${statusIcon}
        </div>
        <div class="process-info">
          <div class="process-title">
            <span class="process-type ${process.type?.toLowerCase()}">${processType}</span>
            <span class="process-name">${this.formatProcessName(process)}</span>
          </div>
          <div class="process-details">
            ${this.formatProcessDetails(process)}
          </div>
        </div>
        <div class="process-actions">
          <button class="action-btn copy-btn" title="IP 복사">📋</button>
          <button class="action-btn focus-btn" title="포커스">🎯</button>
          ${deleteButton}
        </div>
      </div>
    `;
  }

  /**
   * 상태 아이콘 반환
   */
  getStatusIcon(status) {
    switch (status) {
      default: return ''; // 흰색 원 완전 제거
    }
  }

  /**
   * 상태 클래스 반환
   */
  getStatusClass(status) {
    switch (status) {
      case 'connected': return 'connected';
      case 'disconnected': return 'disconnected';
      default: return 'unknown';
    }
  }

  /**
   * 프로세스 타입 라벨 반환
   */
  getProcessTypeLabel(type) {
    // 대소문자 구분 없이 처리
    const normalizedType = type?.toLowerCase();
    switch (normalizedType) {
      case 'ezhelp': return 'EZ';
      case 'teamviewer': return 'TV';
      default: return '??';
    }
  }

  /**
   * 카테고리 클래스 반환
   */
  getCategoryClass(category) {
    if (!category) return 'category-uncategorized';
    const normalizedCategory = category.toLowerCase().replace(/[_\s]/g, '-');
    return `category-${normalizedCategory}`;
  }

  /**
   * 프로세스 이름 포맷팅
   */
  formatProcessName(process) {
    let name = process.computerName || 'Unknown';

    // 다중 세션 번호 추가
    if (process.multipleId && process.multipleId > 1) {
      name += ` #${process.multipleId}`;
    }

    return this.escapeHtml(name);
  }

  /**
   * 프로세스 상세 정보 포맷팅
   */
  formatProcessDetails(process) {
    const details = [];

    // 대소문자 구분 없이 프로세스 타입 확인
    const normalizedType = process.type?.toLowerCase();

    if (normalizedType === 'ezhelp' && process.counselorId) {
      // counselorId가 있으면 초록 배경에 흰색 텍스트로 표시
      details.push(`<span class="counselor-id">${process.counselorId}</span>`);
    } else if (normalizedType === 'ezhelp' && process.ip) {
      details.push(`원격번호: ${process.ip}`);
    } else if (normalizedType === 'teamviewer') {
      details.push('원격 종류: TeamViewer');
    } else if (normalizedType === 'ezhelp') {
      details.push('원격 종류: ezHelp');
    } else {
      details.push('원격 종류: 알 수 없음');
    }

    return details.join(' • ');
  }

  /**
   * 그룹 토글
   */
  toggleGroup(groupId) {
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.add(groupId);
    }

    this.updateGroupVisibility(groupId);
  }

  /**
   * 그룹 표시/숨김 업데이트
   */
  updateGroupVisibility(groupId) {
    const header = this.container.querySelector(`[data-group-id="${groupId}"]`);
    const children = this.container.querySelector(`[data-group-id="${groupId}-children"]`);
    const toggle = header?.querySelector('.group-toggle');

    if (!header || !children || !toggle) return;

    const isExpanded = this.expandedGroups.has(groupId);

    if (isExpanded) {
      header.classList.add('expanded');
      toggle.classList.add('expanded');
      children.classList.remove('collapsed');
      children.classList.add('expanding');
    } else {
      header.classList.remove('expanded');
      toggle.classList.remove('expanded');
      children.classList.add('collapsed');
      children.classList.add('collapsing');
    }

    // 애니메이션 클래스 정리
    setTimeout(() => {
      children.classList.remove('expanding', 'collapsing');
    }, 300);
  }

  /**
   * 모든 그룹 펼치기
   */
  expandAll() {
    this.groups.forEach(group => {
      this.expandedGroups.add(group.id);
    });
    this.render();
  }

  /**
   * 모든 그룹 접기
   */
  collapseAll() {
    this.expandedGroups.clear();
    this.render();
  }

  /**
   * 전체 접기/펼치기 토글
   */
  toggleAllGroups() {
    if (this.expandedGroups.size === this.groups.length) {
      this.collapseAll();
    } else {
      this.expandAll();
    }
  }

  /**
   * 프로세스 선택
   */
  selectProcess(processId) {
    // 이전 선택 해제
    const prevSelected = this.container.querySelector('.process-node.selected');
    if (prevSelected) {
      prevSelected.classList.remove('selected');
    }

    // 새로운 선택
    const newSelected = this.container.querySelector(`[data-process-id="${processId}"]`);
    if (newSelected) {
      newSelected.classList.add('selected');
      this.selectedProcessId = processId;
      this.emit('process-selected', processId);
    }
  }

  /**
   * 프로세스 포커스 처리
   */
  handleProcessFocus(processId) {
    this.selectProcess(processId);
    this.emit('process-focus', processId);
  }

  /**
   * 프로세스 복사 처리
   */
  handleProcessCopy(processId) {
    this.selectProcess(processId);
    this.emit('process-copy', processId);
  }

  handleProcessDelete(processId) {
    this.selectProcess(processId);
    this.emit('process-delete', processId);
  }


  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 현재는 상위 레벨에서 이벤트 위임으로 처리하므로 별도 바인딩 불필요
  }

  /**
   * HTML 이스케이프
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * ID로 프로세스 찾기
   */
  getProcessById(processId) {
    return this.processCache.get(processId) || null;
  }

  /**
   * 현재 선택된 프로세스 반환
   */
  getSelectedProcess() {
    return this.getProcessById(this.selectedProcessId);
  }

  /**
   * 그룹 상태 저장
   */
  saveState() {
    return {
      expandedGroups: Array.from(this.expandedGroups),
      selectedProcessId: this.selectedProcessId
    };
  }

  /**
   * 그룹 상태 복원
   */
  restoreState(state) {
    if (state.expandedGroups) {
      this.expandedGroups = new Set(state.expandedGroups);
    }

    if (state.selectedProcessId) {
      this.selectedProcessId = state.selectedProcessId;
    }

    this.render();
  }

  /**
   * 컴포넌트 정리
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.removeEventListener('click', this.handleClick);
      this.container.removeEventListener('dblclick', this.handleDoubleClick);
    }

    this.groups = [];
    this.expandedGroups.clear();
    this.processCache.clear();
    this.events = {};
  }
}