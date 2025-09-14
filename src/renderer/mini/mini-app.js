/**
 * MiniApp - 미니창 애플리케이션 엔트리포인트
 * 트리 구조 기반 원격 프로세스 관리
 */

import { MiniTreeView } from './MiniTreeView.js';
import { ConflictNotification } from './components/ConflictNotification.js';
import { MiniGroupManager } from './components/MiniGroupManager.js';
/**
 * 미니창 애플리케이션 클래스
 */
class MiniApp {
  constructor() {
    this.treeView = null;
    this.isInitialized = false;
    this.currentOpacity = 0.9;
    this.selectedProcessId = null;
    this.isCollapsed = false;
    this.conflictNotification = new ConflictNotification();
    this.groupManager = null;
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    try {
      console.log('🚀 MiniApp 초기화 시작');

      // 1. 저장된 상태 복원
      this.loadCollapseState();

      // 2. UI 컴포넌트 초기화
      await this.initializeComponents();

      // 3. 이벤트 리스너 설정
      this.setupEventListeners();

      // 4. 초기 데이터 로드
      await this.loadInitialData();

      // 5. 메인 프로세스와 통신 설정
      this.setupMainProcessCommunication();

      // 6. 초기 접기/펼치기 상태 적용
      this.applyCollapseState();

      this.isInitialized = true;
      console.log('✅ MiniApp 초기화 완료');

    } catch (error) {
      console.error('❌ MiniApp 초기화 실패:', error);
      this.showError('미니창 초기화에 실패했습니다.');
    }
  }

  /**
   * UI 컴포넌트 초기화
   */
  async initializeComponents() {
    // TreeView 컴포넌트 초기화
    const treeContainer = document.getElementById('tree-container');
    this.treeView = new MiniTreeView(treeContainer);

    // GroupManager 초기화
    this.groupManager = new MiniGroupManager(this);

    // TreeView 이벤트 리스너
    this.treeView.on('process-selected', (processId) => {
      this.handleProcessSelection(processId);
    });

    this.treeView.on('process-focus', (processId) => {
      this.handleProcessFocus(processId);
    });

    this.treeView.on('process-copy', (processId) => {
      this.handleProcessCopy(processId);
    });

    this.treeView.on('process-delete', (processId) => {
      this.handleProcessDelete(processId);
    });

    // 그룹 관리 이벤트 리스너
    this.treeView.on('group-edit', (group) => {
      this.groupManager.showEditGroupDialog(group);
    });

    this.treeView.on('group-delete', (group) => {
      this.groupManager.showDeleteGroupDialog(group);
    });

    this.treeView.on('process-group-change', async (data) => {
      await this.handleProcessGroupChange(data);
    });

    // process-reorder 이벤트 리스너 제거 (미니창 내부에서만 처리)
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 타이틀바 버튼들
    const closeBtn = document.getElementById('mini-close-btn');
    const opacityBtn = document.getElementById('mini-opacity-btn');
    const helpBtn = document.getElementById('mini-help-btn');
    const createGroupBtn = document.getElementById('mini-create-group-btn');
    const toggleBtn = document.getElementById('mini-toggle-btn');

    closeBtn?.addEventListener('click', () => {
      this.closeWindow();
    });

    opacityBtn?.addEventListener('click', () => {
      this.toggleOpacityPanel();
    });

    helpBtn?.addEventListener('click', () => {
      this.toggleHelpPanel();
    });

    createGroupBtn?.addEventListener('click', () => {
      console.log('➕ 그룹 생성 버튼 클릭');
      this.groupManager.showCreateGroupDialog();
    });

    toggleBtn?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // 더블클릭 기능 제거 - 버튼만 사용

    // 투명도 조절
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');

    opacitySlider?.addEventListener('input', (e) => {
      const opacity = parseInt(e.target.value) / 100;
      this.setOpacity(opacity);
      opacityValue.textContent = `${e.target.value}%`;
    });

    // 컨텍스트 메뉴
    this.setupContextMenu();

    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // 윈도우 포커스/블러 시 투명도 자동 조절 기능 제거
    // 사용자가 설정한 투명도를 그대로 유지
  }

