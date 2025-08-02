/**
 * Sidebar - 사이드바 네비게이션 컴포넌트
 * 메뉴, 그룹 관리, 상태 정보 표시
 */

export class Sidebar {
  constructor(sidebarElement, groupStore, groupService) {
    this.element = sidebarElement;
    this.groupStore = groupStore;
    this.groupService = groupService;
    
    this.isCollapsed = false;
    this.isMobile = false;
    this.groups = [];
    
    this.initialize();
  }

  /**
   * 사이드바 초기화
   */
  initialize() {
    this.checkMobileView();
    this.setupEventListeners();
    this.loadGroups();
    
    // 초기 상태 설정
    this.updateCollapseState();
  }

  /**
   * 모바일 뷰 확인
   */
  checkMobileView() {
    this.isMobile = window.innerWidth <= 768;
    
    if (this.isMobile) {
      this.element.classList.add('mobile');
      this.element.classList.remove('collapsed');
    } else {
      this.element.classList.remove('mobile');
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 사이드바 토글 버튼
    const toggleButton = this.element.querySelector('#sidebar-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.toggle();
      });
    }

    // 그룹 추가 버튼
    const addGroupButton = this.element.querySelector('#add-group-btn');
    if (addGroupButton) {
      addGroupButton.addEventListener('click', () => {
        this.showAddGroupDialog();
      });
    }

