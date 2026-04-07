/**
 * WindowManager - Windows 창 관리 모듈
 * 원격 프로세스 창의 포커스, 최소화 복원 등 관리
 */

import koffi from 'koffi';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// 1. Koffi를 이용한 Win32 API 및 타입 정의
// ============================================================================
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

// 기본 타입 정의
const HWND = 'void*';
const DWORD = 'uint32';

// User32 함수 정의
const SetForegroundWindow = user32.func(
  '__stdcall',
  'SetForegroundWindow',
  'bool',
  [HWND]
);
const ShowWindow = user32.func('__stdcall', 'ShowWindow', 'bool', [
  HWND,
  'int',
]);
const BringWindowToTop = user32.func('__stdcall', 'BringWindowToTop', 'bool', [
  HWND,
]);
const IsIconic = user32.func('__stdcall', 'IsIconic', 'bool', [HWND]);
const IsWindowVisible = user32.func('__stdcall', 'IsWindowVisible', 'bool', [
  HWND,
]);
const GetForegroundWindow = user32.func(
  '__stdcall',
  'GetForegroundWindow',
  HWND,
  []
);
const GetWindowThreadProcessId = user32.func(
  '__stdcall',
  'GetWindowThreadProcessId',
  DWORD,
  [HWND, 'uint32*']
);
const AttachThreadInput = user32.func(
  '__stdcall',
  'AttachThreadInput',
  'bool',
  [DWORD, DWORD, 'bool']
);
const GetClassNameW = user32.func('__stdcall', 'GetClassNameW', 'int', [
  HWND,
  'void*',
  'int',
]);
const GetWindowLongW = user32.func('__stdcall', 'GetWindowLongW', 'int32', [
  HWND,
  'int',
]);
const SetWindowLongW = user32.func('__stdcall', 'SetWindowLongW', 'int32', [
  HWND,
  'int',
  'int32',
]);

// Kernel32 함수 정의
const GetCurrentThreadId = kernel32.func(
  '__stdcall',
  'GetCurrentThreadId',
  DWORD,
  []
);

// EnumWindows 콜백 프로토타입 정의
const EnumWindowsProc = koffi.proto(
  'bool __stdcall EnumWindowsProc(void* hwnd, void* lParam)'
);
const EnumWindows = user32.func('__stdcall', 'EnumWindows', 'bool', [
  koffi.pointer(EnumWindowsProc),
  'void*',
]);

// Win32 상수
const SW_RESTORE = 9;
const GWL_STYLE = -16;
const WS_VISIBLE = 0x10000000;

// 유틸리티 함수: 비동기 지연
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// 2. 핵심 로직 헬퍼 함수들
// ============================================================================

/**
 * 특정 PID를 가진 프로세스의 메인 창(가장 유력한 창) 핸들을 찾습니다.
 */
function getMainWindowHandle(targetPid) {
  let firstHwnd = null;
  let visibleHwnd = null;

  const callback = koffi.register((hwnd, lParam) => {
    const pidArray = new Uint32Array(1);
    GetWindowThreadProcessId(hwnd, pidArray);

    if (pidArray[0] === targetPid) {
      if (!firstHwnd) firstHwnd = hwnd;
      if (IsWindowVisible(hwnd)) {
        visibleHwnd = hwnd;
        return false; // 가장 유력한 가시적 창을 찾았으므로 탐색 중지
      }
    }
    return true; // 계속 탐색
  }, koffi.pointer(EnumWindowsProc));

  EnumWindows(callback, null);
  koffi.unregister(callback); // 메모리 누수 방지

  return visibleHwnd || firstHwnd;
}

/**
 * ezHelp 컨트롤바(HiRemoteMenuBar)를 찾아 강제로 표시합니다.
 */
function showEzHelpControlBar(processId) {
  let controlBarCount = 0;
  console.log(`[디버그] ShowEzHelpControlBar 시작 - PID: ${processId}`);

  const callback = koffi.register((hwnd, lParam) => {
    const pidArray = new Uint32Array(1);
    GetWindowThreadProcessId(hwnd, pidArray);

    if (pidArray[0] === processId) {
      // char16_t 배열을 담을 수 있는 512바이트 버퍼 (256자)
      const classNameBuf = Buffer.alloc(512);
      GetClassNameW(hwnd, classNameBuf, 256);

      // 버퍼를 utf16le 문자열로 디코딩하고 널(Null) 문자 제거
      const classNameStr = classNameBuf.toString('utf16le').replace(/\0+$/, '');

      if (classNameStr === 'HiRemoteMenuBar') {
        controlBarCount++;
        console.log(`[디버그] HiRemoteMenuBar 발견 #${controlBarCount}`);

        const currentStyle = GetWindowLongW(hwnd, GWL_STYLE);
        if ((currentStyle & WS_VISIBLE) === 0) {
          SetWindowLongW(hwnd, GWL_STYLE, currentStyle | WS_VISIBLE);
          console.log('[성공] ezHelp 컨트롤바 WS_VISIBLE 활성화');
        } else {
          console.log('[정보] 컨트롤바는 이미 WS_VISIBLE 상태입니다.');
        }
        return false; // 찾았으므로 즉시 탐색 종료
      }
    }
    return true; // 계속 탐색
  }, koffi.pointer(EnumWindowsProc));

  EnumWindows(callback, null);
  koffi.unregister(callback);
}

