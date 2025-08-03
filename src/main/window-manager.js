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
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindow(processId) {
    return new Promise((resolve, reject) => {
      console.log('포커스 스크립트 실행:', processId);
      
      const powerShellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Diagnostics;
        
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
            
            public static bool FocusProcessWindow(int processId) {
                try {
                    Process process = Process.GetProcessById(processId);
                    IntPtr handle = process.MainWindowHandle;
                    
                    if (handle == IntPtr.Zero) {
                        return false;
                    }
                    
                    // 창이 최소화되어 있으면 복원
                    if (IsIconic(handle)) {
                        ShowWindow(handle, 9); // SW_RESTORE
                    }
                    
                    // 창을 최상위로 가져오기
                    BringWindowToTop(handle);
                    
                    // 포커스 설정
                    return SetForegroundWindow(handle);
                } catch {
                    return false;
                }
            }
        }
"@
        
        [WindowFocus]::FocusProcessWindow(${processId})
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
   * 특정 WindowHandle로 창 포커스
   * @param {string} windowHandle - 창 핸들
   * @returns {Promise<boolean>} 성공 여부
   */
  static async focusWindowByHandle(windowHandle) {
    return new Promise((resolve, reject) => {
      console.log('핸들 포커스 스크립트 실행:', windowHandle);
      
      const powerShellScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        
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
            
            public static bool FocusWindowByHandle(IntPtr handle) {
                try {
                    if (handle == IntPtr.Zero) {
                        return false;
                    }
                    
                    // 창이 최소화되어 있으면 복원
                    if (IsIconic(handle)) {
                        ShowWindow(handle, 9); // SW_RESTORE
                    }
                    
                    // 창을 최상위로 가져오기
                    BringWindowToTop(handle);
                    
                    // 포커스 설정
                    return SetForegroundWindow(handle);
                } catch {
                    return false;
                }
            }
        }
"@
        
        $handle = [IntPtr]::new(${windowHandle})
        [WindowFocus]::FocusWindowByHandle($handle)
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