  /**
   * 컨텍스트 메뉴 설정
   */
  setupContextMenu() {
    const contextMenu = document.getElementById('mini-context-menu');

    // 우클릭으로 컨텍스트 메뉴 표시
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    });

    // 클릭으로 컨텍스트 메뉴 숨김
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // 컨텍스트 메뉴 항목 이벤트
    document.getElementById('context-focus')?.addEventListener('click', () => {
      if (this.selectedProcessId) {
        this.handleProcessFocus(this.selectedProcessId);
      }
    });

    document.getElementById('context-copy')?.addEventListener('click', () => {
      if (this.selectedProcessId) {
        this.handleProcessCopy(this.selectedProcessId);
      }
    });

    document.getElementById('context-expand-all')?.addEventListener('click', () => {
      this.treeView?.expandAll();
    });

    document.getElementById('context-collapse-all')?.addEventListener('click', () => {
      this.treeView?.collapseAll();
    });
  }

  /**
   * 메인 프로세스와의 통신 설정
   */
  setupMainProcessCommunication() {
    // 메인창으로부터 프로세스 데이터 수신
    if (window.electronAPI && window.electronAPI.onMainDataUpdate) {
      window.electronAPI.onMainDataUpdate((data) => {
        console.log('📦 메인창으로부터 데이터 수신:', data);
        this.handleMainDataUpdate(data);
      });

      // 미니창이 열렸을 때 즉시 메인창 데이터 요청
      this.requestMainData();
    }

    // 충돌 알림 리스너 (간단하게)
    if (window.electronAPI && window.electronAPI.onConflictDetected) {
      window.electronAPI.onConflictDetected((conflictData) => {
        console.log('충돌 알림 수신:', conflictData);
        this.handleConflictAlert(conflictData);
      });
    }
  }


  // 3. 기존 충돌 알림 핸들러를 ConflictNotification 사용으로 변경
  handleConflictAlert(conflictData) {
    console.log('⚠️ 충돌 알림 수신:', conflictData);

    // 기존: alert() 방식
    // alert(`충돌 감지: ${conflictData.computerName}`);

    // 새로운: ConflictNotification 사용
    if (this.conflictNotification) {
      this.conflictNotification.show(conflictData);
    }
  }
  /**
   * 초기 데이터 로드
   */
  async loadInitialData() {
    this.showLoading(true);

    try {
      await this.refreshProcesses();
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      this.showError('데이터 로드에 실패했습니다.');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 메인창 데이터 요청
   */
  async requestMainData() {
    try {
      if (!window.electronAPI || !window.electronAPI.requestMainData) {
        console.warn('메인창 데이터 요청 API를 사용할 수 없습니다.');
        return;
      }

      console.log('📤 메인창에 데이터 요청 전송');
      const result = await window.electronAPI.requestMainData();
      if (result.success) {
        console.log('📦 메인창 데이터 수신 성공:', result.data);
        this.handleMainDataUpdate(result.data);
      } else {
        console.error('메인창 데이터 요청 실패:', result.error);
        // 실패 시 테스트 데이터 로드
        await this.loadTestData();
      }
    } catch (error) {
      console.error('메인창 데이터 요청 중 오류:', error);
      await this.loadTestData();
    }
  }

  /**
   * 메인창으로부터 받은 데이터 처리
   */
  async handleMainDataUpdate(data) {
    try {
      if (!data || !data.processes) {
        console.warn('유효하지 않은 메인창 데이터:', data);
        return;
      }


      console.log('🔄 메인창 데이터 처리 중:', {
        processCount: data.processes.length,
        groupCount: data.groups?.length || 0
      });

      // 그룹 정보를 먼저 저장
      this.mainGroups = data.groups || [];

      // 메인창의 프로세스 데이터를 미니창 형식으로 변환 (최신 그룹 정보 반영)
      const transformedProcesses = data.processes.map(process => this.transformMainProcessData(process));

      await this.updateProcessData(transformedProcesses);
      this.updateStatusBar(transformedProcesses);

      // TreeView 강제 새로고침 (그룹 정보 변경 반영)
      if (this.treeView) {
        const groupedProcesses = this.groupProcesses(transformedProcesses);
        await this.treeView.updateData(groupedProcesses);
      }

    } catch (error) {
      console.error('메인창 데이터 처리 실패:', error);
    }
  }

  /**
   * 메인창 프로세스 데이터를 미니창 형식으로 변환
   */
  transformMainProcessData(mainProcess) {
    return {
      id: mainProcess.id,
      type: mainProcess.type,
      status: mainProcess.status,
      computerName: mainProcess.computerName || mainProcess.name,
      customLabel: mainProcess.customLabel,
      ip: mainProcess.ipAddress, // 실제 필드명 사용
      ipAddress: mainProcess.ipAddress, // KeyManager가 사용하는 필드
      counselorId: mainProcess.counselorId,
      pid: mainProcess.pid,
      windowHandle: mainProcess.windowHandle,
      windowTitle: mainProcess.windowTitle, // KeyManager가 detectProcessType에 필요
      processName: mainProcess.processName, // KeyManager가 detectProcessType에 필요
      title: mainProcess.windowTitle, // 실제 필드명 사용
      multipleId: mainProcess.multipleId,
      category: mainProcess.category || 'uncategorized',
      groupId: mainProcess.groupId,
      groupName: this.getGroupNameById(mainProcess.groupId)
    };
  }

  /**
   * 그룹 ID로 그룹명 찾기
   */
  getGroupNameById(groupId) {
    if (!groupId || !this.mainGroups) return null;
    const group = this.mainGroups.find(g => g.id === groupId);
    return group ? group.name : null;
  }

  /**
   * 그룹 ID로 그룹 색상 찾기
   */
  getGroupColorById(groupId) {
    if (!groupId || !this.mainGroups) return null;
    const group = this.mainGroups.find(g => g.id === groupId);
    return group ? group.color : null;
  }

  /**
   * 프로세스 데이터 새로고침 (메인창에 새로고침 요청)
   */
  async refreshProcesses() {
    console.log('🔄 프로세스 새로고침 - 메인창에 새로고침 요청');

    try {
      // 메인창에 새로고침 요청
      if (window.electronAPI && window.electronAPI.requestMainRefresh) {
        const result = await window.electronAPI.requestMainRefresh();
        if (result.success) {
          console.log('✅ 메인창 새로고침 요청 성공');
          // 새로고침 후 데이터 받아오기
          await this.requestMainData();
        } else {
          console.error('❌ 메인창 새로고침 요청 실패:', result.error);
          // 실패 시 미니창만 새로고침
          await this.requestMainData();
        }
      } else {
        // API가 없으면 미니창만 새로고침
        console.warn('메인창 새로고침 API가 없어서 미니창 데이터만 재요청');
        await this.requestMainData();
      }

      this.showNotification('새로고침 완료', 'success');
    } catch (error) {
      console.error('새로고침 실패:', error);
      this.showNotification('새로고침 실패', 'error');
    }
  }

  /**
   * 테스트용 프로세스 데이터 로드
   */
  async loadTestData() {
    console.log('🧪 테스트 데이터 로드 중...');

    // 테스트용 그룹 데이터 설정
    this.mainGroups = [
      {
        id: 'group_1',
        name: '접속자(일반모드)',
        color: '#3b82f6'
      }
    ];

    const testProcesses = [
      {
        id: 'test_1',
        type: 'EZHELP',
        status: 'connected',
        computerName: 'PC-01',
        ip: '192.168.1.10',
        counselorId: '46',
        pid: 1234,
        windowHandle: 123456,
        title: 'ezHelp - PC-01',
        category: 'xray',
        groupId: 'group_1',
        groupName: '접속자(일반모드)'
      },
      {
        id: 'test_2',
        type: 'TEAMVIEWER',
        status: 'connected',
        computerName: 'SERVER-05',
        pid: 2345,
        windowHandle: 234567,
        title: 'SERVER-05 - TeamViewer',
        multipleId: 2,
        category: 'other-server',
        groupId: 'group_1',
        groupName: '접속자(일반모드)'
      },
      {
        id: 'test_3',
        type: 'EZHELP',
        status: 'disconnected',
        computerName: 'LAPTOP-3',
        ip: '192.168.1.20',
        counselorId: '12',
        pid: 3456,
        windowHandle: 345678,
        title: 'ezHelp - LAPTOP-3',
        multipleId: 3,
        category: 'new-server',
        groupId: 'group_1',
        groupName: '접속자(일반모드)'
      },
      {
        id: 'test_4',
        type: 'TEAMVIEWER',
        status: 'connected',
        computerName: 'WORK-STATION',
        pid: 4567,
        windowHandle: 456789,
        title: 'WORK-STATION - TeamViewer',
        category: 'old-server',
        groupId: null,
        groupName: null
      }
    ];

    await this.updateProcessData(testProcesses);
    this.updateStatusBar(testProcesses);
  }

  /**
   * 프로세스 데이터 업데이트
   */
  async updateProcessData(processes) {
    if (!this.treeView) return;

    // 그룹별로 프로세스 분류
    const groupedProcesses = this.groupProcesses(processes);

    // TreeView 업데이트
    await this.treeView.updateData(groupedProcesses);

    // 빈 상태 처리 제거 - 항상 트리 구조를 보여줌 (원래창과 동일)
    // const isEmpty = processes.length === 0;
    // this.showEmptyState(isEmpty);
    this.showEmptyState(false);
  }

  /**
   * 프로세스를 그룹별로 분류
   */
  groupProcesses(processes) {
    const groups = new Map();

    // 먼저 모든 그룹을 추가 (프로세스가 없어도 표시)
    if (this.mainGroups && this.mainGroups.length > 0) {
      this.mainGroups.forEach(group => {
        groups.set(group.name, {
          name: group.name,
          id: group.id,
          color: group.color,
          processes: []
        });
      });
    }

    // "그룹없음" 그룹을 항상 추가 (프로세스가 없어도 표시)
    if (!groups.has('그룹없음')) {
      groups.set('그룹없음', {
        name: '그룹없음',
        id: 'ungrouped',
        color: null,
        processes: []
      });
    }

    processes.forEach(process => {
      // 프로세스 데이터 구조 변환
      const processData = this.transformProcessData(process);
      const groupName = processData.groupName || '그룹없음';
      const groupId = processData.groupId || 'ungrouped';

      if (!groups.has(groupName)) {
        groups.set(groupName, {
          name: groupName,
          id: groupId,
          color: this.getGroupColorById(groupId),
          processes: []
        });
      }

      groups.get(groupName).processes.push(processData);
    });

    // 각 그룹 내의 프로세스들을 오래된순으로 정렬 (모든 그룹 동일)
    // 오래된 것이 위(인덱스 0), 새로운 것이 아래(인덱스 끝)
    groups.forEach(group => {
      group.processes.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateA - dateB; // 오름차순: 오래된 것이 위로, 새것이 아래로
      });
    });

    return Array.from(groups.values());
  }

  /**
   * 원시 프로세스 데이터를 미니창용 형태로 변환
   */
  transformProcessData(process) {
    return {
      id: process.id || process.windowHandle || process.pid,
      type: process.type || 'UNKNOWN',
      status: process.status || 'connected',
      computerName: process.computerName || process.name || 'Unknown',
      customLabel: process.customLabel, // 누락된 customLabel 필드 추가
      ip: process.ip,
      ipAddress: process.ipAddress, // ipAddress 필드도 추가
      counselorId: process.counselorId,
      pid: process.pid,
      windowHandle: process.windowHandle,
      title: process.title,
      multipleId: process.multipleId,
      category: process.category || 'uncategorized',
      groupId: process.groupId,
      groupName: process.groupName,
      // 정렬을 위한 시간 필드들 추가
      createdAt: process.createdAt,
      firstDetected: process.firstDetected,
      lastUpdated: process.lastUpdated
    };
  }

  /**
   * 프로세스 선택 처리
   */
  handleProcessSelection(processId) {
    this.selectedProcessId = processId;
    console.log('프로세스 선택됨:', processId);
  }

  /**
   * 프로세스 포커스 처리
   */
  async handleProcessFocus(processId) {
    try {
      if (!window.electronAPI) return;

      const process = await this.getProcessById(processId);
      if (!process) return;

      const focusData = {
        id: process.windowHandle || process.pid,
        useHandle: !!process.windowHandle,
        processType: process.type?.toLowerCase()
      };

      const result = await window.electronAPI.focusWindow(focusData);
      if (result.success) {
        console.log('포커스 성공:', processId);
        this.showNotification('원격창이 포커스되었습니다.', 'success');
      } else {
        console.error('포커스 실패:', result.error);
        this.showNotification('포커스에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('포커스 처리 실패:', error);
      this.showNotification('포커스 처리 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 프로세스 정보 복사 처리
   */
  async handleProcessCopy(processId) {
    try {
      const process = await this.getProcessById(processId);
      if (!process) return;

      const copyText = this.formatCopyText(process);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(copyText);
        this.showNotification('클립보드에 복사되었습니다.', 'success');
      } else {
        console.warn('클립보드 API를 사용할 수 없습니다.');
      }
    } catch (error) {
      console.error('복사 처리 실패:', error);
      this.showNotification('복사에 실패했습니다.', 'error');
    }
  }


  /**
   * 복사할 텍스트 형식 생성
   */
  formatCopyText(process) {
    console.log(process, "test")
    if (process.type === 'ezhelp' && process.ip && process.computerName) {
      return `${process.ip}[${process.computerName.toLowerCase()}]`;
    } else if (process.type === 'teamviewer' && process.computerName) {
      return `[${process.computerName.toLowerCase()}]`;
    } else {
      return process.title || process.computerName || 'Unknown';
    }
  }

  /**
   * 삭제 처리 메서드
   */
  async handleProcessDelete(processId) {
    try {
      if (!window.electronAPI?.requestProcessDelete) return;

      // 삭제 전에 해당 프로세스를 찾아서 그룹 정보 확인
      const processInfo = this.treeView?.getProcessById(processId);

      const result = await window.electronAPI.requestProcessDelete(processId);
      console.log(result, "result")

      if (result.success) {
        // 삭제 성공 시 순서 정보에서도 제거
        if (processInfo && this.treeView) {
          const groupId = this.findProcessGroupId(processId);
          if (groupId) {
            this.treeView.removeProcessFromCustomOrder(processId, groupId);
          }
        }

        this.showNotification('프로세스가 삭제되었습니다.', 'success');
      } else {
        this.showNotification('삭제에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('삭제 처리 오류:', error);
      this.showNotification('삭제 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 프로세스가 속한 그룹 ID 찾기
   */
  findProcessGroupId(processId) {
    if (!this.treeView?.groups) return null;

    for (const group of this.treeView.groups) {
      if (group.processes.some(p => p.id === processId)) {
        return group.id;
      }
    }
    return null;
  }

  /**
   * 프로세스 그룹 변경 처리
   */
  async handleProcessGroupChange(data) {
    try {
      // 그룹 변경 시 순서 정보 정리
      if (this.treeView && data.fromGroupId !== data.toGroupId) {
        // 1. 기존 그룹의 순서 정보에서 해당 프로세스 제거
        this.treeView.removeProcessFromCustomOrder(data.processId, data.fromGroupId);

        // 2. 대상 그룹의 순서 정보에서도 해당 프로세스 제거 (기본 정렬로 배치되도록)
        this.treeView.removeProcessFromTargetGroupOrder(data.processId, data.toGroupId);
      }

      const result = await this.groupManager.changeProcessGroup(
        data.processId,
        data.fromGroupId,
        data.toGroupId
      );

      if (result.success) {
        // 성공 시에는 조용히 처리 (메인창에서 이미 알림)
        console.log('✅ 프로세스 그룹 변경 성공 - 순서 정보 정리 완료');
      } else {
        this.showNotification(result.error || '그룹 변경 실패', 'error');
      }
    } catch (error) {
      console.error('프로세스 그룹 변경 실패:', error);
      this.showNotification('그룹 변경 오류', 'error');
    }
  }

  /**
   * 프로세스 순서 변경 처리 (미니창 내부에서만)
   */
  async handleProcessReorder(data) {
    console.log('🔄 미니창 내부 순서 변경:', data);

    // 미니창에서만 순서 변경, 메인창으로는 요청 보내지 않음
    // TreeView에서 이미 UI 업데이트가 완료됨

    console.log('✅ 미니창 프로세스 순서 변경 완료');
  }



  /**
   * 투명도 설정
   */
  async setOpacity(opacity) {
    this.currentOpacity = opacity;
    if (window.electronAPI && window.electronAPI.setMiniOpacity) {
      try {
        const result = await window.electronAPI.setMiniOpacity(opacity);
        if (result.success) {
          console.log('투명도 변경 성공:', opacity);
        } else {
          console.error('투명도 변경 실패:', result.error);
        }
      } catch (error) {
        console.error('투명도 설정 오류:', error);
      }
    } else {
      console.warn('setMiniOpacity API를 사용할 수 없습니다.');
    }
  }

  /**
   * 투명도 패널 토글
   */
  toggleOpacityPanel() {
    const panel = document.getElementById('opacity-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      // 도움말 패널이 열려있으면 닫기
      const helpPanel = document.getElementById('help-panel');
      if (helpPanel && helpPanel.style.display !== 'none') {
        helpPanel.style.display = 'none';
      }
    }
  }

  /**
   * 도움말 패널 토글
   */
  toggleHelpPanel() {
    const panel = document.getElementById('help-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      // 투명도 패널이 열려있으면 닫기
      const opacityPanel = document.getElementById('opacity-panel');
      if (opacityPanel && opacityPanel.style.display !== 'none') {
        opacityPanel.style.display = 'none';
      }
    }
  }

  /**
   * 미니창 접기/펼치기 토글
   */
  async toggleCollapse() {
    try {
      // 메인 프로세스에서 실제 윈도우 크기 변경
      if (window.electronAPI && window.electronAPI.toggleMiniCollapse) {
        const result = await window.electronAPI.toggleMiniCollapse();

        if (result.success) {
          // 메인 프로세스에서 반환된 상태로 UI 업데이트
          this.isCollapsed = result.data.isCollapsed;

          const toggleBtn = document.getElementById('mini-toggle-btn');
          const toggleIcon = toggleBtn?.querySelector('span');

          if (this.isCollapsed) {
            // 접기 상태 UI
            toggleBtn?.classList.add('collapsed');
            if (toggleIcon) toggleIcon.textContent = '🔽';

            // 패널들 닫기
            const opacityPanel = document.getElementById('opacity-panel');
            const helpPanel = document.getElementById('help-panel');
            if (opacityPanel) opacityPanel.style.display = 'none';
            if (helpPanel) helpPanel.style.display = 'none';

          } else {
            // 펼치기 상태 UI
            toggleBtn?.classList.remove('collapsed');
            if (toggleIcon) toggleIcon.textContent = '🔼';
          }

          // 상태 저장
          this.saveCollapseState();
        } else {
          console.error('미니창 접기/펼치기 실패:', result.error);
        }
      } else {
        console.warn('toggleMiniCollapse API를 사용할 수 없습니다.');
      }
    } catch (error) {
      console.error('미니창 접기/펼치기 오류:', error);
    }
  }

  /**
   * 키보드 단축키 처리
   */
  handleKeyboardShortcuts(event) {
    // 입력 필드에 포커스가 있는 경우 단축키 비활성화
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );

    // 입력 필드 포커스 시에는 ESC와 Enter만 처리
    if (isInputFocused) {
      if (event.key === 'Escape') {
        // ESC 키로 입력 필드에서 포커스 해제
        activeElement.blur();
        return;
      }
      // 다른 키들은 입력 필드에서 정상 처리되도록 함
      return;
    }

    // Ctrl+Q: 미니창 접기/펼치기 (선택사항 - 더블클릭이 기본)
    if (event.ctrlKey && event.key === 'q') {
      event.preventDefault();
      this.toggleCollapse();
      return;
    }

    // Escape: 컨텍스트 메뉴 닫기, 패널들 닫기
    if (event.key === 'Escape') {
      this.hideContextMenu();

      const opacityPanel = document.getElementById('opacity-panel');
      const helpPanel = document.getElementById('help-panel');

      if (opacityPanel && opacityPanel.style.display !== 'none') {
        this.toggleOpacityPanel();
        return;
      }

      if (helpPanel && helpPanel.style.display !== 'none') {
        this.toggleHelpPanel();
        return;
      }

      return;
    }

    // Ctrl+W: 창 닫기
    if (event.ctrlKey && event.key === 'w') {
      event.preventDefault();
      this.closeWindow();
      return;
    }

    // F5 또는 Ctrl+R: 새로고침
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
      event.preventDefault();
      this.refreshProcesses();
      return;
    }

    // Ctrl+A: 모든 그룹 펼치기
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      this.treeView?.expandAll();
      return;
    }

    // Ctrl+Shift+A: 모든 그룹 접기
    if (event.ctrlKey && event.shiftKey && event.key === 'A') {
      event.preventDefault();
      this.treeView?.collapseAll();
      return;
    }

    // 숫자키 1-9: 첫 번째부터 9번째 프로세스로 빠른 포커스
    if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const index = parseInt(event.key) - 1;
      this.focusProcessByIndex(index);
      return;
    }

    // Space: 선택된 프로세스 포커스
    if (event.key === ' ' && this.selectedProcessId) {
      event.preventDefault();
      this.handleProcessFocus(this.selectedProcessId);
      return;
    }

    // Enter: 선택된 프로세스 포커스
    if (event.key === 'Enter' && this.selectedProcessId) {
      event.preventDefault();
      this.handleProcessFocus(this.selectedProcessId);
      return;
    }

    // Ctrl+C: 선택된 프로세스 정보 복사
    if (event.ctrlKey && event.key === 'c' && this.selectedProcessId) {
      event.preventDefault();
      this.handleProcessCopy(this.selectedProcessId);
      return;
    }

    // ArrowUp: 선택된 프로세스 위로 이동
    if (event.key === 'ArrowUp' && this.selectedProcessId && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      this.treeView?.handleProcessMoveUp(this.selectedProcessId);
      return;
    }

    // ArrowDown: 선택된 프로세스 아래로 이동
    if (event.key === 'ArrowDown' && this.selectedProcessId && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      this.treeView?.handleProcessMoveDown(this.selectedProcessId);
      return;
    }
  }

  /**
   * 인덱스로 프로세스 포커스
   */
  focusProcessByIndex(index) {
    if (!this.treeView) return;

    let processIndex = 0;
    for (const group of this.treeView.groups) {
      for (const process of group.processes) {
        if (processIndex === index) {
          this.treeView.selectProcess(process.id);
          this.handleProcessFocus(process.id);
          return;
        }
        processIndex++;
      }
    }
  }

  /**
   * 창 닫기
   */
  closeWindow() {
    if (window.electronAPI && window.electronAPI.closeMiniWindow) {
      window.electronAPI.closeMiniWindow();
    } else {
      window.close();
    }
  }

  /**
   * 컨텍스트 메뉴 표시
   */
  showContextMenu(x, y) {
    const contextMenu = document.getElementById('mini-context-menu');
    if (contextMenu) {
      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
      contextMenu.style.display = 'block';
    }
  }

  /**
   * 컨텍스트 메뉴 숨김
   */
  hideContextMenu() {
    const contextMenu = document.getElementById('mini-context-menu');
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  }

  /**
   * 로딩 상태 표시
   */
  showLoading(show) {
    const loading = document.getElementById('mini-loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * 빈 상태 표시
   */
  showEmptyState(show) {
    const empty = document.getElementById('mini-empty');
    if (empty) {
      empty.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * 상태바 업데이트
   */
  updateStatusBar(processes) {
    const statusText = document.getElementById('mini-status-text');
    const lastUpdate = document.getElementById('mini-last-update');

    if (statusText) {
      const connectedCount = processes.filter(p => p.status === 'connected').length;
      statusText.textContent = `연결된 원격지: ${connectedCount}개`;
    }

    if (lastUpdate) {
      lastUpdate.textContent = new Date().toLocaleTimeString();
    }
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // TODO: 토스트 알림 구현
  }

  /**
   * 에러 표시
   */
  showError(message) {
    console.error('ERROR:', message);
    this.showNotification(message, 'error');
  }

  /**
   * ID로 프로세스 찾기
   */
  async getProcessById(processId) {
    return this.treeView?.getProcessById(processId) || null;
  }

  /**
   * 접기/펼치기 상태를 localStorage에 저장
   */
  saveCollapseState() {
    try {
      localStorage.setItem('mini-window-collapsed', JSON.stringify(this.isCollapsed));
    } catch (error) {
      console.error('접기/펼치기 상태 저장 실패:', error);
    }
  }

  /**
   * localStorage에서 접기/펼치기 상태 복원
   */
  loadCollapseState() {
    try {
      const savedState = localStorage.getItem('mini-window-collapsed');
      if (savedState !== null) {
        this.isCollapsed = JSON.parse(savedState);
      } else {
        // 처음 실행 시 기본값: 펼쳐진 상태 (false)
        this.isCollapsed = false;
      }
    } catch (error) {
      console.error('접기/펼치기 상태 복원 실패:', error);
      this.isCollapsed = false; // 오류 시에도 펼쳐진 상태로
    }
  }

  /**
   * 초기화 시 접기/펼치기 상태 적용
   */
  async applyCollapseState() {
    // 저장된 상태가 접힌 상태인 경우에만 접기 실행
    if (this.isCollapsed) {
      console.log('저장된 상태: 접힌 상태 - 접기 실행');
      // DOM이 완전히 로드된 후 실행하기 위해 약간 지연
      setTimeout(async () => {
        try {
          // 저장된 상태가 접힌 상태라면 실제로 접기 실행
          await this.toggleCollapse();
        } catch (error) {
          console.error('초기 접기/펼치기 상태 적용 실패:', error);

          // 실패 시 UI만 업데이트
          const toggleBtn = document.getElementById('mini-toggle-btn');
          const toggleIcon = toggleBtn?.querySelector('span');
          toggleBtn?.classList.add('collapsed');
          if (toggleIcon) toggleIcon.textContent = '🔽';
        }
      }, 500);
    } else {
      console.log('저장된 상태: 펼쳐진 상태 또는 기본값 - 그대로 유지');
    }
  }

  destroy() {
    // 기존 정리 코드...

    if (this.conflictNotification) {
      this.conflictNotification.destroy();
      this.conflictNotification = null;
    }
  }

}

/**
 * 애플리케이션 시작
 */
document.addEventListener('DOMContentLoaded', async () => {
  const app = new MiniApp();

  // 전역에서 접근 가능하도록 설정 (디버깅용)
  window.miniApp = app;

  await app.initialize();
});

// 에러 처리
window.addEventListener('error', (event) => {
  console.error('전역 에러:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('처리되지 않은 Promise 거부:', event.reason);
});