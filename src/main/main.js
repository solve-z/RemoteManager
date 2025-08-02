/**
 * RemoteManager v4.0 - Electron 메인 프로세스
 * Windows 전용 원격지원 관리 도구의 메인 엔트리포인트
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ProcessDetector from './process-detector.js';
import WindowManager from './window-manager.js';

const __filename = fileURLToPath(import.meta.url); // 현재 모듈의 파일 경로를 file:/// 형식으로 반환 👉 'C:\Users\dltkd\Desktop\RemoteManager\src\main\main.js'
const __dirname = dirname(__filename);  // 위치한 디렉터리 경로를 반환 👉 'C:\Users\dltkd\Desktop\RemoteManager\src\main'

/**
 * 메인 윈도우 인스턴스
 * @type {BrowserWindow|null}
 */
let mainWindow = null;

/**
 * 개발 모드 여부
 * @type {boolean}
 */
const isDev = process.argv.includes('--dev');  // process는 Node.js에서 자동으로 제공되는 전역 객체

/**
 * Windows 플랫폼 확인
 */
if (process.platform !== 'win32') {
  console.error('❌ 이 애플리케이션은 Windows 전용입니다.');
  app.quit();
}

/**
 * 메인 윈도우 생성
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../renderer/preload.js'),
    },
    show: false, // 준비될 때까지 숨김
    title: 'RemoteManager v4.0',
  });

  // 렌더러 프로세스 로드
  const rendererPath = join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  // 개발 모드에서는 DevTools 자동 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      console.log('🚀 RemoteManager v4.0 개발 모드로 시작됨');
    }
  });

  // 윈도우가 닫히면 애플리케이션 종료
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

/**
 * IPC 핸들러 등록
 */
function registerIpcHandlers() {
  // 프로세스 감지 요청
  ipcMain.handle('detect-processes', async () => {
    try {
      const processes = await ProcessDetector.detectRemoteProcesses();
      return { success: true, data: processes };
    } catch (error) {
      console.error('프로세스 감지 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 윈도우 포커스 요청
  ipcMain.handle('focus-window', async (event, processId) => {
    try {
      const result = await WindowManager.focusWindow(processId);
      return { success: true, data: result };
    } catch (error) {
      console.error('윈도우 포커스 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 애플리케이션 버전 정보
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      isDev: isDev,
      platform: process.platform,
    };
  });
}

/**
 * 앱 준비 완료 이벤트
 */
app.whenReady().then(() => {
  createMainWindow();
  registerIpcHandlers();
});

/**
 * 모든 윈도우가 닫히면 앱 종료
 */
app.on('window-all-closed', () => {
  app.quit();
});

/**
 * 보안을 위한 새 윈도우 생성 방지
 */
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent) => {
    navigationEvent.preventDefault();
  });
});

/**
 * GPU 프로세스 충돌 시 복구
 */
app.on('gpu-process-crashed', (event, killed) => {
  console.error('GPU 프로세스 충돌 감지:', { killed });
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason, 'at Promise:', promise);
});