    // 네비게이션 링크들
    const navLinks = this.element.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigation(link);
      });
    });

    // 윈도우 리사이즈
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // 모바일에서 오버레이 클릭
    document.addEventListener('click', (e) => {
      if (this.isMobile && !this.element.contains(e.target)) {
        this.close();
      }
    });
  }

  /**
   * 사이드바 토글
   */
  toggle() {
    if (this.isMobile) {
      this.element.classList.toggle('open');
    } else {
      this.isCollapsed = !this.isCollapsed;
      this.updateCollapseState();
    }
  }

  /**
   * 사이드바 열기
   */
  open() {
    if (this.isMobile) {
      this.element.classList.add('open');
    } else {
      this.isCollapsed = false;
      this.updateCollapseState();
    }
  }

  /**
   * 사이드바 닫기
   */
  close() {
    if (this.isMobile) {
      this.element.classList.remove('open');
    } else {
      this.isCollapsed = true;
      this.updateCollapseState();
    }
  }

  /**
   * 접기 상태 업데이트
   */
  updateCollapseState() {
    if (this.isMobile) return;

    if (this.isCollapsed) {
      this.element.classList.add('collapsed');
    } else {
      this.element.classList.remove('collapsed');
    }

    // 토글 아이콘 업데이트
    const toggleIcon = this.element.querySelector('.toggle-icon');
    if (toggleIcon) {
      toggleIcon.textContent = this.isCollapsed ? '☰' : '✕';
    }
  }

  /**
   * 네비게이션 처리
   * @param {HTMLElement} clickedLink - 클릭된 링크
   */
  handleNavigation(clickedLink) {
    // 모든 링크에서 active 클래스 제거
    const navLinks = this.element.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    // 클릭된 링크에 active 클래스 추가
    clickedLink.classList.add('active');

    // 페이지 제목 업데이트
    const pageTitle = document.getElementById('page-title');
    const breadcrumb = document.getElementById('breadcrumb-text');
    
    if (pageTitle && breadcrumb) {
      const linkText = clickedLink.querySelector('.nav-text').textContent;
      pageTitle.textContent = linkText;
      breadcrumb.textContent = `홈 > ${linkText}`;
    }

    // 모바일에서는 사이드바 자동 닫기
    if (this.isMobile) {
      this.close();
    }

    // 네비게이션 이벤트 발생
    this.dispatchNavigationEvent(clickedLink.id);
  }

  /**
   * 네비게이션 이벤트 발생
   * @param {string} navigationId - 네비게이션 ID
   */
  dispatchNavigationEvent(navigationId) {
    const event = new CustomEvent('navigation', {
      detail: { navigationId }
    });
    window.dispatchEvent(event);
  }

  /**
   * 그룹 목록 로드
   */
  loadGroups() {
    this.groups = this.groupStore.getAllGroups();
    this.renderGroups();
  }

  /**
   * 그룹 목록 렌더링
   */
  renderGroups() {
    const groupsList = this.element.querySelector('#groups-list');
    if (!groupsList) return;

    if (this.groups.length === 0) {
      groupsList.innerHTML = '<div class="no-groups">그룹이 없습니다</div>';
      return;
    }

    const html = this.groups.map(group => this.renderGroupItem(group)).join('');
    groupsList.innerHTML = html;

    // 그룹 아이템 이벤트 리스너 연결
    this.attachGroupEventListeners();
  }

  /**
   * 개별 그룹 아이템 렌더링
   * @param {Object} group - 그룹 객체
   * @returns {string} HTML 문자열
   */
  renderGroupItem(group) {
    const processCount = group.processIds.length;
    const colorStyle = group.color ? `style="background-color: ${group.color};"` : '';

    return `
      <div class="group-item" data-group-id="${group.id}">
        <div class="group-header">
          <div class="group-info">
            <div class="group-color" ${colorStyle}></div>
            <span class="group-name" title="${group.name}">${group.name}</span>
            <span class="group-count">(${processCount})</span>
          </div>
          <div class="group-actions">
            <button class="btn-icon btn-icon-sm" data-action="edit" title="그룹 편집">
              ✏️
            </button>
            <button class="btn-icon btn-icon-sm" data-action="delete" title="그룹 삭제">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 그룹 아이템 이벤트 리스너 연결
   */
  attachGroupEventListeners() {
    const groupItems = this.element.querySelectorAll('.group-item');
    
    groupItems.forEach(item => {
      const groupId = item.dataset.groupId;
      
      // 그룹 클릭 (그룹 필터링)
      const groupHeader = item.querySelector('.group-header');
      groupHeader.addEventListener('click', (e) => {
        // 액션 버튼 클릭이 아닌 경우만
        if (!e.target.closest('.group-actions')) {
          this.selectGroup(groupId);
        }
      });

      // 액션 버튼들
      const actionButtons = item.querySelectorAll('[data-action]');
      actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleGroupAction(groupId, button.dataset.action);
        });
      });
    });
  }

  /**
   * 그룹 선택 (필터링)
   * @param {string} groupId - 그룹 ID
   */
  selectGroup(groupId) {
    // 그룹 아이템 활성 상태 업데이트
    const groupItems = this.element.querySelectorAll('.group-item');
    groupItems.forEach(item => {
      if (item.dataset.groupId === groupId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 그룹 선택 이벤트 발생
    const event = new CustomEvent('group-selected', {
      detail: { groupId }
    });
    window.dispatchEvent(event);

    // 모바일에서는 사이드바 자동 닫기
    if (this.isMobile) {
      this.close();
    }
  }

  /**
   * 그룹 액션 처리
   * @param {string} groupId - 그룹 ID
   * @param {string} action - 액션 타입
   */
  handleGroupAction(groupId, action) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    switch (action) {
      case 'edit':
        this.showEditGroupDialog(group);
        break;

      case 'delete':
        this.deleteGroup(group);
        break;
    }
  }

  /**
   * 그룹 추가 다이얼로그 표시
   */
  showAddGroupDialog() {
    const dialog = document.getElementById('group-dialog');
    const title = document.getElementById('group-dialog-title');
    const input = document.getElementById('group-name-input');
    
    if (!dialog || !title || !input) return;

    title.textContent = '그룹 추가';
    input.value = '';
    input.placeholder = '그룹명을 입력하세요';
    
    this.showDialog(dialog, (groupName) => {
      if (groupName.trim()) {
        this.groupService.createGroup(groupName.trim());
      }
    });
  }

  /**
   * 그룹 수정 다이얼로그 표시
   * @param {Object} group - 그룹 객체
   */
  showEditGroupDialog(group) {
    const dialog = document.getElementById('group-dialog');
    const title = document.getElementById('group-dialog-title');
    const input = document.getElementById('group-name-input');
    
    if (!dialog || !title || !input) return;

    title.textContent = '그룹 수정';
    input.value = group.name;
    input.placeholder = '그룹명을 입력하세요';
    
    this.showDialog(dialog, (groupName) => {
      if (groupName.trim() && groupName.trim() !== group.name) {
        this.groupService.updateGroup(group.id, { name: groupName.trim() });
      }
    });
  }

  /**
   * 다이얼로그 표시 및 처리
   * @param {HTMLElement} dialog - 다이얼로그 요소
   * @param {Function} onSave - 저장 콜백
   */
  showDialog(dialog, onSave) {
    const input = dialog.querySelector('#group-name-input');
    const saveButton = dialog.querySelector('#group-dialog-save');
    const cancelButton = dialog.querySelector('#group-dialog-cancel');
    const closeButton = dialog.querySelector('#group-dialog-close');

    dialog.style.display = 'flex';
    input.focus();
    input.select();

    // 이벤트 리스너 정리 함수
    const cleanup = () => {
      dialog.style.display = 'none';
      saveButton.replaceWith(saveButton.cloneNode(true));
      cancelButton.replaceWith(cancelButton.cloneNode(true));
      closeButton.replaceWith(closeButton.cloneNode(true));
    };

    // 저장 버튼
    dialog.querySelector('#group-dialog-save').addEventListener('click', () => {
      onSave(input.value);
      cleanup();
    });

    // 취소/닫기 버튼
    const cancelHandler = () => cleanup();
    dialog.querySelector('#group-dialog-cancel').addEventListener('click', cancelHandler);
    dialog.querySelector('#group-dialog-close').addEventListener('click', cancelHandler);

    // Enter/Escape 키 처리
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(input.value);
        cleanup();
        document.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    // 다이얼로그 외부 클릭
    const clickHandler = (e) => {
      if (e.target === dialog) {
        cleanup();
        document.removeEventListener('click', clickHandler);
      }
    };
    document.addEventListener('click', clickHandler);
  }

  /**
   * 그룹 삭제
   * @param {Object} group - 그룹 객체
   */
  deleteGroup(group) {
    const processCount = group.processIds.length;
    let message = `그룹 '${group.name}'을 삭제하시겠습니까?`;
    
    if (processCount > 0) {
      message += `\n\n이 그룹에는 ${processCount}개의 프로세스가 있습니다. 삭제하면 프로세스들이 그룹에서 제거됩니다.`;
    }

    if (confirm(message)) {
      const force = processCount > 0;
      this.groupService.deleteGroup(group.id, force);
    }
  }

  /**
   * 그룹 목록 업데이트
   * @param {Array} groups - 그룹 배열
   */
  updateGroups(groups) {
    this.groups = groups;
    this.renderGroups();
  }

  /**
   * 상태 정보 업데이트
   * @param {Object} statistics - 통계 정보
   */
  updateStatusInfo(statistics) {
    const connectedCount = this.element.querySelector('#connected-count');
    const totalCount = this.element.querySelector('#total-count');

    if (connectedCount) {
      connectedCount.textContent = statistics.connected || 0;
    }

    if (totalCount) {
      totalCount.textContent = statistics.total || 0;
    }
  }

  /**
   * 윈도우 리사이즈 처리
   */
  handleResize() {
    const wasMobile = this.isMobile;
    this.checkMobileView();

    // 모바일에서 데스크톱으로 변경된 경우
    if (wasMobile && !this.isMobile) {
      this.element.classList.remove('open');
      this.updateCollapseState();
    }
    // 데스크톱에서 모바일로 변경된 경우
    else if (!wasMobile && this.isMobile) {
      this.element.classList.remove('collapsed');
    }
  }

  /**
   * 활성 네비게이션 설정
   * @param {string} navigationId - 네비게이션 ID
   */
  setActiveNavigation(navigationId) {
    const navLinks = this.element.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.id === navigationId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * 그룹 선택 해제
   */
  clearGroupSelection() {
    const groupItems = this.element.querySelectorAll('.group-item');
    groupItems.forEach(item => {
      item.classList.remove('active');
    });
  }

  /**
   * 컴포넌트 정리
   */
  cleanup() {
    // 이벤트 리스너 정리는 자동으로 처리됨 (요소가 제거되면)
  }
}