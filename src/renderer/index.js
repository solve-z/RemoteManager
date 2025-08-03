/**
 * RemoteManager v4.0 - 렌더러 프로세스 메인 엔트리포인트
 * 모듈화된 아키텍처의 시작점
 */

import { ProcessStore } from './store/ProcessStore.js';
import { GroupStore } from './store/GroupStore.js';
import { SettingsStore } from './store/SettingsStore.js';
import { ProcessService } from './services/ProcessService.js';
import { GroupService } from './services/GroupService.js';
import { NotificationService } from './services/NotificationService.js';
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
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    try {
      console.log('🚀 RemoteManager v4.0 초기화 시작');
      
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
      
      console.log('✅ RemoteManager v4.0 초기화 완료');
    } catch (error) {
      console.error('❌ 애플리케이션 초기화 실패:', error);
      this.services.notification?.showError('애플리케이션 초기화에 실패했습니다.');
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
      this.components.groupManager
    );

    // StatusBar 컴포넌트
    this.components.statusBar = new StatusBar(
      this.stores.process
    );


    // 스토어 변경 시 컴포넌트 업데이트
    this.stores.process.subscribe((processes) => {
      this.components.processList.render(processes);
      this.components.statusBar.update(processes);
    });

    this.stores.group.subscribe((groups) => {
      this.components.sidebar.updateGroups(groups);
      this.components.processList.updateGroupOptions(groups);
    });
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
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
    sortSelect?.addEventListener('change', (e) => {
      this.components.processList.setSortOption(e.target.value);
    });

    const groupFilter = document.getElementById('group-filter');
    groupFilter?.addEventListener('change', (e) => {
      this.components.processList.setGroupFilter(e.target.value);
    });

    const categoryFilter = document.getElementById('category-filter');
    categoryFilter?.addEventListener('change', (e) => {
      this.components.processList.setCategoryFilter(e.target.value);
    });

    // 새로 추가된 필터들
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');

    // 검색 입력 (디바운스 적용)
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.components.processList.setSearchQuery(e.target.value);
      }, 300);
    });

    // 검색 초기화 버튼
    clearSearchBtn?.addEventListener('click', () => {
      searchInput.value = '';
      this.components.processList.setSearchQuery('');
    });

    // 상태 필터
    statusFilter?.addEventListener('change', (e) => {
      this.components.processList.setStatusFilter(e.target.value);
    });

    // 타입 필터
    typeFilter?.addEventListener('change', (e) => {
      this.components.processList.setTypeFilter(e.target.value);
    });

    // 전체 필터 초기화
    clearAllFiltersBtn?.addEventListener('click', () => {
      this.clearAllFilters();
    });

    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // 그룹 선택 이벤트 (사이드바에서 그룹 클릭 시)
    window.addEventListener('group-selected', (e) => {
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

    // 윈도우 리사이즈
    window.addEventListener('resize', () => {
      this.components.sidebar?.handleResize();
    });

    // 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
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

    // 자동 새로고침 시작 (기본값)
    this.startAutoRefresh();
  }

  /**
   * 프로세스 새로고림
   */
  async refreshProcesses() {
    try {
      const loadingState = document.getElementById('loading-state');
      const emptyState = document.getElementById('empty-state');
      const processListContainer = document.getElementById('process-list-container');
      const refreshBtn = document.getElementById('refresh-btn');

      // 새로고침 버튼 비활성화
      if (refreshBtn) {
        refreshBtn.disabled = true;
        
        // 2초 후 복원
        setTimeout(() => {
          refreshBtn.disabled = false;
        }, 2000);
      }

      // 기존 프로세스가 있는 경우 목록을 유지하고, 상단에 작은 로딩 인디케이터만 표시
      const currentProcesses = this.stores.process.getAllProcesses();
      if (currentProcesses.length > 0) {
        // 기존 리스트 위에 작은 로딩 바 표시
        let loadingBar = document.getElementById('refresh-loading-bar');
        if (!loadingBar) {
          loadingBar = document.createElement('div');
          loadingBar.id = 'refresh-loading-bar';
          loadingBar.innerHTML = '<div class="loading-progress"></div>';
          loadingBar.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--color-background-secondary);
            z-index: 1000;
            overflow: hidden;
          `;
          loadingBar.querySelector('.loading-progress').style.cssText = `
            height: 100%;
            background: var(--color-primary);
            animation: loading-progress 1s ease-in-out infinite;
            transform: translateX(-100%);
          `;
          processListContainer.style.position = 'relative';
          processListContainer.insertBefore(loadingBar, processListContainer.firstChild);
        }
        loadingBar.style.display = 'block';
        
        // 프로세스 로드
        await this.services.process.loadProcesses();
        
        // 로딩 바 숨김
        loadingBar.style.display = 'none';
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

    } catch (error) {
      console.error('프로세스 새로고침 실패:', error);
      const loadingState = document.getElementById('loading-state');
      const loadingBar = document.getElementById('refresh-loading-bar');
      if (loadingState) loadingState.style.display = 'none';
      if (loadingBar) loadingBar.style.display = 'none';
      
      // 새로고침 버튼 복원
      const refreshBtn = document.getElementById('refresh-btn');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '새로고침';
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
      this.refreshProcesses();
    }, 5000); // 5초 간격

    // UI 업데이트
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.classList.add('active');
      autoRefreshToggle.querySelector('.btn-text').textContent = '자동 새로고침 중지';
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

    // UI 업데이트
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.classList.remove('active');
      autoRefreshToggle.querySelector('.btn-text').textContent = '자동 새로고침';
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
    const searchInput = document.getElementById('search-input');
    const groupFilter = document.getElementById('group-filter');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    const sortSelect = document.getElementById('sort-select');
    
    if (searchInput) searchInput.value = '';
    if (groupFilter) groupFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (sortSelect) sortSelect.value = 'default';
    
    // 사이드바 그룹 선택도 해제
    this.components.sidebar?.clearGroupSelection();
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
window.addEventListener('error', (event) => {
  console.error('전역 에러:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('처리되지 않은 Promise 거부:', event.reason);
});