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
import { LogService } from './services/LogService.js';

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
    this.services.log = new LogService();
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

    // 미니창 위치/프리셋 드롭다운 패널 토글 및 이벤트
    const presetToggleBtn = document.getElementById('main-mini-preset-toggle');
    const presetPanel = document.getElementById('main-mini-preset-panel');
    const presetListContainer = document.getElementById('preset-list-container');
    const presetAddBtn = document.getElementById('preset-add-btn');

    presetToggleBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const isVisible = presetPanel.style.display !== 'none';
      presetPanel.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) renderPresetList();
    });

    document.addEventListener('click', e => {
      if (presetPanel && !presetPanel.contains(e.target) && e.target !== presetToggleBtn) {
        presetPanel.style.display = 'none';
      }
    });

    // 프리셋 데이터 로드 및 마이그레이션
    const getPresetsData = () => {
      try {
        const raw = localStorage.getItem('mini_window_presets_v2');
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('프리셋 로드 실패:', e);
      }
      // 구 버전 마이그레이션
      let old1 = null, old2 = null;
      try {
        const r1 = localStorage.getItem('mini_window_preset_1');
        if (r1) old1 = JSON.parse(r1);
        const r2 = localStorage.getItem('mini_window_preset_2');
        if (r2) old2 = JSON.parse(r2);
      } catch (e) {}

      const defaultPresets = [
        { id: 'preset_1', name: '프리셋 1 (1열 기본)', bounds: old1 },
        { id: 'preset_2', name: '프리셋 2 (2열 와이드)', bounds: old2 },
        { id: 'preset_3', name: '프리셋 3', bounds: null },
        { id: 'preset_4', name: '프리셋 4', bounds: null },
      ];
      localStorage.setItem('mini_window_presets_v2', JSON.stringify(defaultPresets));
      return defaultPresets;
    };

    const savePresetsData = presets => {
      localStorage.setItem('mini_window_presets_v2', JSON.stringify(presets));
      renderPresetList();
    };

    // 프리셋 목록 렌더링
    const renderPresetList = () => {
      if (!presetListContainer) return;
      const presets = getPresetsData();
      presetListContainer.innerHTML = '';

      presets.forEach((preset, index) => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.dataset.id = preset.id;

        const boundsText = preset.bounds
          ? `${preset.bounds.width}×${preset.bounds.height}`
          : '미저장';
        const hasBounds = !!preset.bounds;
        const canDelete = presets.length > 2; // 최소 2개는 유지

        card.innerHTML = `
          <div class="preset-header-row">
            <div class="preset-name-area">
              <span class="preset-name-label" title="클릭하여 이름 수정">${preset.name}</span>
              <input type="text" class="preset-name-input" value="${preset.name}" style="display: none;" maxlength="30" />
              <button class="preset-rename-btn" title="이름 수정">✏️</button>
            </div>
            <div class="preset-status-tag ${hasBounds ? 'has-bounds' : ''}" title="${hasBounds ? `X: ${preset.bounds.x}, Y: ${preset.bounds.y}` : '위치가 저장되지 않음'}">
              ${boundsText}
            </div>
          </div>
          <div class="preset-actions-row">
            <button class="preset-action-btn load-btn" ${!hasBounds ? 'disabled' : ''} title="${hasBounds ? '이 위치로 미니창 이동' : '저장된 위치가 없습니다'}">불러오기</button>
            <button class="preset-action-btn save-btn" title="현재 미니창 크기/위치를 이 프리셋에 저장">현재 위치 저장</button>
            ${canDelete ? `<button class="preset-action-btn delete-btn" title="프리셋 삭제">🗑️</button>` : ''}
          </div>
        `;

        // 1. 이름 수정 처리
        const label = card.querySelector('.preset-name-label');
        const input = card.querySelector('.preset-name-input');
        const renameBtn = card.querySelector('.preset-rename-btn');

        const startRename = () => {
          label.style.display = 'none';
          renameBtn.style.display = 'none';
          input.style.display = 'inline-block';
          input.focus();
          input.select();
        };

        const finishRename = () => {
          const newName = input.value.trim() || preset.name;
          label.textContent = newName;
          input.style.display = 'none';
          label.style.display = 'inline';
          renameBtn.style.display = 'inline';

          if (newName !== preset.name) {
            preset.name = newName;
            const updated = getPresetsData().map(p => p.id === preset.id ? { ...p, name: newName } : p);
            savePresetsData(updated);
            this.services.notification?.showSuccess(`프리셋 이름이 '${newName}'(으)로 변경되었습니다.`);
          }
        };

        renameBtn?.addEventListener('click', e => {
          e.stopPropagation();
          startRename();
        });
        label?.addEventListener('click', e => {
          e.stopPropagation();
          startRename();
        });
        input?.addEventListener('blur', finishRename);
        input?.addEventListener('keydown', e => {
          if (e.key === 'Enter') finishRename();
          if (e.key === 'Escape') {
            input.value = preset.name;
            input.style.display = 'none';
            label.style.display = 'inline';
            renameBtn.style.display = 'inline';
          }
        });

        // 2. 현재 위치 저장
        card.querySelector('.save-btn')?.addEventListener('click', async e => {
          e.stopPropagation();
          try {
            const boundsResult = await window.electronAPI.getMiniBounds();
            if (!boundsResult?.success || !boundsResult?.data) {
              this.services.notification?.showWarning('미니창이 열려있지 않습니다. 먼저 미니창을 열어주세요.');
              return;
            }
            const updated = getPresetsData().map(p =>
              p.id === preset.id ? { ...p, bounds: boundsResult.data } : p
            );
            savePresetsData(updated);
            this.services.notification?.showSuccess(
              `'${preset.name}'에 현재 미니창 위치(${boundsResult.data.width}×${boundsResult.data.height})가 저장되었습니다.`
            );
          } catch (err) {
            this.services.notification?.showError('저장 실패', err.message);
          }
        });

        // 3. 불러오기
        card.querySelector('.load-btn')?.addEventListener('click', async e => {
          e.stopPropagation();
          if (!preset.bounds) {
            this.services.notification?.showWarning('저장된 위치가 없습니다. 먼저 저장을 눌러주세요.');
            return;
          }
          try {
            const getStatus = window.electronAPI.getMiniStatus || window.electronAPI.getMiniWindowStatus;
            const showWindow = window.electronAPI.showMiniWindow || window.electronAPI.openMiniWindow;
            const status = getStatus ? await getStatus() : null;
            if (!status?.data?.exists || !status?.data?.visible) {
              if (showWindow) await showWindow();
            }
            const setResult = await window.electronAPI.setMiniBounds(preset.bounds);
            if (setResult && setResult.success) {
              this.services.notification?.showSuccess(`'${preset.name}' 위치로 미니창을 이동했습니다.`);
              if (presetPanel) presetPanel.style.display = 'none';
            } else {
              this.services.notification?.showError('이동 실패', setResult?.error || '알 수 없는 오류');
            }
          } catch (err) {
            this.services.notification?.showError('불러오기 오류', err.message);
          }
        });

        // 4. 삭제
        card.querySelector('.delete-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          if (confirm(`'${preset.name}' 프리셋을 삭제하시겠습니까?`)) {
            const updated = getPresetsData().filter(p => p.id !== preset.id);
            savePresetsData(updated);
            this.services.notification?.showSuccess(`'${preset.name}' 프리셋이 삭제되었습니다.`);
          }
        });

        presetListContainer.appendChild(card);
      });
    };

    // 프리셋 추가 버튼
    presetAddBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const presets = getPresetsData();
      const newIndex = presets.length + 1;
      const newPreset = {
        id: 'preset_' + Date.now(),
        name: `프리셋 ${newIndex}`,
        bounds: null
      };
      presets.push(newPreset);
      savePresetsData(presets);
      this.services.notification?.showSuccess(`새 프리셋 '프리셋 ${newIndex}'이 추가되었습니다.`);
    });

    // 1. 미니창 위치 초기화 (기본 336px)
    document.getElementById('main-preset-reset-btn')?.addEventListener('click', async () => {
      try {
        const getStatus = window.electronAPI.getMiniStatus || window.electronAPI.getMiniWindowStatus;
        const showWindow = window.electronAPI.showMiniWindow || window.electronAPI.openMiniWindow;
        const status = getStatus ? await getStatus() : null;
        if (!status?.data?.exists || !status?.data?.visible) {
          if (showWindow) await showWindow();
        }
        const result = await window.electronAPI.resetMiniPosition();
        if (result && result.success) {
          this.services.notification?.showSuccess('미니창 위치가 기본값(336px 1열)으로 초기화되었습니다.');
          if (presetPanel) presetPanel.style.display = 'none';
        } else {
          this.services.notification?.showError('위치 초기화 실패', result?.error || '알 수 없는 오류');
        }
      } catch (err) {
        this.services.notification?.showError('오류', err.message);
      }
    });

    // 초기 렌더링 호출
    renderPresetList();

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

    // 미니창과 자동 새로고침 상태 동기화
    if (window.electronAPI && window.electronAPI.onAutoRefreshSync) {
      window.electronAPI.onAutoRefreshSync(({ enabled, interval }) => {
        console.log('⚡ 미니창으로부터 자동 새로고침 동기화 수신:', { enabled, interval });
        if (enabled) {
          this.startAutoRefresh(interval || 5000, false);
        } else {
          this.stopAutoRefresh(false);
        }
      });
    }

    // 사이드바 리사이저 기능
    this.setupSidebarResizer();

    // 네비게이션-그룹 세로 리사이저 기능
    this.setupNavGroupsResizer();

    // 사이드바 네비게이션 탭 전환 이벤트
    window.addEventListener('navigation', e => {
      const navId = e.detail?.navigationId;
      const logsView = document.getElementById('logs-view-container');
      const processContainer = document.getElementById('process-list-container');
      const filtersHeader = document.querySelector('.filters-header');
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');

      if (navId === 'nav-logs') {
        if (logsView) logsView.style.display = 'flex';
        if (processContainer) processContainer.style.display = 'none';
        if (filtersHeader) filtersHeader.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (loadingState) loadingState.style.display = 'none';
        this.renderLogsView();
      } else {
        if (logsView) logsView.style.display = 'none';
        if (filtersHeader) filtersHeader.style.display = 'flex';
        const processes = this.stores.process.getAllProcesses();
        if (processes.length > 0) {
          if (processContainer) processContainer.style.display = 'block';
          if (emptyState) emptyState.style.display = 'none';
        } else {
          if (processContainer) processContainer.style.display = 'none';
          if (emptyState) emptyState.style.display = 'flex';
        }
      }
    });

    // 로그 뷰 검색 및 삭제 이벤트
    document.getElementById('logs-search-input')?.addEventListener('input', () => {
      this.renderLogsView();
    });
    document.getElementById('logs-refresh-btn')?.addEventListener('click', () => {
      this.renderLogsView();
      this.services.notification?.showSuccess('로그 목록이 새로고침되었습니다.');
    });
    document.getElementById('logs-clear-btn')?.addEventListener('click', () => {
      if (confirm('접속 기록을 모두 삭제하시겠습니까?')) {
        this.services.log.clearAllLogs();
        this.renderLogsView();
        this.services.notification?.showSuccess('접속 기록이 모두 삭제되었습니다.');
      }
    });
  }

  /**
   * 새로고침 처리 (미니창 요청용)
   */
  async handleRefresh() {
    console.log('🔄 미니창 요청으로 새로고침 실행');
    await this.refreshProcesses();
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

        case 'move':
          console.log('↕️ 미니창에서 그룹 순서 변경 요청:', data);
          const moveSuccess = this.services.group.moveGroup(data.id, data.direction);
          result = { success: moveSuccess };
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

      // 원격 프로세스 접속/종료 이력 로그 기록
      this.services.log?.trackProcessChanges(processes);
      const logsView = document.getElementById('logs-view-container');
      if (logsView && logsView.style.display !== 'none') {
        this.renderLogsView();
      }

      // 새로고침 후 미니창에 최신 프로세스/그룹 데이터 동기화
      this.sendDataToMiniWindow();
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
      this.stopAutoRefresh(true);
    } else {
      this.startAutoRefresh(5000, true);
    }
  }

  /**
   * 자동 새로고침 시작
   */
  startAutoRefresh(intervalMs = 5000, shouldSync = true) {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.isAutoRefreshEnabled = true;
    this.refreshIntervalMs = intervalMs;
    this.autoRefreshInterval = setInterval(() => {
      // 충돌 다이얼로그가 열려있으면 새로고침 건너뛰기
      if (this.isConflictDialogOpen) {
        console.log('⏸️ 충돌 다이얼로그 열림 중 - 자동 새로고침 건너뛰기');
        return;
      }
      this.refreshProcesses();
    }, this.refreshIntervalMs);

    // UI 업데이트
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.classList.add('active');
      const btnIcon = autoRefreshToggle.querySelector('.btn-icon');
      const btnText = autoRefreshToggle.querySelector('.btn-text');
      if (btnIcon)
        btnIcon.innerHTML = '<span class="auto-refresh-icon pause"></span>';
      if (btnText) btnText.textContent = `자동 새로고침 중지 (${this.refreshIntervalMs / 1000}초)`;
    }

    console.log(`🔄 자동 새로고침 시작 (${this.refreshIntervalMs / 1000}초 간격)`);

    if (shouldSync && window.electronAPI && window.electronAPI.syncAutoRefresh) {
      window.electronAPI.syncAutoRefresh({
        enabled: true,
        interval: this.refreshIntervalMs,
      });
    }
  }

  /**
   * 자동 새로고침 중지
   */
  stopAutoRefresh(shouldSync = true) {
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

    if (shouldSync && window.electronAPI && window.electronAPI.syncAutoRefresh) {
      window.electronAPI.syncAutoRefresh({
        enabled: false,
        interval: this.refreshIntervalMs || 5000,
      });
    }
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
   * 접속 로그 뷰 렌더링
   */
  renderLogsView() {
    const tableBody = document.getElementById('logs-table-body');
    const emptyEl = document.getElementById('logs-empty');
    const countInfo = document.getElementById('logs-count-info');
    const searchInput = document.getElementById('logs-search-input');

    if (!tableBody || !this.services.log) return;

    const query = searchInput ? searchInput.value.trim() : '';
    const logs = this.services.log.getLogs({ search: query });

    if (countInfo) {
      countInfo.textContent = `총 ${logs.length}건`;
    }

    if (logs.length === 0) {
      tableBody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    tableBody.innerHTML = logs.map(log => {
      const startDate = new Date(log.startTime).toLocaleString('ko-KR');
      const endDate = log.endTime
        ? new Date(log.endTime).toLocaleString('ko-KR')
        : '<span class="log-active-status">연결 중</span>';
      const duration = log.endTime
        ? log.durationText
        : '<span class="log-active-status">측정 중...</span>';
      const displayName = log.customLabel
        ? `${log.computerName} (${log.customLabel})`
        : log.computerName;

      return `
        <tr>
          <td>${startDate}</td>
          <td><span class="badge ${log.processType?.toLowerCase()}">${log.processType}</span></td>
          <td><strong>${displayName}</strong></td>
          <td><code>${log.ipAddress}</code></td>
          <td>${endDate}</td>
          <td>${duration}</td>
          <td><small>${log.pid || '-'}</small></td>
        </tr>
      `;
    }).join('');
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
