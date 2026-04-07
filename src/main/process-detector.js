/**
 * ProcessDetector - Windows 프로세스 감지 모듈 (Koffi 초고속 최적화 및 버그 픽스)
 * - 역할: Win32 API를 직접 호출하여 실행 중인 모든 창 정보를 즉시 수집
 * - 중복 제거: 자바스크립트 단에서 "WindowHandle"을 유일한 기준으로 삼아 중복을 제거.
 */

import koffi from 'koffi';

// ============================================================================
// 1. Koffi를 이용한 Win32 API 및 타입 정의
// ============================================================================
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

// Win32 API 타입 매핑 (BOOL은 C언어에서 4바이트 int이므로 int로 설정)
const HWND = 'void*';
const DWORD = 'uint32';
const HANDLE = 'void*';

const DetectorEnumProc = koffi.proto(
  'int __stdcall DetectorEnumProc(void* hwnd, void* lParam)'
);
const EnumWindows = user32.func('__stdcall', 'EnumWindows', 'int', [
  koffi.pointer(DetectorEnumProc),
  'void*',
]);
const GetWindowThreadProcessId = user32.func(
  '__stdcall',
  'GetWindowThreadProcessId',
  DWORD,
  [HWND, 'uint32*']
);
const GetWindowTextW = user32.func('__stdcall', 'GetWindowTextW', 'int', [
  HWND,
  'void*',
  'int',
]);
const IsIconic = user32.func('__stdcall', 'IsIconic', 'int', [HWND]);
const IsWindowVisible = user32.func('__stdcall', 'IsWindowVisible', 'int', [
  HWND,
]);

const OpenProcess = kernel32.func('__stdcall', 'OpenProcess', HANDLE, [
  DWORD,
  'int',
  DWORD,
]);
const CloseHandle = kernel32.func('__stdcall', 'CloseHandle', 'int', [HANDLE]);
const QueryFullProcessImageNameW = kernel32.func(
  '__stdcall',
  'QueryFullProcessImageNameW',
  'int',
  [HANDLE, DWORD, 'void*', 'uint32*']
);

class ProcessDetector {
  static async detectRemoteProcesses() {
    return new Promise(resolve => {
      const rawProcesses = [];

      const callback = koffi.register((hwnd, lParam) => {
        try {
          const titleBuf = Buffer.alloc(1024);
          const titleLen = GetWindowTextW(hwnd, titleBuf, 512);

          // 제목이 있는 유효한 창만 대상
          if (titleLen > 0) {
            const title = titleBuf.toString('utf16le').substring(0, titleLen);

            const pidArray = new Uint32Array(1);
            GetWindowThreadProcessId(hwnd, pidArray);
            const pid = pidArray[0];

            // Win32 BOOL(int) 반환값을 자바스크립트 Boolean으로 변환 (0이 아니면 true)
            const isMinimized = IsIconic(hwnd) !== 0;
            const isVisible = IsWindowVisible(hwnd) !== 0;

            let processName = 'Unknown';
            try {
              // 0x1000 = PROCESS_QUERY_LIMITED_INFORMATION
              const hProcess = OpenProcess(0x1000, 0, pid);
              if (hProcess) {
                const exeBuf = Buffer.alloc(1024);
                const sizeArray = new Uint32Array([512]);

                if (
                  QueryFullProcessImageNameW(hProcess, 0, exeBuf, sizeArray) !==
                  0
                ) {
                  const exePath = exeBuf
                    .toString('utf16le')
                    .substring(0, sizeArray[0]);
                  processName = exePath
                    .split('\\')
                    .pop()
                    .replace(/\.exe$/i, '');
                }
                CloseHandle(hProcess);
              }
            } catch (e) {
              // 권한이 없는 시스템 프로세스 등의 에러는 앱이 뻗지 않게 무시하고 Unknown 유지
            }

            // ★ 핵심 버그 픽스: 포인터(객체)를 안전하게 숫자로 변환
            let numericHandle = 0;
            try {
              // Koffi 외부 포인터 주소를 실제 10진수 숫자로 추출
              numericHandle = Number(koffi.address(hwnd));
            } catch (e) {
              numericHandle = Number(hwnd) || 0;
            }

            rawProcesses.push({
              ProcessName: processName,
              MainWindowTitle: title,
              Id: pid,
              WindowHandle: numericHandle,
              IsMinimized: isMinimized,
              IsVisible: isVisible,
            });
          }
        } catch (error) {
          console.error('[오류] 개별 창 정보 파싱 중 에러:', error);
        }

        return 1; // 1(True)을 반환해야 다음 창을 계속 탐색함
      }, koffi.pointer(DetectorEnumProc));

      // EnumWindows 실행 (동기 호출)
      EnumWindows(callback, null);

      koffi.unregister(callback);

      const uniqueProcesses = this.removeDuplicatesByHandle(rawProcesses);
      resolve(uniqueProcesses);
    });
  }

  static removeDuplicatesByHandle(processes) {
    const handleMap = new Map();

    for (const process of processes) {
      // WindowHandle이 0이거나 NaN 등 유효하지 않은 경우 무시
      if (process && process.WindowHandle) {
        handleMap.set(process.WindowHandle, process);
      }
    }

    return Array.from(handleMap.values());
  }

  static generateUniqueWindowHandleForChrome(windowTitle, originalHandle) {
    if (!this.chromeWindowHandleCache) {
      this.chromeWindowHandleCache = new Map();
    }
    const cacheKey = windowTitle + '_' + originalHandle;
    if (this.chromeWindowHandleCache.has(cacheKey)) {
      return this.chromeWindowHandleCache.get(cacheKey);
    }
    const computerName = windowTitle.replace(' - TeamViewer', '');
    let nameHash = 0;
    for (let i = 0; i < computerName.length; i++) {
      const char = computerName.charCodeAt(i);
      nameHash = (nameHash << 5) - nameHash + char;
      nameHash = nameHash & nameHash;
    }
    const sequenceNumber = this.chromeWindowHandleCache.size + 1;
    const uniqueHandle =
      Math.abs(nameHash) + Math.abs(originalHandle) + sequenceNumber * 10000;
    this.chromeWindowHandleCache.set(cacheKey, uniqueHandle);
    return uniqueHandle;
  }
}

export default ProcessDetector;
