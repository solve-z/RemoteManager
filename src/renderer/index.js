/**
 * RemoteManager - 렌더러 프로세스 메인 엔트리포인트
 * 모듈화된 아키텍처의 시작점
 */

import { ProcessStore } from './store/ProcessStore.js';
import { GroupStore } from './store/GroupStore.js';
import { SettingsStore } from './store/SettingsStore.js';
import { ProcessService } from './services/ProcessService.js';
import { GroupService } from './services/GroupService.js';
import { NotificationService } from './services/NotificationService.js';
import { KeyManager } from './services/KeyManager.js';
import { ProcessList } from './components/ProcessList.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusBar } from './components/StatusBar.js';
import { GroupManager } from './components/GroupManager.js';

/**
 * RemoteManager 애플리케이션 클래스
 */
class RemoteManagerApp {
  constructor() {
    this.stores = {};
    this.services = {};
    this.components = {};
    this.isAutoRefreshEnabled = false;
    this.autoRefreshInterval = null;
    this.isConflictDialogOpen = false; // 충돌 다이얼로그 상태 추적
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    try {
      console.log('🚀 RemoteManager 초기화 시작');

      // 1. 스토어 초기화
      await this.initializeStores();

      // 2. 서비스 초기화
      await this.initializeServices();

      // 3. UI 컴포넌트 초기화
      await this.initializeComponents();

      // 4. 이벤트 리스너 등록
      this.setupEventListeners();

      // 5. 초기 데이터 로드
      await this.loadInitialData();

      console.log('✅ RemoteManager 초기화 완료');
    } catch (error) {
      console.error('❌ 애플리케이션 초기화 실패:', error);
      this.services.notification?.showError(
        '애플리케이션 초기화에 실패했습니다.'
      );
    }
  }

  /**
   * 스토어 초기화
   */
  async initializeStores() {
    this.stores.process = new ProcessStore();
    this.stores.group = new GroupStore();
    this.stores.settings = new SettingsStore();

    // 스토어 간 연결 설정
    this.stores.process.setGroupStore(this.stores.group);
  }

  /**
   * 서비스 초기화
   */
  async initializeServices() {
    this.services.notification = new NotificationService();
    this.services.process = new ProcessService(
      this.stores.process,
      this.services.notification,
      this.stores.group // GroupStore 연결
    );
    this.services.group = new GroupService(
      this.stores.group,
      this.stores.process,
      this.services.notification
    );
  }

