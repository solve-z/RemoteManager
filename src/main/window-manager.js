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
   * 프로세스 윈도우에 포커스 (ezHelp 최소화 시 컨트롤바 자동 표시)
   * @param {number} processId - 프로세스 ID
   * @param {string} processType - 프로세스 타입 ('ezhelp', 'teamviewer' 등)
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindow(processId, processType = null) {
    return new Promise((resolve, reject) => {
      console.log('포커스 스크립트 실행:', processId);
      
      const powerShellScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;
using System.Threading;

public class WindowFocusWithControlBar {
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
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly uint SWP_NOSIZE = 0x0001;
    public static readonly uint SWP_NOMOVE = 0x0002;
    public static readonly uint SWP_SHOWWINDOW = 0x0040;

    public static bool FocusProcessWindowWithControlBar(int processId, string processType) {
        try {
            Process process = Process.GetProcessById(processId);
            IntPtr handle = process.MainWindowHandle;
            
            if (handle == IntPtr.Zero) {
                return false;
            }
            
            bool wasMinimized = IsIconic(handle);
            
            // 일반적인 포커스 처리
            if (wasMinimized) {
                ShowWindow(handle, 9); // SW_RESTORE
            }
            
            // 강력한 포커스 시도
            BringWindowToTop(handle);
            bool focusResult = SetForegroundWindow(handle);
            
            // 실패 시 대안 방법
            if (!focusResult) {
                SetWindowPos(handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                Thread.Sleep(100);
                SetWindowPos(handle, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                focusResult = SetForegroundWindow(handle);
            }
            
            // ezHelp의 경우 최소화되어 있었다면 컨트롤바도 표시
            if (processType == "ezhelp" && wasMinimized) {
                try {
                    // 여러 가능한 컨트롤바 클래스명으로 시도 (ezHelp 버전 대응)
                    string[] controlBarClasses = { "HiRemoteMenuBar", "ezHelpControlBar", "RemoteControlBar", "ezHelpMenuBar" };
                    
                    foreach (string className in controlBarClasses) {
                        IntPtr currentBar = IntPtr.Zero;
                        while (true) {
                            currentBar = FindWindowEx(IntPtr.Zero, currentBar, className, null);
                            if (currentBar == IntPtr.Zero) {
                                break; // 더 이상 찾을 창이 없음
                            }
                            
                            // 다양한 조건으로 컨트롤바 복원 시도
                            bool needsRestore = !IsWindowVisible(currentBar) || IsIconic(currentBar);
                            
                            if (needsRestore) {
                                // 1차: 일반 표시
                                ShowWindow(currentBar, 1); // SW_SHOWNORMAL
                                
                                // 2차: 최소화 해제
                                if (IsIconic(currentBar)) {
                                    ShowWindow(currentBar, 9); // SW_RESTORE
                                }
                                
                                // 3차: 잠시 최상위로 설정하여 확실히 보이게 함
                                SetWindowPos(currentBar, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                                Thread.Sleep(100);
                                SetWindowPos(currentBar, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                                
                                // 4차: 포커스도 시도
                                BringWindowToTop(currentBar);
                            }
                        }
                    }
                } catch {
                    // 컨트롤바 표시 실패해도 메인 포커스는 성공으로 처리
                }
            }
            
            return focusResult;
        } catch {
            return false;
        }
    }
}
"@

[WindowFocusWithControlBar]::FocusProcessWindowWithControlBar(${processId}, "${processType || ''}")
      `;
      
      const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', powerShellScript], {
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
          const result = output.trim().toLowerCase();
          resolve(result === 'true');
        } else {
          console.error('Focus window error:', error);
          reject(new Error('윈도우 포커스 실패: ' + error));
        }
      });
      
      // 타임아웃 설정
      setTimeout(() => {
        child.kill();
        reject(new Error('PowerShell 실행 타임아웃'));
      }, 10000);
    });
  }

  /**
   * 특정 WindowHandle로 창 포커스 (ezHelp 최소화 시 컨트롤바 자동 표시)
   * @param {string} windowHandle - 창 핸들
   * @param {string} processType - 프로세스 타입 ('ezhelp', 'teamviewer' 등)
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindowByHandle(windowHandle, processType = null) {
    return new Promise((resolve, reject) => {
      console.log('핸들 포커스 스크립트 실행:', windowHandle);
      
      const powerShellScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class WindowFocusByHandleWithControlBar {
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
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly uint SWP_NOSIZE = 0x0001;
    public static readonly uint SWP_NOMOVE = 0x0002;
    public static readonly uint SWP_SHOWWINDOW = 0x0040;
    
    public static bool FocusWindowByHandleWithControlBar(IntPtr handle, string processType) {
        try {
            if (handle == IntPtr.Zero) {
                return false;
            }
            
            bool wasMinimized = IsIconic(handle);
            
            // 일반적인 포커스 처리
            if (wasMinimized) {
                ShowWindow(handle, 9); // SW_RESTORE
            }
            
            // 강력한 포커스 시도
            BringWindowToTop(handle);
            bool focusResult = SetForegroundWindow(handle);
            
            // 실패 시 대안 방법
            if (!focusResult) {
                SetWindowPos(handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                Thread.Sleep(100);
                SetWindowPos(handle, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                focusResult = SetForegroundWindow(handle);
            }
            
            // ezHelp의 경우 최소화되어 있었다면 컨트롤바도 표시
            if (processType == "ezhelp" && wasMinimized) {
                try {
                    // 여러 가능한 컨트롤바 클래스명으로 시도 (ezHelp 버전 대응)
                    string[] controlBarClasses = { "HiRemoteMenuBar", "ezHelpControlBar", "RemoteControlBar", "ezHelpMenuBar" };
                    
                    foreach (string className in controlBarClasses) {
                        IntPtr currentBar = IntPtr.Zero;
                        while (true) {
                            currentBar = FindWindowEx(IntPtr.Zero, currentBar, className, null);
                            if (currentBar == IntPtr.Zero) {
                                break; // 더 이상 찾을 창이 없음
                            }
                            
                            // 다양한 조건으로 컨트롤바 복원 시도
                            bool needsRestore = !IsWindowVisible(currentBar) || IsIconic(currentBar);
                            
                            if (needsRestore) {
                                // 1차: 일반 표시
                                ShowWindow(currentBar, 1); // SW_SHOWNORMAL
                                
                                // 2차: 최소화 해제
                                if (IsIconic(currentBar)) {
                                    ShowWindow(currentBar, 9); // SW_RESTORE
                                }
                                
                                // 3차: 잠시 최상위로 설정하여 확실히 보이게 함
                                SetWindowPos(currentBar, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                                Thread.Sleep(100);
                                SetWindowPos(currentBar, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                                
                                // 4차: 포커스도 시도
                                BringWindowToTop(currentBar);
                            }
                        }
                    }
                } catch {
                    // 컨트롤바 표시 실패해도 메인 포커스는 성공으로 처리
                }
            }
            
            return focusResult;
        } catch {
            return false;
        }
    }
}
"@

$handle = [IntPtr]::new(${windowHandle})
[WindowFocusByHandleWithControlBar]::FocusWindowByHandleWithControlBar($handle, "${processType || ''}")
      `;
      
      const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', powerShellScript], {
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
          const result = output.trim().toLowerCase();
          resolve(result === 'true');
        } else {
          console.error('Focus window by handle error:', error);
          reject(new Error('윈도우 포커스 실패: ' + error));
        }
      });
      
      // 타임아웃 설정
      setTimeout(() => {
        child.kill();
        reject(new Error('PowerShell 실행 타임아웃'));
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
   * ezHelp 컨트롤바 표시 (최소화 상태에서도)
   * @param {number} processId - ezHelp 프로세스 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  static async showEzHelpControlBar(processId) {
    return new Promise((resolve, reject) => {
      console.log('ezHelp 컨트롤바 표시 시도:', processId);
      
      const powerShellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Diagnostics;
        using System.Collections.Generic;
        using System.Text;

        public class EzHelpControlBarManager {
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
            
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
            
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            
            [DllImport("user32.dll")]
            public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
            
            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern bool SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
            
            [DllImport("user32.dll")]
            public static extern IntPtr GetParent(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);
            
            public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);
            
            [DllImport("user32.dll")]
            public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
            
            public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
            public static readonly uint SWP_NOSIZE = 0x0001;
            public static readonly uint SWP_NOMOVE = 0x0002;
            public static readonly uint SWP_SHOWWINDOW = 0x0040;
            
            public static bool ShowEzHelpControlBar(int processId) {
                try {
                    Process process = Process.GetProcessById(processId);
                    IntPtr mainWindow = process.MainWindowHandle;
                    
                    if (mainWindow == IntPtr.Zero) {
                        return false;
                    }
                    
                    // HiRemoteMenuBar 클래스를 가진 자식 창 찾기
                    IntPtr controlBar = FindWindowEx(IntPtr.Zero, IntPtr.Zero, "HiRemoteMenuBar", null);
                    
                    if (controlBar == IntPtr.Zero) {
                        return false;
                    }
                    
                    // 부모 창이 최소화되어 있는지 확인
                    bool mainWindowMinimized = IsIconic(mainWindow);
                    
                    if (mainWindowMinimized) {
                        // 방법 1: 컨트롤바를 독립적으로 표시
                        ShowWindow(controlBar, 1); // SW_SHOWNORMAL
                        
                        // 방법 2: 컨트롤바를 최상위로 설정
                        SetWindowPos(controlBar, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                        
                        return IsWindowVisible(controlBar);
                    } else {
                        // 이미 부모 창이 활성화되어 있으면 정상적으로 표시됨
                        return IsWindowVisible(controlBar);
                    }
                } catch (Exception ex) {
                    return false;
                }
            }
        }
"@
        
        [EzHelpControlBarManager]::ShowEzHelpControlBar(${processId})
      `;
      
      const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', powerShellScript], {
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
        console.log('PowerShell 종료 코드 (컨트롤바):', code);
        console.log('PowerShell 출력 (컨트롤바):', output);
        if (error) {
          console.log('PowerShell 오류 (컨트롤바):', error);
        }
        
        if (code === 0) {
          const result = output.trim().toLowerCase();
          resolve(result === 'true');
        } else {
          console.error('Show control bar error:', error);
          reject(new Error('컨트롤바 표시 실패: ' + error));
        }
      });
      
      // 타임아웃 설정
      setTimeout(() => {
        child.kill();
        reject(new Error('PowerShell 실행 타임아웃'));
      }, 10000);
    });
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