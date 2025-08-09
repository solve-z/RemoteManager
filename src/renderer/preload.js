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
   * 버전 정보
   */
  version: '4.0.0',
  
  /**
   * 플랫폼 정보
   */
  platform: process.platform,
});