  /**
   * UI 컴포넌트 초기화
   */
  async initializeComponents() {
    // ProcessList 컴포넌트
    const processListContainer = document.getElementById('process-list');
    this.components.processList = new ProcessList(
      processListContainer,
      this.services.process,
      this.services.group,
      this.services.notification
    );

    // GroupManager 컴포넌트 먼저 생성
    this.components.groupManager = new GroupManager(
      this.stores.group,
      this.services.group
    );

    // GroupManager 컴포넌트
    this.components.groupManager = new GroupManager(
      this.stores.group,
      this.services.group
    );

    // Sidebar 컴포넌트
    const sidebarElement = document.getElementById('sidebar');
    this.components.sidebar = new Sidebar(
      sidebarElement,
      this.stores.group,
      this.services.group,
      this.components.groupManager,
      this.stores.process
    );

    // StatusBar 컴포넌트
    this.components.statusBar = new StatusBar(this.stores.process);

    // 스토어 변경 시 컴포넌트 업데이트
    this.stores.process.subscribe(processes => {
      this.components.processList.render(processes);
      this.components.statusBar.update(processes);
      // 프로세스 변경 시 사이드바도 업데이트 (그룹 개수 동기화)
      this.components.sidebar.updateGroups(this.stores.group.getAllGroups());

      // 미니창에 실제 프로세스 데이터 전송
      this.sendDataToMiniWindow();
    });

    this.stores.group.subscribe(groups => {
      this.components.sidebar.updateGroups(groups);
      this.components.processList.updateGroupOptions(groups);
    });
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 미니창 토글 버튼
    const miniWindowToggle = document.getElementById('mini-window-toggle');
    miniWindowToggle?.addEventListener('click', () => {
      this.toggleMiniWindow();
    });

    // 새로고침 버튼
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn?.addEventListener('click', () => {
      this.refreshProcesses();
    });

    // 자동 새로고침 토글
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    autoRefreshToggle?.addEventListener('click', () => {
      this.toggleAutoRefresh();
    });

    // 필터 및 정렬 옵션
    const sortSelect = document.getElementById('sort-select');
    sortSelect?.addEventListener('change', e => {
      this.components.processList.setSortOption(e.target.value);
    });

    const groupFilter = document.getElementById('group-filter');
    groupFilter?.addEventListener('change', e => {
      this.components.processList.setGroupFilter(e.target.value);
    });

    const categoryFilter = document.getElementById('category-filter');
    categoryFilter?.addEventListener('change', e => {
      this.components.processList.setCategoryFilter(e.target.value);
    });

    // 필터 관련 요소들
    const typeFilter = document.getElementById('type-filter');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    const filtersToggle = document.getElementById('filters-toggle');
    const filtersContainer = document.getElementById('filters-container');

    // 타입 필터
    typeFilter?.addEventListener('change', e => {
      this.components.processList.setTypeFilter(e.target.value);
    });

    // 다중 연결 정보 초기화
    const resetMultipleIdsBtn = document.getElementById('reset-multiple-ids');
    resetMultipleIdsBtn?.addEventListener('click', () => {
      this.resetMultipleIds();
    });

    // 전체 필터 초기화
    clearAllFiltersBtn?.addEventListener('click', () => {
      this.clearAllFilters();
    });

    // 필터 토글 기능
    filtersToggle?.addEventListener('click', () => {
      this.toggleFilters();
    });

    // 키보드 단축키
    document.addEventListener('keydown', e => {
      this.handleKeyboardShortcuts(e);
    });

    // 충돌 다이얼로그 열림/닫힘 이벤트 처리
    window.addEventListener('conflict-dialog-opened', () => {
      if (this.isAutoRefreshEnabled) {
        console.log('⏸️ 충돌 다이얼로그 열림 - 자동 새로고침 일시 정지');
        this.isConflictDialogOpen = true;
      }
    });

    window.addEventListener('conflict-dialog-closed', () => {
      if (this.isAutoRefreshEnabled && this.isConflictDialogOpen) {
        console.log('▶️ 충돌 다이얼로그 닫힘 - 자동 새로고침 재개');
        this.isConflictDialogOpen = false;
      }
    });

    // 그룹 선택 이벤트 (사이드바에서 그룹 클릭 시)
    window.addEventListener('group-selected', e => {
      const { groupId } = e.detail;
      this.components.processList.setGroupFilter(groupId);
      // 그룹 필터 드롭다운도 업데이트
      const groupFilterSelect = document.getElementById('group-filter');
      if (groupFilterSelect) {
        groupFilterSelect.value = groupId;
      }
    });

    // 그룹 필터 초기화 이벤트 (원격 프로세스 탭으로 이동 시)
    window.addEventListener('clear-group-filter', () => {
      this.components.processList.setGroupFilter('');
      // 그룹 필터 드롭다운도 초기화
      const groupFilterSelect = document.getElementById('group-filter');
      if (groupFilterSelect) {
        groupFilterSelect.value = '';
      }
    });

    // 그룹 필터 초기화 이벤트 (원격 프로세스 탭으로 이동 시)
    window.addEventListener('set-group-filter', () => {
      this.components.processList.setGroupFilter('ungrouped');
      // 그룹 필터 드롭다운도 초기화
      const groupFilterSelect = document.getElementById('group-filter');
      if (groupFilterSelect) {
        groupFilterSelect.value = 'ungrouped';
      }
    });

    // 그룹 생성 이벤트 - 필터 드롭다운 업데이트 및 미니창 동기화
    window.addEventListener('group-created', e => {
      this.updateGroupFilterOptions();
      this.sendDataToMiniWindow();
    });

    // 그룹 수정 이벤트 - 필터 드롭다운 업데이트 및 미니창 동기화
    window.addEventListener('group-updated', e => {
      this.updateGroupFilterOptions();
      this.sendDataToMiniWindow();
    });

    // 그룹 삭제 이벤트 - 필터 드롭다운 업데이트 및 미니창 동기화
    window.addEventListener('group-deleted', e => {
      this.updateGroupFilterOptions();
      // 삭제된 그룹이 현재 선택된 필터였다면 초기화
      const groupFilterSelect = document.getElementById('group-filter');
      if (groupFilterSelect && groupFilterSelect.value === e.detail.groupId) {
        groupFilterSelect.value = '';
        this.components.processList.setGroupFilter('');
      }
      this.sendDataToMiniWindow();
    });

    // 프로세스 라벨 변경 이벤트 - 미니창 동기화
    window.addEventListener('process-label-updated', e => {
      this.sendDataToMiniWindow();
    });

    // 윈도우 리사이즈
    window.addEventListener('resize', () => {
      this.components.sidebar?.handleResize();
    });

    // 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 미니창에서 데이터를 요청했을 때 응답
    if (window.electronAPI && window.electronAPI.onDataRequest) {
      window.electronAPI.onDataRequest(() => {
        this.sendMainDataResponse();
      });
    }

    // 미니창에서 삭제 요청 수신
    if (window.electronAPI?.onDeleteRequest) {
      window.electronAPI.onDeleteRequest(processId => {
        this.services.process.removeDisconnectedProcess(processId);
      });
    }

    // 미니창에서 새로고침 요청했을 때 처리
    if (window.electronAPI && window.electronAPI.onRefreshRequest) {
      window.electronAPI.onRefreshRequest(() => {
        console.log('🔄 미니창에서 새로고침 요청 받음');
        this.handleRefresh();
      });
    }

    // 미니창에서 그룹 액션 요청했을 때 처리
    if (window.electronAPI && window.electronAPI.onGroupActionRequest) {
      window.electronAPI.onGroupActionRequest(actionData => {
        console.log('🎯 미니창에서 그룹 액션 요청 받음:', actionData);
        this.handleGroupActionFromMini(actionData);
      });
    }

    // 미니창에서 프로세스 액션 요청했을 때 처리
    if (window.electronAPI && window.electronAPI.onProcessActionRequest) {
      window.electronAPI.onProcessActionRequest(actionData => {
        console.log('🎯 미니창에서 프로세스 액션 요청 받음:', actionData);
        this.handleProcessActionFromMini(actionData);
      });
    }

    // 사이드바 리사이저 기능
    this.setupSidebarResizer();

    // 네비게이션-그룹 세로 리사이저 기능
    this.setupNavGroupsResizer();
  }

