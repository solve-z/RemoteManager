/**
 * RemoteManager - Electron 메인 프로세스
 * Windows 전용 원격지원 관리 도구의 메인 엔트리포인트
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ProcessDetector from './process-detector.js';
import WindowManager from './window-manager.js';
import { miniWindowManager } from './mini-window.js';

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
    title: 'RemoteManager v2.0',
  });

  // 렌더러 프로세스 로드
  const rendererPath = join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (isDev) {
      console.log('🚀 RemoteManager 개발 모드로 시작됨');
    }
  });

  // F12 키로 개발자도구 토글
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Electron 기본 메뉴와 단축키 비활성화 (Ctrl+M, Ctrl+W 등)
  Menu.setApplicationMenu(null);

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
      console.log('📨 IPC 포커스 요청 받음:', focusData);

      let result;

      if (focusData.useHandle && focusData.id) {
        console.log('🔧 WindowHandle 기반 포커스 시도');
        // WindowHandle로 포커스 (IP 정보 전달)
        result = await WindowManager.focusWindowByHandle(
          focusData.id,
          focusData.processType,
          focusData.ipAddress,
          focusData.externalIpAddress
        );
      } else {
        console.log('🔧 PID 기반 포커스 시도');
        // PID로 포커스 (IP 정보 전달)
        result = await WindowManager.focusWindow(
          focusData.id,
          focusData.processType,
          focusData.ipAddress,
          focusData.externalIpAddress
        );
      }

      console.log('✅ 포커스 결과:', result);
      // result가 boolean이므로 직접 success에 할당
      return { success: result === true, data: result };
    } catch (error) {
      console.error('❌ 윈도우 포커스 오류:', error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle('request-process-delete', (event, processId) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-delete-process', processId);
        return { success: true };
      }
      return { success: false, error: '메인창을 찾을 수 없습니다.' };
    } catch (error) {
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

  // 미니창 관리 IPC 핸들러들
  ipcMain.handle('toggle-mini-window', () => {
    try {
      miniWindowManager.toggleMiniWindow();
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 토글 오류:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-mini-window', () => {
    try {
      miniWindowManager.showMiniWindow();
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 표시 오류:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hide-mini-window', () => {
    try {
      miniWindowManager.hideMiniWindow();
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 숨김 오류:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('close-mini-window', () => {
    try {
      miniWindowManager.closeMiniWindow();
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 닫기 오류:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-mini-opacity', (event, opacity) => {
    try {
      miniWindowManager.setOpacity(opacity);
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 투명도 설정 오류:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-mini-status', () => {
    try {
      return { success: true, data: miniWindowManager.getStatus() };
    } catch (error) {
      console.error('미니창 상태 조회 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창 접기/펼치기 토글
  ipcMain.handle('toggle-mini-collapse', () => {
    try {
      miniWindowManager.toggleCollapse();
      return { 
        success: true, 
        data: {
          ...miniWindowManager.getStatus(),
          ...miniWindowManager.getCollapseStatus()
        }
      };
    } catch (error) {
      console.error('미니창 접기/펼치기 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창에 데이터 전송
  ipcMain.handle('send-data-to-mini', (event, data) => {
    try {
      const miniWindow = miniWindowManager.miniWindow;
      if (miniWindow && !miniWindow.isDestroyed()) {
        miniWindow.webContents.send('main-data-update', data);
        return { success: true };
      }
      return { success: false, error: '미니창이 열려있지 않습니다.' };
    } catch (error) {
      console.error('미니창 데이터 전송 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창에서 메인창으로 데이터 요청
  ipcMain.handle('request-main-data', () => {
    try {
      // 메인창에 데이터 요청
      if (mainWindow && !mainWindow.isDestroyed()) {
        return new Promise((resolve) => {
          mainWindow.webContents.send('request-current-data');

          // 응답 대기 (5초 타임아웃)
          const timeout = setTimeout(() => {
            resolve({ success: false, error: '데이터 요청 타임아웃' });
          }, 5000);

          // 한번만 응답 받기 - on + removeAllListeners 사용
          const responseHandler = (event, data) => {
            clearTimeout(timeout);
            ipcMain.removeListener('main-data-response', responseHandler);
            resolve({ success: true, data: data });
          };

          ipcMain.on('main-data-response', responseHandler);
        });
      }
      return { success: false, error: '메인창을 찾을 수 없습니다.' };
    } catch (error) {
      console.error('메인 데이터 요청 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창에서 메인창에 새로고침 요청 (액션 데이터 포함 가능)
  ipcMain.handle('request-main-refresh', (event, actionData = null) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (actionData && actionData.type === 'group-management') {
          // 그룹 관리 액션인 경우
          return new Promise((resolve) => {
            console.log('🎯 미니창에서 그룹 관리 액션 요청:', actionData);
            mainWindow.webContents.send('request-group-action-from-mini', actionData);

            // 응답 대기 (5초 타임아웃)
            const timeout = setTimeout(() => {
              resolve({ success: false, error: '그룹 액션 요청 타임아웃' });
            }, 5000);

            // 한번만 응답 받기
            const responseHandler = (event, result) => {
              clearTimeout(timeout);
              ipcMain.removeListener('group-action-response', responseHandler);
              resolve(result);
            };

            ipcMain.on('group-action-response', responseHandler);
          });
        } else if (actionData && actionData.type === 'process-management') {
          // 프로세스 관리 액션인 경우
          return new Promise((resolve) => {
            console.log('🎯 미니창에서 프로세스 관리 액션 요청:', actionData);
            mainWindow.webContents.send('request-process-action-from-mini', actionData);

            // 응답 대기 (5초 타임아웃)
            const timeout = setTimeout(() => {
              resolve({ success: false, error: '프로세스 액션 요청 타임아웃' });
            }, 5000);

            // 한번만 응답 받기
            const responseHandler = (event, result) => {
              clearTimeout(timeout);
              ipcMain.removeListener('process-action-response', responseHandler);
              resolve(result);
            };

            ipcMain.on('process-action-response', responseHandler);
          });
        } else {
          // 기존 새로고침 요청
          mainWindow.webContents.send('request-refresh-from-mini');
          return { success: true, message: '메인창에 새로고침 요청을 전송했습니다.' };
        }
      }
      return { success: false, error: '메인창을 찾을 수 없습니다.' };
    } catch (error) {
      console.error('메인창 새로고침 요청 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창에 충돌 알림 전송
  ipcMain.handle('notify-mini-window-conflict', (event, conflictInfo) => {
    try {
      const miniWindow = miniWindowManager.miniWindow;
      if (miniWindow && !miniWindow.isDestroyed()) {
        console.log('📱 미니창에 충돌 알림 전송:', conflictInfo.computerName);
        miniWindow.webContents.send('conflict-detected', conflictInfo);
        return { success: true };
      }
      return { success: false, error: '미니창이 열려있지 않습니다.' };
    } catch (error) {
      console.error('미니창 충돌 알림 전송 오류:', error);
      return { success: false, error: error.message };
    }
  });

  // 미니창에서 메인창으로 전환 요청
  ipcMain.handle('switch-to-main-window', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 메인창 포커스 및 최상위로 이동
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(true);
        
        // 잠시 후 always on top 해제
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 1000);
        
        console.log('🔄 메인창으로 전환 완료');
        return { success: true };
      }
      return { success: false, error: '메인창을 찾을 수 없습니다.' };
    } catch (error) {
      console.error('메인창 전환 오류:', error);
      return { success: false, error: error.message };
    }
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