/**
 * Preload Script - 보안을 위한 IPC 브리지
 * 메인 프로세스와 렌더러 프로세스 간의 안전한 통신
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 안전한 IPC API를 윈도우 객체에 노출
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 프로세스 감지 요청
   * @returns {Promise<Object>} 프로세스 감지 결과
   */
  detectProcesses: () => ipcRenderer.invoke('detect-processes'),



  /**
   * 윈도우 포커스 요청
   * @param {Object} focusData - 포커스 데이터 (id, useHandle, processName, windowTitle)
   * @returns {Promise<Object>} 포커스 결과
   */
  focusWindow: (focusData) => ipcRenderer.invoke('focus-window', focusData),

  requestProcessDelete: (processId) => ipcRenderer.invoke('request-process-delete', processId),

  onDeleteRequest: (callback) => {
    ipcRenderer.on('request-delete-process', (event, processId) => callback(processId));
  },

  /**
   * ezHelp 컨트롤바 표시 요청
   * @param {number} processId - ezHelp 프로세스 ID
   * @returns {Promise<Object>} 컨트롤바 표시 결과
   */
  showEzHelpControlBar: (processId) => ipcRenderer.invoke('show-ezhelp-control-bar', processId),

  /**
   * 애플리케이션 정보 가져오기
   * @returns {Promise<Object>} 앱 정보
   */
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  /**
   * 미니창 토글
   * @returns {Promise<Object>} 미니창 상태
   */
  toggleMiniWindow: () => ipcRenderer.invoke('toggle-mini-window'),

  /**
   * 미니창 표시
   * @returns {Promise<Object>} 미니창 상태
   */
  showMiniWindow: () => ipcRenderer.invoke('show-mini-window'),

  /**
   * 미니창 숨김
   * @returns {Promise<Object>} 미니창 상태
   */
  hideMiniWindow: () => ipcRenderer.invoke('hide-mini-window'),

  /**
   * 미니창 닫기
   * @returns {Promise<Object>} 미니창 상태
   */
  closeMiniWindow: () => ipcRenderer.invoke('close-mini-window'),

  /**
   * 미니창 투명도 설정
   * @param {number} opacity - 투명도 (0.1 ~ 1.0)
   * @returns {Promise<Object>} 미니창 상태
   */
  setMiniOpacity: (opacity) => ipcRenderer.invoke('set-mini-opacity', opacity),

  /**
   * 미니창 상태 조회
   * @returns {Promise<Object>} 미니창 상태
   */
  getMiniStatus: () => ipcRenderer.invoke('get-mini-status'),

  /**
   * 미니창 접기/펼치기 토글
   * @returns {Promise<Object>} 미니창 상태
   */
  toggleMiniCollapse: () => ipcRenderer.invoke('toggle-mini-collapse'),

  /**
   * 미니창에 데이터 전송
   * @param {Object} data - 전송할 데이터
   * @returns {Promise<Object>} 전송 결과
   */
  sendDataToMini: (data) => ipcRenderer.invoke('send-data-to-mini', data),

  /**
   * 메인창 데이터 요청 (미니창에서 사용)
   * @returns {Promise<Object>} 메인창 데이터
   */
  requestMainData: () => ipcRenderer.invoke('request-main-data'),

  /**
   * 메인창 데이터 업데이트 수신 (미니창에서 사용)
   * @param {Function} callback - 데이터 수신 콜백
   */
  onMainDataUpdate: (callback) => {
    ipcRenderer.on('main-data-update', (event, data) => callback(data));
  },

  /**
   * 메인창 데이터 요청 수신 (메인창에서 사용)
   * @param {Function} callback - 데이터 요청 콜백
   */
  onDataRequest: (callback) => {
    ipcRenderer.on('request-current-data', () => callback());
  },

  /**
   * 메인창 데이터 응답 전송 (메인창에서 사용)
   * @param {Object} data - 응답할 데이터
   */
  sendMainDataResponse: (data) => {
    ipcRenderer.send('main-data-response', data);
  },

  /**
   * 메인창 새로고침 요청 (미니창에서 사용)
   * @param {Object} actionData - 선택적 액션 데이터
   * @returns {Promise<Object>} 새로고침 요청 결과
   */
  requestMainRefresh: (actionData) => ipcRenderer.invoke('request-main-refresh', actionData),

  /**
   * 미니창 새로고침 요청 수신 (메인창에서 사용)
   * @param {Function} callback - 새로고침 요청 콜백
   */
  onRefreshRequest: (callback) => {
    ipcRenderer.on('request-refresh-from-mini', () => callback());
  },

  /**
   * 미니창 윈도우 투명도 설정 (미니창에서 사용) - 수정됨
   * @param {number} opacity - 투명도 (0.1 ~ 1.0)
   * @returns {Promise<Object>} 투명도 설정 결과
   */
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-mini-opacity', opacity),

  /**
   * 미니창에 충돌 알림 전송 (메인창에서 사용)
   * @param {Object} conflictInfo - 충돌 정보
   * @returns {Promise<Object>} 알림 전송 결과
   */
  notifyMiniWindowConflict: (conflictInfo) => ipcRenderer.invoke('notify-mini-window-conflict', conflictInfo),

  /**
   * 충돌 감지 알림 수신 (미니창에서 사용)
   * @param {Function} callback - 충돌 알림 수신 콜백
   */
  onConflictDetected: (callback) => {
    ipcRenderer.on('conflict-detected', (event, conflictInfo) => callback(conflictInfo));
  },

  /**
   * 메인창으로 전환 요청 (미니창에서 사용)
   * @returns {Promise<Object>} 메인창 전환 결과
   */
  switchToMainWindow: () => ipcRenderer.invoke('switch-to-main-window'),

  /**
   * 그룹 액션 요청 수신 (메인창에서 사용)
   * @param {Function} callback - 그룹 액션 요청 콜백
   */
  onGroupActionRequest: (callback) => {
    ipcRenderer.on('request-group-action-from-mini', (event, actionData) => callback(actionData));
  },

  /**
   * 그룹 액션 응답 전송 (메인창에서 사용)
   * @param {Object} result - 그룹 액션 결과
   */
  sendGroupActionResponse: (result) => {
    ipcRenderer.send('group-action-response', result);
  },

  /**
   * 프로세스 액션 요청 수신 (메인창에서 사용)
   * @param {Function} callback - 프로세스 액션 요청 콜백
   */
  onProcessActionRequest: (callback) => {
    ipcRenderer.on('request-process-action-from-mini', (event, actionData) => callback(actionData));
  },

  /**
   * 프로세스 액션 응답 전송 (메인창에서 사용)
   * @param {Object} result - 프로세스 액션 결과
   */
  sendProcessActionResponse: (result) => {
    ipcRenderer.send('process-action-response', result);
  },

  /**
   * 버전 정보
   */
  version: '2.1.0',

  /**
   * 플랫폼 정보
   */
  platform: process.platform,
});