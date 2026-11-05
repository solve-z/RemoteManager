/**
 * MiniTreeView - 트리 구조 기반 프로세스 목록 컴포넌트
 * 그룹별로 접기/펼치기 가능한 계층 구조로 원격 프로세스 표시
 */

import { KeyManager } from '../services/KeyManager.js';

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

    // 드래그앤드롭 쓰로틀링을 위한 변수들
    this.dragThrottleTime = 50; // 50ms로 줄임 - 더 반응성 좋게
    this.lastDragTime = 0;
    this.pendingDragOperation = null;

    // 미니창 순서 저장소
    this.customOrderStorage = this.loadCustomOrders();

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
    this.container.addEventListener('click', e => {
      this.handleClick(e);
    });

    this.container.addEventListener('dblclick', e => {
      this.handleDoubleClick(e);
    });
  }

  /**
   * 클릭 이벤트 처리
   */
  handleClick(event) {
    // 프로세스 노드 클릭 우선 처리
    const processNode = event.target.closest('[data-process-id]');
    if (processNode) {
      event.preventDefault();
      const processId = processNode.getAttribute('data-process-id');

      // 액션 버튼 클릭 확인
      const actionBtn = event.target.closest('.action-btn');
      if (actionBtn) {
        event.stopPropagation(); // 이벤트 전파 방지
        console.log('🎯 액션 버튼 클릭:', actionBtn.className, processId);

        if (actionBtn.classList.contains('edit-process-btn')) {
          this.handleProcessEdit(processId);
        } else if (actionBtn.classList.contains('move-up-btn')) {
          this.handleProcessMoveUp(processId);
        } else if (actionBtn.classList.contains('move-down-btn')) {
          this.handleProcessMoveDown(processId);
        } else if (actionBtn.classList.contains('delete-btn')) {
          this.handleProcessDelete(processId);
        }
        return;
      }

      // 일반 프로세스 선택
      console.log('📝 프로세스 선택:', processId);
      this.selectProcess(processId);
      return;
    }

    // 그룹 헤더 클릭 (고유 식별자로 구분)
    const groupHeader = event.target.closest('[data-is-group-header="true"]');
    if (groupHeader) {
      event.preventDefault();
      const groupId = groupHeader.getAttribute('data-group-id');
      console.log('📁 그룹 헤더 클릭:', groupId);
      this.toggleGroup(groupId);
      return;
    }
    // 프로세스도 아니고 그룹 헤더도 아닌 '빈 영역'을 클릭했을 때
    this.clearSelection();
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
    // 그룹을 order 순서로 확실히 정렬 (단, '그룹없음'은 맨 아래)
    groups.sort((a, b) => {
      if (a.id === 'ungrouped' || a.name === '그룹없음') return 1;
      if (b.id === 'ungrouped' || b.name === '그룹없음') return -1;
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      return orderA - orderB;
    });

    // 현재 펼침 상태를 저장 (그룹 ID 기준)
    const previousExpandedState = new Set(this.expandedGroups);

    this.groups = groups;

    // 프로세스 캐시 업데이트
    this.updateProcessCache();

    // 첫 번째 렌더링 시 모든 그룹을 펼친 상태로 설정
    if (this.expandedGroups.size === 0 && this.defaultExpanded) {
      groups.forEach(group => {
        this.expandedGroups.add(group.id);
      });
    } else {
      // 기존 상태 유지: 새로운 그룹 목록에 있는 그룹 중 이전에 펼쳐져 있던 것들은 계속 펼침
      const newExpandedGroups = new Set();
      groups.forEach(group => {
        if (previousExpandedState.has(group.id)) {
          newExpandedGroups.add(group.id);
        }
      });

      // 새 그룹이 있으면 기본적으로 펼침
      groups.forEach(group => {
        if (!previousExpandedState.has(group.id) && this.defaultExpanded) {
          newExpandedGroups.add(group.id);
        }
      });

      this.expandedGroups = newExpandedGroups;
    }

    // "그룹없음" 그룹은 항상 열린 상태 유지
    groups.forEach(group => {
      if (group.name === '그룹없음' || group.id === 'ungrouped') {
        this.expandedGroups.add(group.id);
      }
    });

    // 저장된 커스텀 순서 적용
    groups.forEach(group => {
      this.applyCustomOrder(group);
    });

    // 오래된 순서 정보 정리 (삭제된 그룹, 존재하지 않는 프로세스)
    this.cleanupOldOrders();

    console.log('📋 그룹 데이터 업데이트:', {
      총그룹수: groups.length,
      펼쳐진그룹: Array.from(this.expandedGroups),
      이전상태: Array.from(previousExpandedState),
    });

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
    // 프로세스가 없어도 빈 트리 구조를 보여줌 (원래창과 동일)
    return this.groups.map(group => this.renderGroup(group)).join('');
  }

  /**
   * 그룹 렌더링
   */
  renderGroup(group) {
    const isExpanded = this.expandedGroups.has(group.id);
    const processCount = group.processes.length;
    const colorIndicator = group.color
      ? `<div class="group-color-indicator" style="background-color: ${group.color};"></div>`
      : '';

    // 그룹없음이 아닌 경우에만 그룹 관리 버튼 표시
    const groupActions =
      group.name !== '그룹없음' && group.id !== 'ungrouped'
        ? `
      <div class="group-actions">
        <button class="group-action-btn edit-group-btn" title="그룹 수정" data-group-id="${group.id}">✏️</button>
        <button class="group-action-btn delete-group-btn" title="그룹 삭제" data-group-id="${group.id}">🗑️</button>
      </div>
    `
        : '';

    const groupHeader = `
      <div class="group-header ${isExpanded ? 'expanded' : ''}"
           data-group-id="${group.id}"
           data-is-group-header="true">
        ${colorIndicator}
        <div class="group-toggle ${isExpanded ? 'expanded' : ''}">▶</div>
        <div class="group-name">${this.escapeHtml(group.name)}</div>
        <div class="group-count">${processCount}</div>
        ${groupActions}
      </div>
    `;

    const groupChildren = `
      <div class="group-children ${isExpanded ? '' : 'collapsed'}"
           data-group-id="${group.id}">
        ${group.processes.map(process => this.renderProcess(process, group)).join('')}
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
  renderProcess(process, group = null) {
    const isSelected = this.selectedProcessId === process.id;
    const statusIcon = this.getStatusIcon(process.status);
    const processType = this.getProcessTypeLabel(process.type);
    const categoryClass = this.getCategoryClass(process.category);
    const deleteButton =
      process.status === 'disconnected'
        ? `<button class="action-btn delete-btn" title="삭제">🗑️</button>`
        : '';

    return `
      <div class="process-node ${categoryClass} ${isSelected ? 'selected' : ''}"
           data-process-id="${process.id}"
           data-group-id="${group?.id || 'ungrouped'}"
           data-group-name="${group?.name || '그룹없음'}"
           draggable="true">
        <div class="process-drag-handle" title="드래그해서 그룹 변경">⋮⋮</div>
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
          <button class="action-btn edit-process-btn" title="프로세스 수정">✏️</button>
          <button class="action-btn move-up-btn" title="위로 이동">🔼</button>
          <button class="action-btn move-down-btn" title="아래로 이동">🔽</button>
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
      default:
        return ''; // 흰색 원 완전 제거
    }
  }

  /**
   * 상태 클래스 반환
   */
  getStatusClass(status) {
    switch (status) {
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  /**
   * 프로세스 타입 라벨 반환
   */
  getProcessTypeLabel(type) {
    // 미니창에서는 축약형 사용 (공간 절약)
    const normalizedType = type?.toLowerCase();
    switch (normalizedType) {
      case 'ezhelp':
        return 'EZ';
      case 'teamviewer':
        return 'TV';
      default:
        return '??';
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
   * 카테고리 표시명 반환
   */
  getCategoryDisplayName(category) {
    if (!category) return '미분류';

    const categoryMap = {
      'old-server': '구서버',
      'new-server': '새서버',
      'x-ray': '엑스레이',
      xray: '엑스레이',
      'other-server': '타서버',
      'another-server': '타서버',
      'external-server': '타서버',
      uncategorized: '미분류',
    };

    const normalizedCategory = category.toLowerCase().replace(/[_\s]/g, '-');
    return categoryMap[normalizedCategory] || category;
  }

  /**
   * 프로세스 이름 포맷팅
   */
  formatProcessName(process) {
    // 기본 정보 생성
    let baseInfo = '';

    // ezHelp인 경우 실시간 데이터로 직접 조합
    if (process.type === 'ezhelp') {
      const computerName = process.computerName;
      const ipAddress = process.ipAddress || process.ip;
      const counselorId = process.counselorId;

      if (counselorId && computerName && ipAddress) {
        baseInfo = `(${counselorId}) ${computerName}[${ipAddress}]`;
      } else if (computerName && ipAddress) {
        baseInfo = `${computerName}[${ipAddress}]`;
      } else if (computerName) {
        baseInfo = computerName;
      } else {
        baseInfo = 'Unknown Process';
      }
    }
    // TeamViewer인 경우
    else if (process.type === 'teamviewer') {
      const computerName = process.computerName;
      if (computerName) {
        baseInfo = `[${computerName}]`;
      } else {
        baseInfo = 'Unknown Process';
      }
    }
    // 기본값
    else {
      baseInfo =
        process.windowTitle || process.processName || 'Unknown Process';
    }

    return this.escapeHtml(baseInfo);
  }

  /**
   * 프로세스 상세 정보 포맷팅
   */
  formatProcessDetails(process) {
    const details = [];

    // 연결 시간이나 다른 유용한 정보가 있으면 표시
    if (process.createdAt) {
      const createdTime = new Date(process.createdAt).toLocaleTimeString();
      details.push(`연결: ${createdTime}`);
    }

    // 카테고리 정보가 있으면 표시 (uncategorized 제외)
    if (process.category && process.category !== 'uncategorized') {
      const categoryDisplayName = this.getCategoryDisplayName(process.category);
      details.push(`📂${categoryDisplayName}`);
    }

    // 라벨 정보
    if (process.customLabel) {
      details.push(`🏷️${process.customLabel}`);
    }

    return details.join(' ');
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
    const groupContainer = this.container.querySelector(
      `.tree-group[data-group-id="${groupId}"]`
    );
    if (!groupContainer) return;

    const header = groupContainer.querySelector('.group-header');
    const children = groupContainer.querySelector('.group-children');
    const toggle = header?.querySelector('.group-toggle');

    if (!header || !children || !toggle) {
      console.warn('그룹 visibility 업데이트 실패 - 요소를 찾을 수 없음:', {
        groupId,
        header: !!header,
        children: !!children,
        toggle: !!toggle,
      });
      return;
    }

    const isExpanded = this.expandedGroups.has(groupId);
    console.log(
      `🔄 그룹 ${groupId} visibility 업데이트:`,
      isExpanded ? '펼침' : '접힘'
    );

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
    const newSelected = this.container.querySelector(
      `[data-process-id="${processId}"]`
    );
    if (newSelected) {
      newSelected.classList.add('selected');
      this.selectedProcessId = processId;
      this.emit('process-selected', processId);
    }
  }

  /**
   * 프로세스 선택 완전히 해제 (빈 공간 클릭 시)
   */
  clearSelection() {
    if (this.selectedProcessId !== null) {
      const prevSelected = this.container.querySelector(
        '.process-node.selected'
      );
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
      this.selectedProcessId = null; // 내부 상태를 완벽히 비움
      this.emit('process-selected', null); // (선택) 부모 컴포넌트에도 알림
      console.log('🧹 빈 영역 클릭: 모든 선택 해제 완료');
    }
  }

  /**
   * 프로세스 포커스 처리
   */
  handleProcessFocus(processId) {
    console.log('🎯 MiniTreeView 포커스 요청:', processId);
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
   * 프로세스 편집 처리
   */
  handleProcessEdit(processId) {
    console.log('✏️ MiniTreeView 프로세스 편집 요청:', processId);
    this.selectProcess(processId);
    const process = this.getProcessById(processId);
    if (process) {
      this.emit('process-edit', process);
    }
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 기본 클릭/더블클릭 이벤트는 이미 container에 설정되어 있음
    // 렌더링 후 추가로 필요한 이벤트만 설정
    this.setupDragAndDrop();
    this.setupGroupManagementEvents();
  }

  /**
   * 드래그앤드롭 설정
   */
  setupDragAndDrop() {
    // 드래그 시작
    this.container.addEventListener('dragstart', e => {
      const processNode = e.target.closest('.process-node');
      if (!processNode) return;

      // 액션 버튼에서 시작된 드래그는 방지
      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn) {
        e.preventDefault();
        return;
      }

      // 그룹 관리 버튼에서 시작된 드래그는 방지
      const groupActionBtn = e.target.closest('.group-action-btn');
      if (groupActionBtn) {
        e.preventDefault();
        return;
      }

      // 프로세스 노드 전체에서 드래그 허용 (액션 버튼 제외)
      console.log('🔥 드래그 시작 허용:', e.target.className);

      const processId = processNode.dataset.processId;
      const groupId = processNode.dataset.groupId;
      const groupName = processNode.dataset.groupName;

      console.log('🔥 드래그 시작:', {
        processId,
        groupId,
        dragFrom: e.target.className,
      });

      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          processId,
          fromGroupId: groupId,
          fromGroupName: groupName,
        })
      );

      e.dataTransfer.effectAllowed = 'move';
      processNode.classList.add('dragging');
    });

    // 드래그 종료
    this.container.addEventListener('dragend', e => {
      const processNode = e.target.closest('.process-node');
      if (processNode) {
        processNode.classList.remove('dragging');
      }
    });

    // 드래그 오버 (드롭 존 하이라이트)
    this.container.addEventListener('dragover', e => {
      e.preventDefault();

      // 기존 하이라이트 제거
      this.container.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });

      const dropTarget = this.findDropTarget(e.target);
      if (dropTarget) {
        e.dataTransfer.dropEffect = 'move';
        dropTarget.classList.add('drag-over');
      }
    });

    // 드래그 리브 (하이라이트 제거)
    this.container.addEventListener('dragleave', e => {
      // 컨테이너를 완전히 벗어났을 때만 모든 하이라이트 제거
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        this.container.querySelectorAll('.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
      }
    });

    // 드롭
    this.container.addEventListener('drop', async e => {
      e.preventDefault();

      // 모든 드래그 하이라이트 제거
      this.container.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });

      const dropTarget = this.findDropTarget(e.target);
      if (!dropTarget) return;

      // 쓰로틀링 적용 - 연속된 드래그 이벤트 방지
      const now = Date.now();
      if (now - this.lastDragTime < this.dragThrottleTime) {
        console.log('⏳ 드롭 이벤트 쓰로틀링됨 (연속 드래그 방지)');
        return;
      }
      this.lastDragTime = now;

      try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        let toGroupId = dropTarget.dataset.groupId;

        // group-header의 경우 정확한 그룹 ID를 찾아야 함
        if (dropTarget.classList.contains('group-header')) {
          toGroupId = dropTarget.dataset.groupId;
        } else if (dropTarget.classList.contains('group-children')) {
          toGroupId = dropTarget.dataset.groupId;
        } else if (dropTarget.classList.contains('process-node')) {
          toGroupId = dropTarget.dataset.groupId;
        }

        const toGroup = this.groups.find(g => g.id === toGroupId);

        // 유효하지 않은 그룹인지 확인
        if (!toGroup) {
          console.warn('유효하지 않은 그룹 ID:', toGroupId);
          return;
        }

        // 같은 그룹 내에서의 순서 변경 확인 (process-node에서만)
        if (
          dragData.fromGroupId === toGroupId &&
          dropTarget.classList.contains('process-node')
        ) {
          const targetProcessId = dropTarget.dataset.processId;
          if (targetProcessId && targetProcessId !== dragData.processId) {
            console.log('프로세스 순서 변경:', {
              processId: dragData.processId,
              groupId: toGroup.id,
              targetProcessId: targetProcessId,
            });
            await this.handleProcessReorder(dragData, dropTarget, toGroup);
            return;
          }
        }

        // 같은 그룹으로 드롭한 경우 (순서 변경이 아닌 경우) 무시
        if (dragData.fromGroupId === toGroupId) {
          return;
        }

        console.log('🔄 드래그앤드롭 그룹 변경:', {
          processId: dragData.processId,
          fromGroupId: dragData.fromGroupId,
          fromGroupName: dragData.fromGroupName,
          toGroupId: toGroupId,
          toGroupName: toGroup.name,
          dropTargetType: dropTarget.className,
        });

        // 그룹 변경 이벤트 발생
        this.emit('process-group-change', {
          processId: dragData.processId,
          fromGroupId: dragData.fromGroupId,
          toGroupId: toGroupId,
        });

        // 성공적인 드래그 후 200ms 동안 추가 드래그 방지
        this.lastDragTime = Date.now() + 150; // 현재 시간 + 150ms 추가
      } catch (error) {
        console.error('드롭 처리 실패:', error);
      }
    });
  }

  /**
   * 드롭 타겟 찾기
   */
  findDropTarget(element) {
    // 우선순위: group-children > process-node > group-header
    // group-children이 있으면 우선적으로 선택 (더 정확한 드롭존)
    const groupChildren = element.closest('.group-children');
    if (groupChildren) {
      return groupChildren;
    }

    const processNode = element.closest('.process-node');
    if (processNode) {
      return processNode;
    }

    // group-header는 마지막 대안으로만 사용
    const groupHeader = element.closest('.group-header');
    if (groupHeader) {
      return groupHeader;
    }

    return null;
  }

  /**
   * 프로세스 순서 변경 처리
   */
  async handleProcessReorder(dragData, targetElement, group) {
    try {
      const targetProcessId = targetElement.dataset.processId;
      const groupProcesses = group.processes;

      // 현재 인덱스 찾기
      const dragIndex = groupProcesses.findIndex(
        p => p.id === dragData.processId
      );
      const targetIndex = groupProcesses.findIndex(
        p => p.id === targetProcessId
      );

      if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) {
        return; // 잘못된 인덱스이거나 같은 위치
      }

      console.log('🔄 드래그앤드롭 순서 변경:', {
        processId: dragData.processId,
        groupId: group.id,
        fromIndex: dragIndex,
        toIndex: targetIndex,
      });

      // 배열에서 순서 변경
      const [movedProcess] = groupProcesses.splice(dragIndex, 1);
      groupProcesses.splice(targetIndex, 0, movedProcess);

      // 변경된 순서를 localStorage에 저장
      const processIds = groupProcesses.map(p => p.id);
      this.saveGroupOrder(group.id, processIds);

      // UI 즉시 업데이트
      this.render();
    } catch (error) {
      console.error('프로세스 순서 변경 실패:', error);
    }
  }

  /**
   * 그룹 관리 이벤트 설정
   */
  setupGroupManagementEvents() {
    // 그룹 수정 버튼
    this.container.addEventListener('click', e => {
      if (e.target.classList.contains('edit-group-btn')) {
        e.stopPropagation();
        const groupId = e.target.dataset.groupId;
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
          this.emit('group-edit', group);
        }
      }
    });

    // 그룹 삭제 버튼
    this.container.addEventListener('click', e => {
      if (e.target.classList.contains('delete-group-btn')) {
        e.stopPropagation();
        const groupId = e.target.dataset.groupId;
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
          this.emit('group-delete', group);
        }
      }
    });
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
      selectedProcessId: this.selectedProcessId,
    };
  }

  /**
   * 그룹 상태 복원
   */
  restoreState(state) {
    if (state.expandedGroups) {
      this.expandedGroups = new Set(state.expandedGroups);
    }

    if (state.selectedProcessId !== undefined) {
      this.selectedProcessId = state.selectedProcessId;
    }
    this.render();
  }

  /**
   * 프로세스 위로 이동 처리
   */
  handleProcessMoveUp(processId) {
    console.log('🔼 프로세스 위로 이동:', processId);

    const { group, processIndex } = this.findProcessInGroups(processId);
    if (!group || processIndex <= 0) {
      console.log(
        '위로 이동할 수 없음: 이미 맨 위이거나 프로세스를 찾을 수 없음'
      );
      return;
    }

    this.moveProcessInGroup(group.id, processIndex, processIndex - 1);
  }

  /**
   * 프로세스 아래로 이동 처리
   */
  handleProcessMoveDown(processId) {
    console.log('🔽 프로세스 아래로 이동:', processId);

    const { group, processIndex } = this.findProcessInGroups(processId);
    if (!group || processIndex >= group.processes.length - 1) {
      console.log(
        '아래로 이동할 수 없음: 이미 맨 아래이거나 프로세스를 찾을 수 없음'
      );
      return;
    }

    this.moveProcessInGroup(group.id, processIndex, processIndex + 1);
  }

  /**
   * 그룹에서 프로세스 찾기
   */
  findProcessInGroups(processId) {
    for (const group of this.groups) {
      const processIndex = group.processes.findIndex(p => p.id === processId);
      if (processIndex !== -1) {
        return { group, processIndex };
      }
    }
    return { group: null, processIndex: -1 };
  }

  /**
   * 그룹 내에서 프로세스 순서 변경
   */
  moveProcessInGroup(groupId, fromIndex, toIndex) {
    const group = this.groups.find(g => g.id === groupId);
    if (
      !group ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= group.processes.length ||
      toIndex >= group.processes.length
    ) {
      return;
    }

    // 배열에서 프로세스 순서 변경
    const [movedProcess] = group.processes.splice(fromIndex, 1);
    group.processes.splice(toIndex, 0, movedProcess);

    // 변경된 순서를 localStorage에 저장
    const processIds = group.processes.map(p => p.id);
    this.saveGroupOrder(groupId, processIds);

    console.log('🔄 미니창 내부 순서 변경 완료:', {
      groupId: groupId,
      processId: movedProcess.id,
      fromIndex: fromIndex,
      toIndex: toIndex,
    });

    // UI 즉시 업데이트
    this.render();
  }

  /**
   * 커스텀 순서 정보 로드
   */
  loadCustomOrders() {
    try {
      const saved = localStorage.getItem('mini-window-custom-orders');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('커스텀 순서 로드 실패:', error);
      return {};
    }
  }

  /**
   * 커스텀 순서 정보 저장
   */
  saveCustomOrders() {
    try {
      localStorage.setItem(
        'mini-window-custom-orders',
        JSON.stringify(this.customOrderStorage)
      );
    } catch (error) {
      console.error('커스텀 순서 저장 실패:', error);
    }
  }

  /**
   * 그룹 내 프로세스 순서 저장
   */
  saveGroupOrder(groupId, processIds) {
    this.customOrderStorage[groupId] = [...processIds];
    this.saveCustomOrders();
    console.log('📝 그룹 순서 저장:', { groupId, processIds });
  }

  /**
   * 프로세스가 다른 그룹으로 이동했을 때 순서 정보 정리
   */
  removeProcessFromCustomOrder(processId, fromGroupId) {
    if (this.customOrderStorage[fromGroupId]) {
      const processIndex =
        this.customOrderStorage[fromGroupId].indexOf(processId);
      if (processIndex !== -1) {
        this.customOrderStorage[fromGroupId].splice(processIndex, 1);

        // 그룹에 프로세스가 없으면 그룹 순서 정보 삭제
        if (this.customOrderStorage[fromGroupId].length === 0) {
          delete this.customOrderStorage[fromGroupId];
        }

        this.saveCustomOrders();
        console.log('🗑️ 프로세스 순서 정보 제거:', { processId, fromGroupId });
      }
    }
  }

  /**
   * 프로세스가 새로운 그룹으로 이동할 때 해당 프로세스를 대상 그룹의 순서에서 제외
   * (새로운 그룹에서는 기본 정렬 순서로 배치되도록)
   */
  removeProcessFromTargetGroupOrder(processId, toGroupId) {
    if (this.customOrderStorage[toGroupId]) {
      const processIndex =
        this.customOrderStorage[toGroupId].indexOf(processId);
      if (processIndex !== -1) {
        this.customOrderStorage[toGroupId].splice(processIndex, 1);
        this.saveCustomOrders();
        console.log('🔄 대상 그룹 순서에서 프로세스 제거 (기본 정렬 적용):', {
          processId,
          toGroupId,
        });
      }
    }
  }

  /**
   * 그룹의 커스텀 순서 적용
   */
  applyCustomOrder(group) {
    const savedOrder = this.customOrderStorage[group.id];
    if (!savedOrder || savedOrder.length === 0) {
      return; // 저장된 순서가 없으면 기본 순서 유지
    }

    // 저장된 순서대로 프로세스 재배열
    const reorderedProcesses = [];
    const remainingProcesses = [...group.processes];

    // 저장된 순서대로 먼저 배치
    savedOrder.forEach(savedProcessId => {
      const processIndex = remainingProcesses.findIndex(
        p => p.id === savedProcessId
      );
      if (processIndex !== -1) {
        reorderedProcesses.push(remainingProcesses.splice(processIndex, 1)[0]);
      }
    });

    // 새로 추가된 프로세스들(그룹 변경으로 새로 들어온)은 가장 뒤(아래)에 배치
    // 오래된순 정렬에서 인덱스 끝 = 화면상 가장 아래 = 최신 위치
    reorderedProcesses.push(...remainingProcesses);

    // 더 이상 존재하지 않는 프로세스들이 저장된 순서에 있으면 정리
    const currentProcessIds = group.processes.map(p => p.id);
    const validSavedOrder = savedOrder.filter(id =>
      currentProcessIds.includes(id)
    );

    if (validSavedOrder.length !== savedOrder.length) {
      console.log('🧹 존재하지 않는 프로세스 ID 정리:', {
        groupId: group.id,
        removed: savedOrder.length - validSavedOrder.length,
      });
      this.saveGroupOrder(group.id, validSavedOrder);
    }

    group.processes = reorderedProcesses;

    console.log('🔄 커스텀 순서 적용:', {
      groupId: group.id,
      originalCount: group.processes.length,
      reorderedCount: reorderedProcesses.length,
    });
  }

  /**
   * 오래된 순서 정보 정리 (옵션)
   */
  cleanupOldOrders() {
    // 현재 존재하는 그룹 ID들 수집
    const currentGroupIds = this.groups.map(g => g.id);
    const savedGroupIds = Object.keys(this.customOrderStorage);

    let cleaned = false;
    savedGroupIds.forEach(savedGroupId => {
      if (!currentGroupIds.includes(savedGroupId)) {
        delete this.customOrderStorage[savedGroupId];
        cleaned = true;
        console.log('🧹 삭제된 그룹의 순서 정보 정리:', savedGroupId);
      }
    });

    if (cleaned) {
      this.saveCustomOrders();
    }
  }

  /**
   * 포커스 실패/경고 상태 시각화 (주황 불빛 점등)
   */
  markProcessWarning(processId, message = '창을 찾을 수 없음') {
    const node = this.container.querySelector(`.process-node[data-process-id="${processId}"]`);
    if (node) {
      node.classList.add('focus-failed');
      const statusEl = node.querySelector('.process-status');
      if (statusEl) {
        statusEl.className = 'process-status warning';
        statusEl.title = message;
      }
    }
  }

  /**
   * 포커스 성공 시 경고 상태 해제
   */
  clearProcessWarning(processId) {
    const node = this.container.querySelector(`.process-node[data-process-id="${processId}"]`);
    if (node) {
      node.classList.remove('focus-failed');
      const statusEl = node.querySelector('.process-status');
      if (statusEl) {
        statusEl.className = 'process-status connected';
        statusEl.title = '';
      }
    }
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
