/**
 * WindowManager - Windows 창 관리 모듈
 * 원격 프로세스 창의 포커스, 최소화 복원 등 관리
 */

import { spawn } from 'child_process';

/**
 * 윈도우 관리자 클래스
 */
class WindowManager {
  /**
   * 프로세스 윈도우에 포커스
   * @param {number} processId - 프로세스 ID
   * @param {string} processType - 프로세스 타입
   * @param {string} ipAddress - 내부 IP
   * @param {string} externalIpAddress - 외부 IP
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindow(processId, processType = '', ipAddress = '', externalIpAddress = '') {
    return new Promise((resolve, reject) => {
      console.log('포커스 스크립트 실행:', { processId, processType, ipAddress, externalIpAddress });

      // ezHelp인 경우에만 IP 정보를 PowerShell에 전달
      const isEzHelp = processType?.toLowerCase() === 'ezhelp';
      const internalIp = ipAddress || '';
      const externalIp = externalIpAddress || '';

      const powerShellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Diagnostics;
        using System.Text;

        public class WindowFocus {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);

            [DllImport("user32.dll")]
            public static extern bool BringWindowToTop(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();

            [DllImport("user32.dll")]
            public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

            [DllImport("kernel32.dll")]
            public static extern uint GetCurrentThreadId();

            [DllImport("user32.dll")]
            public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

            [DllImport("user32.dll")]
            public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

            [DllImport("user32.dll")]
            public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

            [DllImport("user32.dll")]
            public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

            private const int GWL_STYLE = -16;
            private const int WS_VISIBLE = 0x10000000;

            public static bool FocusProcessWindow(int processId, bool isEzHelp, string internalIp, string externalIp) {
                try {
                    Console.WriteLine("[디버그] FocusProcessWindow 시작");
                    Console.WriteLine("[디버그] PID: " + processId + ", isEzHelp: " + isEzHelp);

                    Process process = Process.GetProcessById(processId);
                    IntPtr handle = process.MainWindowHandle;

                    if (handle == IntPtr.Zero) {
                        Console.WriteLine("[경고] MainWindowHandle이 Zero입니다.");
                        return false;
                    }

                    bool wasMinimized = IsIconic(handle);
                    Console.WriteLine("[디버그] 창 최소화 여부: " + wasMinimized);

                    // 현재 포그라운드 창 가져오기
                    IntPtr foregroundWindow = GetForegroundWindow();

                    // 타겟 창의 스레드 ID
                    uint targetThreadId;
                    GetWindowThreadProcessId(handle, out targetThreadId);

                    // 현재 스레드 ID
                    uint currentThreadId = GetCurrentThreadId();

                    // 포그라운드 창의 스레드 ID
                    uint foregroundThreadId = 0;
                    if (foregroundWindow != IntPtr.Zero) {
                        GetWindowThreadProcessId(foregroundWindow, out foregroundThreadId);
                    }

                    // 스레드 연결 (포커스 권한 획득)
                    bool attached = false;
                    if (foregroundThreadId != 0 && foregroundThreadId != currentThreadId) {
                        attached = AttachThreadInput(currentThreadId, foregroundThreadId, true);
                        Console.WriteLine("[디버그] AttachThreadInput 결과: " + attached);
                    }

                    try {
                        // 창이 최소화되어 있으면 복원
                        if (wasMinimized) {
                            ShowWindow(handle, 9); // SW_RESTORE
                        }

                        // 창을 최상위로 가져오기
                        BringWindowToTop(handle);

                        // 포커스 설정
                        bool focusResult = SetForegroundWindow(handle);
                        Console.WriteLine("[디버그] SetForegroundWindow 결과: " + focusResult);

                        if (!focusResult) {
                            // 실패 시 한번 더 시도
                            System.Threading.Thread.Sleep(50);
                            focusResult = SetForegroundWindow(handle);
                            Console.WriteLine("[디버그] SetForegroundWindow 재시도 결과: " + focusResult);
                        }

                        // ezHelp인 경우 컨트롤바 표시 (최소화 여부 무관, PID 기반)
                        if (isEzHelp) {
                            Console.WriteLine("[디버그] ezHelp 컨트롤바 표시 조건 충족 - ShowEzHelpControlBar 호출");
                            ShowEzHelpControlBar(processId);
                        }

                        return true; // 포커스 실패해도 컨트롤바는 활성화되므로 true 반환
                    } finally {
                        // 스레드 연결 해제
                        if (attached) {
                            AttachThreadInput(currentThreadId, foregroundThreadId, false);
                        }
                    }
                } catch (Exception ex) {
                    Console.WriteLine("[오류] FocusProcessWindow: " + ex.Message);
                    return false;
                }
            }

            private static void ShowEzHelpControlBar(int processId) {
                try {
                    Console.WriteLine("[디버그] ShowEzHelpControlBar 시작 - PID: " + processId);
                    int controlBarCount = 0;
                    int totalWindowCount = 0;

                    EnumWindows((hWnd, lParam) => {
                        totalWindowCount++;

                        // 이 창의 프로세스 ID 가져오기
                        uint windowProcessId;
                        GetWindowThreadProcessId(hWnd, out windowProcessId);

                        // 같은 PID인지 확인
                        if (windowProcessId == processId) {
                            StringBuilder className = new StringBuilder(256);
                            GetClassName(hWnd, className, className.Capacity);
                            string classNameStr = className.ToString();

                            StringBuilder title = new StringBuilder(256);
                            GetWindowText(hWnd, title, title.Capacity);
                            string titleStr = title.ToString();

                            Console.WriteLine("[디버그] 같은 PID 창 발견 - Class: " + classNameStr + ", Title: " + titleStr + ", Handle: " + hWnd.ToString("X"));

                            if (classNameStr == "HiRemoteMenuBar") {
                                controlBarCount++;
                                Console.WriteLine("[디버그] HiRemoteMenuBar 발견 #" + controlBarCount + " - Handle: " + hWnd.ToString("X"));

                                int currentStyle = GetWindowLong(hWnd, GWL_STYLE);
                                Console.WriteLine("[디버그] 현재 스타일: 0x" + currentStyle.ToString("X"));
                                Console.WriteLine("[디버그] WS_VISIBLE 비트: " + ((currentStyle & WS_VISIBLE) != 0));

                                if ((currentStyle & WS_VISIBLE) == 0) {
                                    int newStyle = currentStyle | WS_VISIBLE;
                                    SetWindowLong(hWnd, GWL_STYLE, newStyle);
                                    Console.WriteLine("[성공] ezHelp 컨트롤바 WS_VISIBLE 활성화: " + hWnd.ToString("X"));
                                } else {
                                    Console.WriteLine("[정보] 컨트롤바는 이미 WS_VISIBLE 상태입니다.");
                                }

                                return false; // 찾았으므로 검색 즉시 중단
                            }
                        }

                        return true; // 계속 검색
                    }, IntPtr.Zero);

                    Console.WriteLine("[디버그] 총 " + totalWindowCount + "개 창 검색, " + controlBarCount + "개의 HiRemoteMenuBar 발견");
                } catch (Exception ex) {
                    Console.WriteLine("[오류] ShowEzHelpControlBar: " + ex.Message);
                }
            }
        }
"@

        [WindowFocus]::FocusProcessWindow(${processId}, $${isEzHelp}, "${internalIp}", "${externalIp}")
      `;
      
      const child = spawn('powershell.exe', ['-Command', powerShellScript], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      
      child.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString('utf8');
      });
      
      child.on('close', (code) => {
        console.log('PowerShell 종료 코드:', code);
        console.log('PowerShell 출력:', output);
        if (error) {
          console.log('PowerShell 오류:', error);
        }

        if (code === 0) {
          // 출력의 마지막 줄만 가져와서 True/False 판정
          const lines = output.trim().split('\n');
          const lastLine = lines[lines.length - 1].trim().toLowerCase();
          const isSuccess = lastLine === 'true';
          console.log('포커스 결과 파싱:', { totalLines: lines.length, lastLine, isSuccess });
          resolve(isSuccess);
        } else {
          console.error('Focus window error:', error);
          resolve(false); // reject 대신 false로 resolve
        }
      });

      // 타임아웃 설정
      setTimeout(() => {
        child.kill();
        resolve(false); // reject 대신 false로 resolve
      }, 10000);
    });
  }

  /**
   * 특정 WindowHandle로 창 포커스
   * @param {string} windowHandle - 창 핸들
   * @param {string} processType - 프로세스 타입
   * @param {string} ipAddress - 내부 IP
   * @param {string} externalIpAddress - 외부 IP
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindowByHandle(windowHandle, processType = '', ipAddress = '', externalIpAddress = '') {
    return new Promise((resolve, reject) => {
      console.log('핸들 포커스 스크립트 실행:', { windowHandle, processType, ipAddress, externalIpAddress });

      const isEzHelp = processType?.toLowerCase() === 'ezhelp';
      const internalIp = ipAddress || '';
      const externalIp = externalIpAddress || '';
      
      const powerShellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;

        public class WindowFocus {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);

            [DllImport("user32.dll")]
            public static extern bool BringWindowToTop(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hwnd);

            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();

            [DllImport("user32.dll")]
            public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

            [DllImport("kernel32.dll")]
            public static extern uint GetCurrentThreadId();

            [DllImport("user32.dll")]
            public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

            [DllImport("user32.dll")]
            public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

            [DllImport("user32.dll")]
            public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

            [DllImport("user32.dll")]
            public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

            private const int GWL_STYLE = -16;
            private const int WS_VISIBLE = 0x10000000;

            public static bool FocusWindowByHandle(IntPtr handle, bool isEzHelp, string internalIp, string externalIp) {
                try {
                    Console.WriteLine("[디버그 Handle] FocusWindowByHandle 시작");
                    Console.WriteLine("[디버그 Handle] Handle: " + handle.ToString("X") + ", isEzHelp: " + isEzHelp);

                    if (handle == IntPtr.Zero) {
                        Console.WriteLine("[경고 Handle] Handle이 Zero입니다.");
                        return false;
                    }

                    bool wasMinimized = IsIconic(handle);
                    Console.WriteLine("[디버그 Handle] 창 최소화 여부: " + wasMinimized);

                    // 창의 PID 가져오기
                    uint processId;
                    GetWindowThreadProcessId(handle, out processId);
                    Console.WriteLine("[디버그 Handle] 창의 PID: " + processId);

                    // 현재 포그라운드 창 가져오기
                    IntPtr foregroundWindow = GetForegroundWindow();

                    // 현재 스레드 ID
                    uint currentThreadId = GetCurrentThreadId();

                    // 포그라운드 창의 스레드 ID
                    uint foregroundThreadId = 0;
                    if (foregroundWindow != IntPtr.Zero) {
                        GetWindowThreadProcessId(foregroundWindow, out foregroundThreadId);
                    }

                    // 스레드 연결 (포커스 권한 획득)
                    bool attached = false;
                    if (foregroundThreadId != 0 && foregroundThreadId != currentThreadId) {
                        attached = AttachThreadInput(currentThreadId, foregroundThreadId, true);
                        Console.WriteLine("[디버그 Handle] AttachThreadInput 결과: " + attached);
                    }

                    try {
                        // 창이 최소화되어 있으면 복원
                        if (wasMinimized) {
                            ShowWindow(handle, 9); // SW_RESTORE
                        }

                        // 창을 최상위로 가져오기
                        BringWindowToTop(handle);

                        // 포커스 설정
                        bool focusResult = SetForegroundWindow(handle);
                        Console.WriteLine("[디버그 Handle] SetForegroundWindow 결과: " + focusResult);

                        if (!focusResult) {
                            // 실패 시 한번 더 시도
                            System.Threading.Thread.Sleep(50);
                            focusResult = SetForegroundWindow(handle);
                            Console.WriteLine("[디버그 Handle] SetForegroundWindow 재시도 결과: " + focusResult);
                        }

                        // ezHelp인 경우 컨트롤바 표시 (최소화 여부 무관, PID 기반)
                        if (isEzHelp) {
                            Console.WriteLine("[디버그 Handle] ezHelp 컨트롤바 표시 조건 충족 - ShowEzHelpControlBar 호출");
                            ShowEzHelpControlBar((int)processId);
                        }

                        return true; // 포커스 실패해도 컨트롤바는 활성화되므로 true 반환
                    } finally {
                        // 스레드 연결 해제
                        if (attached) {
                            AttachThreadInput(currentThreadId, foregroundThreadId, false);
                        }
                    }
                } catch (Exception ex) {
                    Console.WriteLine("[오류 Handle] FocusWindowByHandle: " + ex.Message);
                    return false;
                }
            }

            private static void ShowEzHelpControlBar(int processId) {
                try {
                    Console.WriteLine("[디버그 Handle] ShowEzHelpControlBar 시작 - PID: " + processId);
                    int controlBarCount = 0;
                    int totalWindowCount = 0;

                    EnumWindows((hWnd, lParam) => {
                        totalWindowCount++;

                        // 이 창의 프로세스 ID 가져오기
                        uint windowProcessId;
                        GetWindowThreadProcessId(hWnd, out windowProcessId);

                        // 같은 PID인지 확인
                        if (windowProcessId == processId) {
                            StringBuilder className = new StringBuilder(256);
                            GetClassName(hWnd, className, className.Capacity);
                            string classNameStr = className.ToString();

                            StringBuilder title = new StringBuilder(256);
                            GetWindowText(hWnd, title, title.Capacity);
                            string titleStr = title.ToString();

                            Console.WriteLine("[디버그 Handle] 같은 PID 창 발견 - Class: " + classNameStr + ", Title: " + titleStr + ", Handle: " + hWnd.ToString("X"));

                            if (classNameStr == "HiRemoteMenuBar") {
                                controlBarCount++;
                                Console.WriteLine("[디버그 Handle] HiRemoteMenuBar 발견 #" + controlBarCount + " - Handle: " + hWnd.ToString("X"));

                                int currentStyle = GetWindowLong(hWnd, GWL_STYLE);
                                Console.WriteLine("[디버그 Handle] 현재 스타일: 0x" + currentStyle.ToString("X"));
                                Console.WriteLine("[디버그 Handle] WS_VISIBLE 비트: " + ((currentStyle & WS_VISIBLE) != 0));

                                if ((currentStyle & WS_VISIBLE) == 0) {
                                    int newStyle = currentStyle | WS_VISIBLE;
                                    SetWindowLong(hWnd, GWL_STYLE, newStyle);
                                    Console.WriteLine("[성공 Handle] ezHelp 컨트롤바 WS_VISIBLE 활성화: " + hWnd.ToString("X"));
                                } else {
                                    Console.WriteLine("[정보 Handle] 컨트롤바는 이미 WS_VISIBLE 상태입니다.");
                                }

                                return false; // 찾았으므로 검색 즉시 중단
                            }
                        }

                        return true; // 계속 검색
                    }, IntPtr.Zero);

                    Console.WriteLine("[디버그 Handle] 총 " + totalWindowCount + "개 창 검색, " + controlBarCount + "개의 HiRemoteMenuBar 발견");
                } catch (Exception ex) {
                    Console.WriteLine("[오류 Handle] ShowEzHelpControlBar: " + ex.Message);
                }
            }
        }
"@

        $handle = [IntPtr]::new(${windowHandle})
        [WindowFocus]::FocusWindowByHandle($handle, $${isEzHelp}, "${internalIp}", "${externalIp}")
      `;
      
      const child = spawn('powershell.exe', ['-Command', powerShellScript], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      
      child.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString('utf8');
      });
      
      child.on('close', (code) => {
        console.log('PowerShell 종료 코드 (handle):', code);
        console.log('PowerShell 출력 (handle):', output);
        if (error) {
          console.log('PowerShell 오류 (handle):', error);
        }

        if (code === 0) {
          // 출력의 마지막 줄만 가져와서 True/False 판정
          const lines = output.trim().split('\n');
          const lastLine = lines[lines.length - 1].trim().toLowerCase();
          const isSuccess = lastLine === 'true';
          console.log('포커스 결과 파싱 (handle):', { totalLines: lines.length, lastLine, isSuccess });
          resolve(isSuccess);
        } else {
          console.error('Focus window by handle error:', error);
          resolve(false); // reject 대신 false로 resolve
        }
      });

      // 타임아웃 설정
      setTimeout(() => {
        child.kill();
        resolve(false); // reject 대신 false로 resolve
      }, 10000);
    });
  }


  /**
   * 프로세스 종료
   * @param {number} processId - 프로세스 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  static async terminateProcess(processId) {
    try {
      const powershellScript = `
        try {
            $process = Get-Process -Id ${processId} -ErrorAction Stop
            $process.Kill()
            @{ success = $true } | ConvertTo-Json
        } catch {
            @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
        }
      `;

      const { stdout } = await execAsync(powershellScript, {
        encoding: 'utf8',
        windowsHide: true,
      });

      const result = JSON.parse(stdout.trim());
      return result.success;
    } catch (error) {
      console.error('프로세스 종료 실패:', error);
      throw new Error(`프로세스 종료 중 오류가 발생했습니다: ${error.message}`);
    }
  }


  /**
   * 창 상태 확인
   * @param {number} processId - 프로세스 ID
   * @returns {Promise<Object>} 창 상태 정보
   */
  static async getWindowState(processId) {
    try {
      const powershellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Diagnostics;

        public class WindowStateChecker {
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hWnd);
            
            public static object GetWindowState(int processId) {
                try {
                    Process process = Process.GetProcessById(processId);
                    IntPtr handle = process.MainWindowHandle;
                    
                    if (handle == IntPtr.Zero) {
                        return new { exists = false };
                    }
                    
                    return new {
                        exists = true,
                        isMinimized = IsIconic(handle),
                        isVisible = IsWindowVisible(handle),
                        handle = handle.ToString()
                    };
                } catch {
                    return new { exists = false };
                }
            }
        }
"@

        try {
            [WindowStateChecker]::GetWindowState(${processId}) | ConvertTo-Json
        } catch {
            @{ exists = $false; error = $_.Exception.Message } | ConvertTo-Json
        }
      `;

      const { stdout } = await execAsync(powershellScript, {
        encoding: 'utf8',
        windowsHide: true,
      });

      return JSON.parse(stdout.trim());
    } catch (error) {
      console.error('창 상태 확인 실패:', error);
      return { exists: false, error: error.message };
    }
  }
}

export default WindowManager;