  /**
   * 새로고침 처리 (미니창 요청용)
   */
  handleRefresh() {
    console.log('🔄 미니창 요청으로 새로고침 실행');
    // 기존 새로고침 로직 호출
    this.refreshProcesses();
  }

  /**
   * 미니창에서 받은 그룹 액션 처리
   * @param {Object} actionData - 액션 데이터 { action, data }
   */
  async handleGroupActionFromMini(actionData) {
    try {
      const { action, data } = actionData;
      let result = { success: false, error: 'Unknown action' };

      switch (action) {
        case 'create':
          console.log('🎯 미니창에서 그룹 생성 요청:', data);
          const newGroup = this.services.group.createGroup(data.name);
          if (newGroup && data.color) {
            this.services.group.updateGroup(newGroup.id, { color: data.color });
          }
          result = { success: !!newGroup, data: newGroup };
          break;

        case 'delete':
          console.log('🗑️ 미니창에서 그룹 삭제 요청:', data);
          const deleteSuccess = this.services.group.deleteGroup(data.id, true); // force delete
          result = { success: deleteSuccess };
          break;

        case 'update':
          console.log('✏️ 미니창에서 그룹 수정 요청:', data);
          const updateSuccess = this.services.group.updateGroup(data.id, {
            name: data.name,
            color: data.color,
          });
          result = { success: updateSuccess };
          break;

        case 'change-process-group':
          console.log('🔄 미니창에서 프로세스 그룹 변경 요청:', data);
          const changeSuccess = this.services.group.assignProcessToGroup(
            data.processId,
            data.toGroupId
          );
          result = { success: changeSuccess };
          break;

        case 'reorder-process':
          console.log('📋 미니창에서 프로세스 순서 변경 요청:', data);
          const reorderSuccess = this.services.group.reorderProcessInGroup(
            data.groupId,
            data.processId,
            data.newIndex
          );
          result = { success: reorderSuccess };
          break;

        default:
          console.warn('알 수 없는 그룹 액션:', action);
      }

      // 성공 시 미니창에 최신 데이터 전송
      if (result.success) {
        // 타이밍을 150ms로 늘려서 드래그 쓰로틀링과 겹치지 않도록
        setTimeout(() => {
          this.sendDataToMiniWindow();
        }, 150);
      }

      // 메인 프로세스에 결과 응답
      if (window.electronAPI && window.electronAPI.sendGroupActionResponse) {
        console.log('📤 메인창에서 그룹 액션 응답 전송:', result);
        window.electronAPI.sendGroupActionResponse(result);
      } else {
        console.error('❌ sendGroupActionResponse API를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('미니창 그룹 액션 처리 실패:', error);
      const errorResult = { success: false, error: error.message };

      if (window.electronAPI && window.electronAPI.sendGroupActionResponse) {
        console.log('📤 메인창에서 그룹 액션 에러 응답 전송:', errorResult);
        window.electronAPI.sendGroupActionResponse(errorResult);
      } else {
        console.error(
          '❌ sendGroupActionResponse API를 찾을 수 없습니다. (에러 케이스)'
        );
      }
    }
  }

  /**
   * 미니창에서 받은 프로세스 액션 처리
   * @param {Object} actionData - 액션 데이터 { action, data }
   */
  async handleProcessActionFromMini(actionData) {
    try {
      const { action, data } = actionData;
      let result = { success: false, error: 'Unknown action' };

      switch (action) {
        case 'update':
          console.log('✏️ 미니창에서 프로세스 업데이트 요청:', data);
          const updateSuccess = await this.services.process.updateProcessInfo(
            data.processId,
            data.customLabel,
            data.category
          );
          result = { success: updateSuccess };
          break;

        default:
          console.warn('알 수 없는 프로세스 액션:', action);
      }

      // 성공 시 미니창에 최신 데이터 전송
      if (result.success) {
        setTimeout(() => {
          this.sendDataToMiniWindow();
        }, 150);
      }

      // 메인 프로세스에 결과 응답
      if (window.electronAPI && window.electronAPI.sendProcessActionResponse) {
        console.log('📤 메인창에서 프로세스 액션 응답 전송:', result);
        window.electronAPI.sendProcessActionResponse(result);
      } else {
        console.error('❌ sendProcessActionResponse API를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('미니창 프로세스 액션 처리 실패:', error);
      const errorResult = { success: false, error: error.message };

      if (window.electronAPI && window.electronAPI.sendProcessActionResponse) {
        console.log('📤 메인창에서 프로세스 액션 에러 응답 전송:', errorResult);
        window.electronAPI.sendProcessActionResponse(errorResult);
      } else {
        console.error(
          '❌ sendProcessActionResponse API를 찾을 수 없습니다. (에러 케이스)'
        );
      }
    }
  }

  /**
   * 사이드바 리사이저 설정
   */
  setupSidebarResizer() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const mainContent = document.querySelector('.main-content');

    if (!sidebar || !resizer || !mainContent) {
      console.warn('사이드바 리사이저 요소를 찾을 수 없습니다');
      return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    // 저장된 사이드바 크기 불러오기
    const savedWidth = this.stores.settings.get('sidebar.width', 280);
    this.setSidebarWidth(savedWidth);

    // 마우스 다운 이벤트
    resizer.addEventListener('mousedown', e => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(
        document.defaultView.getComputedStyle(sidebar).width,
        10
      );

      // 리사이징 중임을 표시
      document.body.classList.add('resizing');
      resizer.classList.add('active');

      // 선택 방지
      document.body.style.userSelect = 'none';

      e.preventDefault();
    });

    // 마우스 이동 이벤트
    document.addEventListener('mousemove', e => {
      if (!isResizing) return;

      const newWidth = startWidth + e.clientX - startX;

      // 최소/최대 크기 제한
      const minWidth = 200;
      const maxWidth = Math.min(600, window.innerWidth * 0.4);

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        this.setSidebarWidth(newWidth);
      }

      e.preventDefault();
    });

    // 마우스 업 이벤트
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;

        // 리사이징 완료
        document.body.classList.remove('resizing');
        resizer.classList.remove('active');
        document.body.style.userSelect = '';

        // 현재 사이드바 크기 저장
        const currentWidth = parseInt(
          document.defaultView.getComputedStyle(sidebar).width,
          10
        );
        this.stores.settings.set('sidebar.width', currentWidth);

        // 리사이즈 이벤트 발생 (다른 컴포넌트들이 필요시 반응)
        window.dispatchEvent(new Event('sidebar-resized'));
      }
    });