/**
 * HWND(핸들)를 기반으로 창을 포커스하는 공통 로직
 */
async function focusHwnd(hwnd, processId, isEzHelp) {
  if (!hwnd) return false;

  const wasMinimized = IsIconic(hwnd);
  console.log(`[디버그] 창 최소화 여부: ${wasMinimized}`);

  const foregroundHwnd = GetForegroundWindow();

  // 타겟 스레드 ID 가져오기
  const targetThreadIdArray = new Uint32Array(1);
  GetWindowThreadProcessId(hwnd, targetThreadIdArray);

  // 현재 스레드 및 포그라운드 스레드 ID 가져오기
  const currentThreadId = GetCurrentThreadId();
  let foregroundThreadId = 0;

  if (foregroundHwnd) {
    const fgThreadIdArray = new Uint32Array(1);
    GetWindowThreadProcessId(foregroundHwnd, fgThreadIdArray);
    foregroundThreadId = fgThreadIdArray[0];
  }

  // 스레드 연결 (포커스 권한 획득)
  let attached = false;
  if (foregroundThreadId !== 0 && foregroundThreadId !== currentThreadId) {
    attached = AttachThreadInput(currentThreadId, foregroundThreadId, true);
    console.log(`[디버그] AttachThreadInput 결과: ${attached}`);
  }

  try {
    if (wasMinimized) {
      ShowWindow(hwnd, SW_RESTORE);
    }

    BringWindowToTop(hwnd);

    let focusResult = SetForegroundWindow(hwnd);
    console.log(`[디버그] SetForegroundWindow 결과: ${focusResult}`);

    if (!focusResult) {
      // 실패 시 C#의 Sleep(50)과 동일하게 약간 대기 후 재시도
      await sleep(50);
      focusResult = SetForegroundWindow(hwnd);
      console.log(`[디버그] SetForegroundWindow 재시도 결과: ${focusResult}`);
    }

    // ezHelp 컨트롤바 특수 처리
    if (isEzHelp && processId) {
      console.log('[디버그] ezHelp 컨트롤바 표시 조건 충족');
      showEzHelpControlBar(processId);
    }

    return true;
  } finally {
    // 연결했던 스레드 정리
    if (attached) {
      AttachThreadInput(currentThreadId, foregroundThreadId, false);
    }
  }
}

// ============================================================================
// 3. WindowManager 클래스 노출
// ============================================================================

class WindowManager {
  static async focusWindow(
    processId,
    processType = '',
    ipAddress = '',
    externalIpAddress = ''
  ) {
    try {
      console.log('포커스 실행 (koffi):', {
        processId,
        processType,
        ipAddress,
        externalIpAddress,
      });
      const isEzHelp = processType?.toLowerCase() === 'ezhelp';

      const hwnd = getMainWindowHandle(processId);
      if (!hwnd) {
        console.warn('[경고] 대상 프로세스의 핸들을 찾을 수 없습니다.');
        // 메인 창을 못 찾았더라도, ezHelp라면 컨트롤바 탐색은 시도합니다.
        if (isEzHelp) showEzHelpControlBar(processId);
        return false;
      }

      return await focusHwnd(hwnd, processId, isEzHelp);
    } catch (error) {
      console.error('Focus window error:', error);
      return false;
    }
  }

  static async focusWindowByHandle(
    windowHandle,
    processType = '',
    ipAddress = '',
    externalIpAddress = ''
  ) {
    try {
      console.log('핸들 포커스 실행 (koffi):', {
        windowHandle,
        processType,
        ipAddress,
        externalIpAddress,
      });
      const isEzHelp = processType?.toLowerCase() === 'ezhelp';

      // 자바스크립트에서 핸들을 안전하게 BigInt 또는 Number로 변환하여 포인터로 사용
      let hwnd;
      try {
        hwnd = BigInt(windowHandle);
      } catch {
        console.error('[오류] 올바르지 않은 Window Handle 포맷입니다.');
        return false;
      }

      if (!hwnd) return false;

      // ezHelp 컨트롤바 처리를 위해 해당 핸들의 프로세스 ID 역추적
      const pidArray = new Uint32Array(1);
      GetWindowThreadProcessId(hwnd, pidArray);
      const processId = pidArray[0];

      return await focusHwnd(hwnd, processId, isEzHelp);
    } catch (error) {
      console.error('Focus window by handle error:', error);
      return false;
    }
  }

  static async terminateProcess(processId) {
    try {
      // PowerShell 생성 없이, Windows 기본 명령어인 taskkill을 즉시 실행하여 속도 극대화
      await execAsync(`taskkill /F /PID ${processId}`, { windowsHide: true });
      return true;
    } catch (error) {
      console.error('프로세스 종료 실패:', error);
      return false;
    }
  }

  static async getWindowState(processId) {
    try {
      const hwnd = getMainWindowHandle(processId);
      if (!hwnd) return { exists: false };

      return {
        exists: true,
        isMinimized: IsIconic(hwnd),
        isVisible: IsWindowVisible(hwnd),
        handle: hwnd.toString(),
      };
    } catch (error) {
      console.error('창 상태 확인 실패:', error);
      return { exists: false, error: error.message };
    }
  }
}

export default WindowManager;
