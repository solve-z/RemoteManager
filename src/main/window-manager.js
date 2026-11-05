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
const IsWindow = user32.func('__stdcall', 'IsWindow', 'bool', [HWND]);
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

const SwitchToThisWindow = user32.func('__stdcall', 'SwitchToThisWindow', 'void', [
  HWND,
  'bool',
]);

const keybd_event = user32.func('__stdcall', 'keybd_event', 'void', [
  'uint8',
  'uint8',
  'uint32',
  'size_t',
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
const VK_MENU = 0x12; // Alt 키
const KEYEVENTF_KEYUP = 0x0002;

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
    try {
      const pidArray = new Uint32Array(1);
      GetWindowThreadProcessId(hwnd, pidArray);

      if (pidArray[0] === processId) {
        // char16_t 배열을 담을 수 있는 512바이트 버퍼 (최대 256자)
        const classNameBuf = Buffer.alloc(512);

        // ★ 개선 포인트 1: GetClassNameW의 반환값(실제 문자열 길이)을 받아옵니다.
        const len = GetClassNameW(hwnd, classNameBuf, 256);

        if (len > 0) {
          // ★ 개선 포인트 2: 정규식으로 널(Null)을 지우는 대신, 실제 길이(len * 2 bytes)만큼만 딱 잘라서 읽습니다. 훨씬 안전합니다!
          const classNameStr = classNameBuf.toString('utf16le', 0, len * 2);

          if (classNameStr === 'HiRemoteMenuBar') {
            controlBarCount++;
            console.log(`[디버그] HiRemoteMenuBar 발견 #${controlBarCount}`);

            // 스타일 읽기
            const currentStyle = GetWindowLongW(hwnd, GWL_STYLE);

            // WS_VISIBLE 비트가 꺼져있는지 확인
            if ((currentStyle & WS_VISIBLE) === 0) {
              // 비트 연산(OR)으로 WS_VISIBLE 켜기
              SetWindowLongW(hwnd, GWL_STYLE, currentStyle | WS_VISIBLE);
              console.log('[성공] ezHelp 컨트롤바 WS_VISIBLE 강제 활성화');
            } else {
              console.log(
                '[정보] 컨트롤바는 이미 보여지는(WS_VISIBLE) 상태입니다.'
              );
            }

            // ★ 개선 포인트 3: 확실한 0(False) 반환으로 탐색 즉시 중단
            return false;
          }
        }
      }
    } catch (e) {
      console.error('[오류] ezHelp 컨트롤바 탐색 중 에러:', e);
    }

    // 계속 탐색 (True)
    return true;
  }, koffi.pointer(EnumWindowsProc));

  EnumWindows(callback, null);
  koffi.unregister(callback); // 메모리 누수 방지 완료
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
  const targetThreadId = targetThreadIdArray[0];

  // 현재 스레드 및 포그라운드 스레드 ID 가져오기
  const currentThreadId = GetCurrentThreadId();
  let foregroundThreadId = 0;

  if (foregroundHwnd) {
    const fgThreadIdArray = new Uint32Array(1);
    GetWindowThreadProcessId(foregroundHwnd, fgThreadIdArray);
    foregroundThreadId = fgThreadIdArray[0];
  }

  // Windows 포그라운드 락 우회: 가상 Alt 키 더미 입력
  try {
    keybd_event(VK_MENU, 0, 0, 0);
    keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
  } catch (e) {
    console.warn('[경고] keybd_event 호출 실패:', e);
  }

  // 스레드 연결 (포그라운드 및 타겟 스레드)
  let attachedFg = false;
  let attachedTarget = false;
  if (foregroundThreadId !== 0 && foregroundThreadId !== currentThreadId) {
    attachedFg = AttachThreadInput(currentThreadId, foregroundThreadId, true);
    console.log(`[디버그] AttachThreadInput(Foreground) 결과: ${attachedFg}`);
  }
  if (targetThreadId !== 0 && targetThreadId !== currentThreadId) {
    attachedTarget = AttachThreadInput(currentThreadId, targetThreadId, true);
    console.log(`[디버그] AttachThreadInput(Target) 결과: ${attachedTarget}`);
  }

  try {
    // 최소화되어 있는 경우 확실히 복원
    if (wasMinimized) {
      ShowWindow(hwnd, SW_RESTORE);
      await sleep(30);
    }

    BringWindowToTop(hwnd);

    let focusResult = SetForegroundWindow(hwnd);
    console.log(`[디버그] SetForegroundWindow 결과: ${focusResult}`);

    // SwitchToThisWindow로 백그라운드/최소화 창 강제 활성화 지원
    try {
      SwitchToThisWindow(hwnd, true);
    } catch (e) {
      // SwitchToThisWindow 예외는 무시
    }

    if (!focusResult) {
      // 실패 시 약간 대기 후 재시도
      await sleep(50);
      if (wasMinimized) {
        ShowWindow(hwnd, SW_RESTORE);
      }
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
    if (attachedFg) {
      AttachThreadInput(currentThreadId, foregroundThreadId, false);
    }
    if (attachedTarget) {
      AttachThreadInput(currentThreadId, targetThreadId, false);
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

      // 윈도우가 유효한지(종료되지 않았는지) 검사
      if (!IsWindow(hwnd)) {
        console.warn('[경고] 대상 윈도우 핸들이 유효하지 않거나 이미 닫힌 창입니다.');
        return false;
      }

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

      // ★ Koffi 포인터에서 실제 10진수 메모리 주소(숫자)를 안전하게 추출
      let numericHandle = 0;
      try {
        numericHandle = Number(koffi.address(hwnd));
      } catch (e) {
        numericHandle = 0;
      }

      return {
        exists: true,
        isMinimized: IsIconic(hwnd),
        isVisible: IsWindowVisible(hwnd),
        handle: numericHandle.toString(), // ★ 이제 완벽하게 "123456" 형태로 반환됨
      };
    } catch (error) {
      console.error('창 상태 확인 실패:', error);
      return { exists: false, error: error.message };
    }
  }
}

export default WindowManager;
