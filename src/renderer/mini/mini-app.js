/**
 * MiniApp - 미니창 애플리케이션 엔트리포인트
 * 트리 구조 기반 원격 프로세스 관리
 */

import { MiniTreeView } from './MiniTreeView.js';

/**
 * 미니창 애플리케이션 클래스
 */
class MiniApp {
  constructor() {
    this.treeView = null;
    this.isInitialized = false;
    this.currentOpacity = 0.9;
    this.selectedProcessId = null;
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    try {
      console.log('🚀 MiniApp 초기화 시작');

      // 1. UI 컴포넌트 초기화
      await this.initializeComponents();

      // 2. 이벤트 리스너 설정
      this.setupEventListeners();

      // 3. 초기 데이터 로드
      await this.loadInitialData();

      // 4. 메인 프로세스와 통신 설정
      this.setupMainProcessCommunication();

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
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 타이틀바 버튼들
    const closeBtn = document.getElementById('mini-close-btn');
    const opacityBtn = document.getElementById('mini-opacity-btn');
    const helpBtn = document.getElementById('mini-help-btn');

    closeBtn?.addEventListener('click', () => {
      this.closeWindow();
    });

    opacityBtn?.addEventListener('click', () => {
      this.toggleOpacityPanel();
    });

    helpBtn?.addEventListener('click', () => {
      this.toggleHelpPanel();
    });

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

    // 윈도우 포커스/블러 시 투명도 조절
    window.addEventListener('focus', () => {
      if (this.currentOpacity < 0.9) {
        this.setOpacity(Math.min(1.0, this.currentOpacity + 0.2));
      }
    });

    window.addEventListener('blur', () => {
      if (this.currentOpacity > 0.7) {
        this.setOpacity(Math.max(0.5, this.currentOpacity - 0.2));
      }
    });
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

    // 빈 상태 처리
    const isEmpty = processes.length === 0;
    this.showEmptyState(isEmpty);
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
      ip: process.ip,
      counselorId: process.counselorId,
      pid: process.pid,
      windowHandle: process.windowHandle,
      title: process.title,
      multipleId: process.multipleId,
      category: process.category || 'uncategorized',
      groupId: process.groupId,
      groupName: process.groupName
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

      const result = await window.electronAPI.requestProcessDelete(processId);
      console.log(result, "result")
      if (result.success) {
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
   * 투명도 설정
   */
  setOpacity(opacity) {
    this.currentOpacity = opacity;
    if (window.electronAPI && window.electronAPI.setWindowOpacity) {
      window.electronAPI.setWindowOpacity(opacity);
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
   * 키보드 단축키 처리
   */
  handleKeyboardShortcuts(event) {
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