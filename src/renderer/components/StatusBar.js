/**
 * StatusBar - 상태표시줄 컴포넌트
 * 프로세스 통계 및 시스템 상태 정보 표시
 */

export class StatusBar {
  constructor(processStore) {
    this.processStore = processStore;
    this.statistics = {
      total: 0,
      connected: 0,
      disconnected: 0
    };
    this.initialize();
  }

  /**
   * 상태바 초기화
   */
  initialize() {
    this.findElements();
    this.render();
  }

  /**
   * DOM 요소 찾기
   */
  findElements() {
    this.connectedCountElement = document.getElementById('connected-count');
    this.totalCountElement = document.getElementById('total-count');
  }

  /**
   * 프로세스 통계 업데이트
   * @param {Array} processes - 프로세스 배열
   */
  update(processes) {
    if (!processes || !Array.isArray(processes)) {
      processes = [];
    }
    
    this.statistics = this.calculateStatistics(processes);
    this.render();
  }

  /**
   * 통계 계산
   * @param {Array} processes - 프로세스 배열
   * @returns {Object} 통계 객체
   */
  calculateStatistics(processes) {
    return {
      total: processes.length,
      connected: processes.filter(p => p.status === 'connected').length,
      disconnected: processes.filter(p => p.status === 'disconnected').length,
      reconnected: processes.filter(p => p.status === 'reconnected').length,
      ezhelp: processes.filter(p => p.type === 'ezhelp').length,
      teamviewer: processes.filter(p => p.type === 'teamviewer').length,
      grouped: processes.filter(p => p.groupId).length,
      ungrouped: processes.filter(p => !p.groupId).length,
      withCategories: processes.filter(p => p.category).length,
      withLabels: processes.filter(p => p.customLabel).length,
    };
  }

  /**
   * 상태바 렌더링
   */
  render() {
    if (this.connectedCountElement) {
      this.connectedCountElement.textContent = this.statistics.connected || 0;
    }

    if (this.totalCountElement) {
      this.totalCountElement.textContent = this.statistics.total || 0;
    }
  }

  /**
   * 상세 통계 정보 가져오기
   * @returns {Object} 상세 통계
   */
  getDetailedStatistics() {
    return { ...this.statistics };
  }
}