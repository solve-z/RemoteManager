/**
 * WindowManager - Windows 창 관리 모듈
 * 원격 프로세스 창의 포커스, 최소화 복원 등 관리
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 윈도우 관리자 클래스
 */
class WindowManager {
  /**
   * 프로세스 윈도우에 포커스
   * @param {number} processId - 프로세스 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindow(processId) {
    try {
      const powershellScript = this.generateFocusScript(processId);
      const { stdout } = await execAsync(powershellScript, {
        encoding: 'utf8',
        windowsHide: true,
      });

      const result = JSON.parse(stdout.trim());
      return result.success;
    } catch (error) {
      console.error('윈도우 포커스 실패:', error);
      throw new Error(`윈도우 포커스 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 특정 WindowHandle로 창 포커스
   * @param {string} windowHandle - 창 핸들
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindowByHandle(windowHandle) {
    try {
      const powershellScript = this.generateFocusScriptByHandle(windowHandle);
      const { stdout } = await execAsync(powershellScript, {
        encoding: 'utf8',
        windowsHide: true,
      });

      const result = JSON.parse(stdout.trim());
      return result.success;
    } catch (error) {
      console.error('윈도우 핸들 포커스 실패:', error);
      throw new Error(`윈도우 포커스 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 프로세스 ID 기반 포커스 PowerShell 스크립트 생성
   * @param {number} processId - 프로세스 ID
   * @returns {string} PowerShell 스크립트
   */
  static generateFocusScript(processId) {
    return `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Diagnostics;

      public class WindowFocuser {
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          
          [DllImport("user32.dll")]
          public static extern bool BringWindowToTop(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool IsIconic(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool IsWindowVisible(IntPtr hWnd);
          
          public const int SW_RESTORE = 9;
          public const int SW_SHOW = 5;
          public const int SW_NORMAL = 1;
          
          public static bool FocusProcessWindow(int processId) {
              try {
                  Process process = Process.GetProcessById(processId);
                  IntPtr mainWindowHandle = process.MainWindowHandle;
                  
                  if (mainWindowHandle == IntPtr.Zero) {
                      return false;
                  }
                  
                  // 최소화된 창이면 복원
                  if (IsIconic(mainWindowHandle)) {
                      ShowWindow(mainWindowHandle, SW_RESTORE);
                  }
                  
                  // 창을 표시하고 포커스
                  ShowWindow(mainWindowHandle, SW_SHOW);
                  BringWindowToTop(mainWindowHandle);
                  SetForegroundWindow(mainWindowHandle);
                  
                  return true;
              } catch {
                  return false;
              }
          }
      }
"@

      try {
          $success = [WindowFocuser]::FocusProcessWindow(${processId})
          @{ success = $success } | ConvertTo-Json
      } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
      }
    `;
  }

  /**
   * WindowHandle 기반 포커스 PowerShell 스크립트 생성
   * @param {string} windowHandle - 창 핸들
   * @returns {string} PowerShell 스크립트
   */
  static generateFocusScriptByHandle(windowHandle) {
    return `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;

      public class WindowFocuser {
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          
          [DllImport("user32.dll")]
          public static extern bool BringWindowToTop(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool IsIconic(IntPtr hWnd);
          
          [DllImport("user32.dll")]
          public static extern bool IsWindowVisible(IntPtr hWnd);
          
          public const int SW_RESTORE = 9;
          public const int SW_SHOW = 5;
          public const int SW_NORMAL = 1;
          
          public static bool FocusWindowByHandle(IntPtr windowHandle) {
              try {
                  if (windowHandle == IntPtr.Zero) {
                      return false;
                  }
                  
                  // 최소화된 창이면 복원
                  if (IsIconic(windowHandle)) {
                      ShowWindow(windowHandle, SW_RESTORE);
                  }
                  
                  // 창을 표시하고 포커스
                  ShowWindow(windowHandle, SW_SHOW);
                  BringWindowToTop(windowHandle);
                  SetForegroundWindow(windowHandle);
                  
                  return true;
              } catch {
                  return false;
              }
          }
      }
"@

      try {
          $handle = [IntPtr]::new(${windowHandle})
          $success = [WindowFocuser]::FocusWindowByHandle($handle)
          @{ success = $success } | ConvertTo-Json
      } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
      }
    `;
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