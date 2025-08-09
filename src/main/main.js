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

/** process는 Node.js에서 자동으로 제공되는 전역 객체 , process.argv는 Node.js 애플리케이션 실행 시 명령줄에서 전달된 인자들을 배열로 담음 
 * 터미널에서 node app.js hello --dev 실행 👉 hello, --dev 가 사용자 인자로 포함
 * 결국 실행시 --dev를 넣는지 파악하는 용도
 * */ 
const isDev = process.argv.includes('--dev');  

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

    // webPreferences는 BrowserWindow라는 창 안에서 실행될 웹 콘텐츠의 보안과 기능을 제어하는 핵심 설정
    // "웹 페이지의 권한을 최소화하여 위험을 차단하고, 꼭 필요한 기능은 preload 스크립트와 contextBridge를 통해 안전하게 제공한다
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,

      // 화면(UI)과 메인 프로세스(이 파일) 사이의 안전한 다리 역할 , 
      // 보안상의 이유로 화면 쪽에서 직접적으로 시스템 기능을 호출할 수 없게 막혀있는데, 
      // preload 스크립트를 통해 허용된 기능만 사용할 수 있도록 통로를 열어주는 것이죠.
      preload: join(__dirname, '../renderer/preload.js'), 
    },
    show: false, // 준비될 때까지 숨김
    title: 'RemoteManager v1.1.2',
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
 * IPC 핸들러 등록 : IPC(Inter-Process Communication)는 프로세스 간 통신
 * preload.js가 다리 역할, 이 함수는 그 다리를 통해 어떤 요청들이 오고 갈 수 있는지 정의
 * 만약 화면(UI) 쪽에서 '요청이름'이라는 메시지를 보내면, 내가 이 함수를 실행해서 처리하고 결과를 돌려줄게" 라는 약속
 * 
 */

// 1. 화면(UI) 에서는 window.electronAPI.detectProcesses()를 호출합니다. ex ) const result = await window.electronAPI.detectProcesses();
// 2. 이 호출은 프리로드 스크립트에 있는 detectProcesses 함수를 실행시킵니다.
// 3. 프리로드 스크립트는 ipcRenderer.invoke('detect-processes')를 통해 메인 프로세스에 신호를 보냅니다.
// 4. 메인 프로세스의 ipcMain.handle('detect-processes', ...)가 신호를 받고, 프로세스 감지 작업을 수행한 뒤 결과를 반환합니다.
// 5. 결과는 다시 프리로드 스크립트를 거쳐 **화면(UI)**으로 전달됩니다.


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
  ipcMain.handle('focus-window', async (event, focusData) => {
    try {
      let result;
      
      if (focusData.useHandle && focusData.id) {
        // WindowHandle로 포커스 (processType 전달)
        result = await WindowManager.focusWindowByHandle(focusData.id, focusData.processType);
      } else {
        // PID로 포커스 (processType 전달)
        result = await WindowManager.focusWindow(focusData.id, focusData.processType);
      }
      
      return { success: result, data: result };
    } catch (error) {
      console.error('윈도우 포커스 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // ezHelp 컨트롤바 표시 요청
  ipcMain.handle('show-ezhelp-control-bar', async (event, processId) => {
    try {
      const result = await WindowManager.showEzHelpControlBar(processId);
      return { success: result, data: result };
    } catch (error) {
      console.error('ezHelp 컨트롤바 표시 오류:', error);
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
 * 일렉트론이 모든 초기화를 마치고 앱을 시작할 준비가 되었을 때 then 안의 코드를 실행
 */
app.whenReady().then(() => {
  createMainWindow();
  registerIpcHandlers();
});

/**
 * 앱의 모든 창이 닫혔을 때 발생하는 이벤트, 모든 윈도우가 닫히면 앱 종료
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