    // 더블클릭으로 기본 크기 복원
    resizer.addEventListener('dblclick', () => {
      const defaultWidth = 280;
      this.setSidebarWidth(defaultWidth);
      this.stores.settings.set('sidebar.width', defaultWidth);
      window.dispatchEvent(new Event('sidebar-resized'));
    });
  }

  /**
   * 사이드바 크기 설정
   * @param {number} width - 새로운 폭 (픽셀)
   */
  setSidebarWidth(width) {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const appContainer = document.querySelector('.app-container');

    if (sidebar && resizer && appContainer) {
      // CSS 변수로 사이드바 폭 설정
      appContainer.style.setProperty('--sidebar-width', `${width}px`);
      sidebar.style.width = `${width}px`;
      resizer.style.left = `${width}px`;
    }
  }

  /**
   * 네비게이션-그룹 세로 리사이저 설정
   */
  setupNavGroupsResizer() {
    const navSection = document.querySelector('.sidebar-nav');
    const resizer = document.getElementById('nav-groups-resizer');
    const groupsSection = document.querySelector('.groups-section');

    if (!navSection || !resizer || !groupsSection) {
      console.warn('❌ 네비게이션-그룹 리사이저 요소를 찾을 수 없습니다');
      return;
    }

    let isResizing = false;
    let startY = 0;
    let startNavHeight = 0;

    // 저장된 네비게이션 높이 불러오기
    const savedNavHeight = this.stores.settings.get('sidebar.navHeight', 200);
    this.setNavHeight(savedNavHeight);

    // 마우스 다운 이벤트
    resizer.addEventListener('mousedown', e => {
      isResizing = true;
      startY = e.clientY;
      startNavHeight = parseInt(
        document.defaultView.getComputedStyle(navSection).height,
        10
      );

      // 세로 리사이징 중임을 표시
      document.body.classList.add('vertical-resizing');
      resizer.classList.add('active');

      // 선택 방지
      document.body.style.userSelect = 'none';

      e.preventDefault();
    });

    // 마우스 이동 이벤트
    document.addEventListener('mousemove', e => {
      if (!isResizing) return;

      const deltaY = e.clientY - startY;
      const newNavHeight = startNavHeight + deltaY;

      // 최소/최대 높이 제한
      const minNavHeight = 120; // 네비게이션 최소 높이
      const maxNavHeight = 400; // 네비게이션 최대 높이

      if (newNavHeight >= minNavHeight && newNavHeight <= maxNavHeight) {
        this.setNavHeight(newNavHeight);
      }

      e.preventDefault();
    });

    // 마우스 업 이벤트
    document.addEventListener('mouseup', e => {
      if (isResizing) {
        isResizing = false;

        // 세로 리사이징 완료
        document.body.classList.remove('vertical-resizing');
        resizer.classList.remove('active');
        document.body.style.userSelect = '';

        // 현재 네비게이션 높이 저장
        const currentNavHeight = parseInt(
          document.defaultView.getComputedStyle(navSection).height,
          10
        );
        this.stores.settings.set('sidebar.navHeight', currentNavHeight);

        // 리사이즈 이벤트 발생
        window.dispatchEvent(new Event('nav-groups-resized'));
      }
    });

    // 더블클릭으로 기본 높이 복원
    resizer.addEventListener('dblclick', () => {
      const defaultNavHeight = 200;
      this.setNavHeight(defaultNavHeight);
      this.stores.settings.set('sidebar.navHeight', defaultNavHeight);
      window.dispatchEvent(new Event('nav-groups-resized'));
    });
  }

  /**
   * 네비게이션 영역 높이 설정
   * @param {number} height - 새로운 높이 (픽셀)
   */
  setNavHeight(height) {
    const navSection = document.querySelector('.sidebar-nav');

    if (navSection) {
      navSection.style.height = `${height}px`;
      navSection.style.flexShrink = '0';
    }
  }

  /**
   * 초기 데이터 로드
   */
  async loadInitialData() {
    // 앱 정보 표시
    try {
      const appInfo = await window.electronAPI.getAppInfo();
      console.log('앱 정보:', appInfo);

      // 버전 정보 업데이트
      const versionElement = document.querySelector('.version');
      if (versionElement && appInfo.version) {
        versionElement.textContent = `v${appInfo.version}`;
      }
    } catch (error) {
      console.error('앱 정보 로드 실패:', error);
    }

    // 초기 프로세스 로드
    await this.refreshProcesses();

    // 그룹 데이터 정리 (프로그램 시작 시)
    console.log('🧹 그룹 데이터 정리 시작...');
    const cleanupResult = this.services.group.cleanupInvalidProcessIds();
    if (cleanupResult.totalCleaned > 0) {
      console.log('✅ 그룹 데이터 정리 완료:', cleanupResult);
    }

    // 그룹 필터 옵션 초기화
    this.updateGroupFilterOptions();

    // 자동 새로고침은 기본적으로 OFF (사용자가 수동으로 시작)
  }

  /**
   * 프로세스 새로고침
   */
  async refreshProcesses() {
    try {
      const loadingState = document.getElementById('loading-state');
      const emptyState = document.getElementById('empty-state');
      const processListContainer = document.getElementById(
        'process-list-container'
      );
      const refreshBtn = document.getElementById('refresh-btn');
      const refreshBtnIcon = refreshBtn?.querySelector('.btn-icon');

      // 새로고침 버튼에 스피너 표시
      if (refreshBtn && refreshBtnIcon) {
        refreshBtn.disabled = true;
        refreshBtnIcon.innerHTML =
          '<span class="refresh-icon spinning"></span>';
      }

      // 기존 프로세스가 있는 경우 목록을 유지
      const currentProcesses = this.stores.process.getAllProcesses();
      if (currentProcesses.length > 0) {
        // 프로세스 로드
        await this.services.process.loadProcesses();
      } else {
        // 프로세스가 없는 경우만 전체 로딩 상태 표시
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        processListContainer.style.display = 'none';

        await this.services.process.loadProcesses();

        loadingState.style.display = 'none';
      }

      // 결과에 따라 UI 상태 업데이트
      const processes = this.stores.process.getAllProcesses();
      if (processes.length > 0) {
        processListContainer.style.display = 'block';
        emptyState.style.display = 'none';
      } else {
        processListContainer.style.display = 'none';
        emptyState.style.display = 'flex';
      }

      // 새로고침 버튼 복원
      if (refreshBtn && refreshBtnIcon) {
        refreshBtn.disabled = false;
        refreshBtnIcon.innerHTML = '<span class="refresh-icon normal"></span>';
      }
    } catch (error) {
      console.error('프로세스 새로고침 실패:', error);
      const loadingState = document.getElementById('loading-state');
      if (loadingState) loadingState.style.display = 'none';

      // 새로고침 버튼 복원
      const refreshBtn = document.getElementById('refresh-btn');
      const refreshBtnIcon = refreshBtn?.querySelector('.btn-icon');
      if (refreshBtn && refreshBtnIcon) {
        refreshBtn.disabled = false;
        refreshBtnIcon.innerHTML = '<span class="refresh-icon normal"></span>';
      }
    }
  }

  /**
   * 자동 새로고침 토글
   */
  toggleAutoRefresh() {
    if (this.isAutoRefreshEnabled) {
      this.stopAutoRefresh();
    } else {
      this.startAutoRefresh();
    }
  }

  /**
   * 자동 새로고침 시작
   */
  startAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.isAutoRefreshEnabled = true;
    this.autoRefreshInterval = setInterval(() => {
      // 충돌 다이얼로그가 열려있으면 새로고침 건너뛰기
      if (this.isConflictDialogOpen) {
        console.log('⏸️ 충돌 다이얼로그 열림 중 - 자동 새로고침 건너뛰기');
        return;
      }
      this.refreshProcesses();
    }, 2000); // 5초 간격

    // UI 업데이트
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.classList.add('active');
      const btnIcon = autoRefreshToggle.querySelector('.btn-icon');
      const btnText = autoRefreshToggle.querySelector('.btn-text');
      if (btnIcon)
        btnIcon.innerHTML = '<span class="auto-refresh-icon pause"></span>';
      if (btnText) btnText.textContent = '자동 새로고침 중지';
    }

    console.log('🔄 자동 새로고침 시작 (5초 간격)');
  }

  /**
   * 자동 새로고침 중지
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }

    this.isAutoRefreshEnabled = false;
    this.isConflictDialogOpen = false; // 자동 새로고침 중지 시 다이얼로그 상태도 초기화

    // UI 업데이트
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.classList.remove('active');
      const btnIcon = autoRefreshToggle.querySelector('.btn-icon');
      const btnText = autoRefreshToggle.querySelector('.btn-text');
      if (btnIcon)
        btnIcon.innerHTML = '<span class="auto-refresh-icon play"></span>';
      if (btnText) btnText.textContent = '자동 새로고침 시작';
    }

    console.log('⏸️ 자동 새로고침 중지');
  }

  /**
   * 모든 필터 초기화
   */
  clearAllFilters() {
    // ProcessList의 필터 초기화
    this.components.processList.clearAllFilters();

    // UI 폼 요소들 초기화
    const groupFilter = document.getElementById('group-filter');
    const categoryFilter = document.getElementById('category-filter');
    const typeFilter = document.getElementById('type-filter');
    const sortSelect = document.getElementById('sort-select');

    if (groupFilter) groupFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (sortSelect) sortSelect.value = 'oldest';

    // 사이드바 그룹 선택도 해제
    this.components.sidebar?.clearGroupSelection();
  }

  /**
   * 다중 연결 정보 초기화
   */
  resetMultipleIds() {
    if (
      confirm(
        '다중 연결 정보를 모두 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 현재 프로그램에서 관리 중인 모든 #2, #3... 등의 다중 세션 정보가 삭제됩니다.\n\n초기화 후 프로그램이 자동으로 재시작됩니다.'
      )
    ) {
      try {
        // PersistentMultipleIdStore 초기화
        this.stores.process.multipleIdStore.clear();

        // 알림 표시
        this.services.notification.showSuccess(
          '다중 연결 정보가 초기화되었습니다. 프로그램을 재시작합니다.'
        );

        console.log('✅ 다중 연결 정보 초기화 완료 - 재시작 요청');

        // 2초 후 강제 재시작
        setTimeout(() => {
          if (window.electronAPI && window.electronAPI.restartApp) {
            window.electronAPI.restartApp();
          } else {
            // fallback: 페이지 새로고침
            window.location.reload();
          }
        }, 2000);
      } catch (error) {
        console.error('❌ 다중 연결 정보 초기화 실패:', error);
        this.services.notification.showError('초기화 실패', error.message);
      }
    }
  }

  /**
   * 키보드 단축키 처리
   * @param {KeyboardEvent} event - 키보드 이벤트
   */
  handleKeyboardShortcuts(event) {
    // Ctrl+B: 사이드바 토글
    if (event.ctrlKey && event.key === 'b') {
      event.preventDefault();
      this.components.sidebar?.toggle();
    }

    // F5: 새로고침
    if (event.key === 'F5') {
      event.preventDefault();
      this.refreshProcesses();
    }

    // Ctrl+R: 새로고침
    if (event.ctrlKey && event.key === 'r') {
      event.preventDefault();
      this.refreshProcesses();
    }

    // Ctrl+Shift+X: 모든 필터 초기화
    if (event.ctrlKey && event.shiftKey && event.key === 'X') {
      event.preventDefault();
      this.clearAllFilters();
    }

    // Ctrl+Shift+F: 필터 토글 (대소문자 구분 없음)
    if (
      event.ctrlKey &&
      event.shiftKey &&
      (event.key === 'F' || event.key === 'f')
    ) {
      event.preventDefault();
      this.toggleFilters();
    }

    // Ctrl+M: 미니창 토글
    if (event.ctrlKey && event.key === 'm') {
      event.preventDefault();
      this.toggleMiniWindow();
    }
  }

  /**
   * 그룹 필터 옵션 업데이트
   */
  updateGroupFilterOptions() {
    const groupFilterSelect = document.getElementById('group-filter');
    if (!groupFilterSelect) return;

    const currentValue = groupFilterSelect.value;
    const groups = this.services.group.groupStore.getAllGroups();

    // 기존 옵션들 제거 (기본 옵션들 제외)
    while (groupFilterSelect.children.length > 2) {
      groupFilterSelect.removeChild(groupFilterSelect.lastChild);
    }

    // 새 그룹 옵션들 추가
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      groupFilterSelect.appendChild(option);
    });

    // 이전 선택값이 여전히 유효하면 복원
    if (currentValue && groups.find(g => g.id === currentValue)) {
      groupFilterSelect.value = currentValue;
    } else if (currentValue && currentValue !== '') {
      // 선택된 그룹이 삭제된 경우 초기화
      groupFilterSelect.value = '';
    }
  }

  /**
   * 필터 표시/숨기기 토글
   */
  toggleFilters() {
    const filtersContainer = document.getElementById('filters-container');
    const filtersToggle = document.getElementById('filters-toggle');
    const toggleIcon = filtersToggle?.querySelector('.toggle-icon');

    if (!filtersContainer || !filtersToggle) return;

    const isVisible = filtersContainer.style.display !== 'none';

    if (isVisible) {
      // 필터 숨기기
      filtersContainer.style.display = 'none';
      filtersToggle.setAttribute('aria-expanded', 'false');
      filtersToggle.title = '필터 표시 (Ctrl+Shift+F)';
      if (toggleIcon) toggleIcon.textContent = '🔼';
    } else {
      // 필터 표시
      filtersContainer.style.display = '';
      filtersToggle.setAttribute('aria-expanded', 'true');
      filtersToggle.title = '필터 숨기기 (Ctrl+Shift+F)';
      if (toggleIcon) toggleIcon.textContent = '🔽';
    }
  }

  /**
   * 미니창 토글
   */
  async toggleMiniWindow() {
    try {
      if (!window.electronAPI) {
        console.warn('electronAPI를 사용할 수 없습니다.');
        return;
      }

      const result = await window.electronAPI.toggleMiniWindow();
      if (result.success) {
        const status = result.data;
        this.updateMiniWindowButtonState(status);
        console.log('미니창 상태:', status);
      } else {
        console.error('미니창 토글 실패:', result.error);
        this.services.notification?.showError('미니창 토글 실패', result.error);
      }
    } catch (error) {
      console.error('미니창 토글 처리 실패:', error);
      this.services.notification?.showError(
        '미니창 토글 중 오류가 발생했습니다.'
      );
    }
  }

  /**
   * 미니창 버튼 상태 업데이트
   */
  updateMiniWindowButtonState(status) {
    const miniToggleBtn = document.getElementById('mini-window-toggle');
    if (!miniToggleBtn) return;

    const btnIcon = miniToggleBtn.querySelector('.btn-icon');
    const btnText = miniToggleBtn.querySelector('.btn-text');

    if (status.exists && status.visible) {
      // 미니창이 열려있는 상태
      miniToggleBtn.classList.remove('btn-primary');
      miniToggleBtn.classList.add('btn-success');
      if (btnIcon) btnIcon.textContent = '🔧';
      if (btnText) btnText.textContent = '미니창 열림';
      miniToggleBtn.title = '미니창 닫기';
    } else {
      // 미니창이 닫혀있는 상태
      miniToggleBtn.classList.remove('btn-success');
      miniToggleBtn.classList.add('btn-primary');
      if (btnIcon) btnIcon.textContent = '🔧';
      if (btnText) btnText.textContent = '미니창';
      miniToggleBtn.title = '최상위 미니창 열기';
    }
  }

  /**
   * 미니창에 현재 프로세스 데이터 전송
   */
  async sendDataToMiniWindow() {
    try {
      if (!window.electronAPI || !window.electronAPI.sendDataToMini) {
        return;
      }

      const processes = this.stores.process.getAllProcesses();
      const groups = this.stores.group.getAllGroups();

      // 프로세스에 표시용 정보를 미리 계산해서 추가
      const processesWithDisplay = processes.map(process => {
        const displayText =
          process.customLabel || KeyManager.getDisplayKey(process);

        return {
          ...process,
          displayText: displayText,
        };
      });

      // 미니창에 전송할 데이터 구성
      const data = {
        processes: processesWithDisplay,
        groups: groups,
        timestamp: Date.now(),
      };

      const result = await window.electronAPI.sendDataToMini(data);
      if (!result.success && result.error !== '미니창이 열려있지 않습니다.') {
        console.warn('미니창 데이터 전송 실패:', result.error);
      }
    } catch (error) {
      console.error('미니창 데이터 전송 중 오류:', error);
    }
  }

  /**
   * 메인창 데이터 응답 (미니창 요청 시)
   */
  sendMainDataResponse() {
    try {
      if (!window.electronAPI || !window.electronAPI.sendMainDataResponse) {
        return;
      }

      const processes = this.stores.process.getAllProcesses();
      const groups = this.stores.group.getAllGroups();

      const data = {
        processes: processes,
        groups: groups,
        timestamp: Date.now(),
      };

      window.electronAPI.sendMainDataResponse(data);
      console.log('미니창에 메인 데이터 응답 전송:', {
        processCount: processes.length,
        groupCount: groups.length,
      });
    } catch (error) {
      console.error('메인 데이터 응답 전송 중 오류:', error);
    }
  }

  /**
   * 애플리케이션 정리
   */
  cleanup() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    // 스토어 정리
    Object.values(this.stores).forEach(store => {
      if (store.cleanup) {
        store.cleanup();
      }
    });

    console.log('🧹 애플리케이션 정리 완료');
  }
}

/**
 * 애플리케이션 시작
 */
document.addEventListener('DOMContentLoaded', async () => {
  const app = new RemoteManagerApp();

  // 전역에서 접근 가능하도록 설정 (디버깅용)
  window.remoteManagerApp = app;

  await app.initialize();
});

// 에러 처리
window.addEventListener('error', event => {
  console.error('전역 에러:', event.error);
});

window.addEventListener('unhandledrejection', event => {
  console.error('처리되지 않은 Promise 거부:', event.reason);
});
