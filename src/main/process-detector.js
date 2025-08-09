/**
 * ProcessDetector - Windows 프로세스 감지 모듈 (최종 수정 완료)
 * - 역할: PowerShell을 통해 실행 중인 모든 잠재적 원격 창 정보를 "날것 그대로" 수집.
 * - 중복 제거: 자바스크립트 단에서 "WindowHandle"을 유일한 기준으로 삼아 중복을 제거.
 * - 실제 환경과 테스트 환경 모두에서 다중 세션을 완벽하게 지원.
 */

import { spawn } from 'child_process';

class ProcessDetector {
  /**
   * 원격 프로세스 감지 (EnumWindows API 기반)
   * @returns {Promise<Array>} 원시 프로세스 정보 배열
   */
  static async detectRemoteProcesses() {
    return new Promise((resolve, reject) => {
      // ★★★ 핵심 수정: PowerShell의 자체 중복 제거 로직을 제거하여 모든 창을 일단 다 가져옵니다.
      const powerShellScript = `
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        
        # 1. Get-Process로 기본 정보 수집
        $standardProcesses = Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
            ForEach-Object {
                @{
                    ProcessName = $_.ProcessName; MainWindowTitle = $_.MainWindowTitle; Id = $_.Id;
                    WindowHandle = [int64]$_.MainWindowHandle; IsMinimized = $false; IsVisible = $true
                }
            }
        
        # 2. EnumWindows API로 모든 창 정보 수집 (최소화, 숨김 창 포함)
        Add-Type @"
        using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
        public class WindowEnumerator {
            [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
            [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
            [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            public static List<WindowInfo> GetAllWindows() {
                var windows = new List<WindowInfo>();
                EnumWindows((hWnd, lParam) => {
                    try {
                        uint processId; GetWindowThreadProcessId(hWnd, out processId);
                        var title = new StringBuilder(256); GetWindowText(hWnd, title, title.Capacity);
                        windows.Add(new WindowInfo {
                            Handle = hWnd, ProcessId = processId, Title = title.ToString(),
                            IsMinimized = IsIconic(hWnd), IsVisible = IsWindowVisible(hWnd)
                        });
                    } catch { }
                    return true;
                }, IntPtr.Zero);
                return windows;
            }
        }
        public class WindowInfo {
            public IntPtr Handle { get; set; } public uint ProcessId { get; set; } public string Title { get; set; }
            public bool IsMinimized { get; set; } public bool IsVisible { get; set; }
        }
"@
        $allWindows = [WindowEnumerator]::GetAllWindows()
        $enhancedProcesses = @()
        foreach ($window in $allWindows) {
            if ($window.Title -ne "") {
                try {
                    $process = Get-Process -Id $window.ProcessId -ErrorAction SilentlyContinue
                    if ($process) {
                        $enhancedProcesses += @{
                            ProcessName = $process.ProcessName; MainWindowTitle = $window.Title; Id = $process.Id;
                            WindowHandle = [int64]$window.Handle; IsMinimized = $window.IsMinimized; IsVisible = $window.IsVisible
                        }
                    }
                } catch {}
            }
        }
        
        # 3. 두 목록을 합쳐서 JSON으로 변환
        $allProcesses = $standardProcesses + $enhancedProcesses
        $allProcesses | ConvertTo-Json
      `;

      try {
        const child = spawn('powershell.exe', ['-Command', powerShellScript]);
        let output = '';
        child.stdout.on('data', (data) => { output += data.toString('utf8'); });
        child.stderr.on('data', (data) => { console.error(`PowerShell Error: ${data.toString('utf8')}`); });

        child.on('close', (code) => {
          if (code === 0) {
            try {
              if (!output.trim()) return resolve([]);

              const processes = JSON.parse(output);
              const rawProcesses = Array.isArray(processes) ? processes : [processes];

              // ★★★ 여기가 최종 관문: WindowHandle을 기준으로 중복을 제거합니다.
              const uniqueProcesses = this.removeDuplicatesByHandle(rawProcesses);
              resolve(uniqueProcesses);
            } catch (parseError) {
              console.error('JSON 파싱 오류:', parseError, 'Raw output:', output);
              resolve([]);
            }
          } else {
            reject(new Error(`프로세스 감지 중 오류 발생 (코드: ${code})`));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * WindowHandle을 유일한 기준으로 삼아 중복된 프로세스 정보를 제거합니다.
   * - PowerShell에서 가져온 두 목록(Standard, Enhanced)을 병합하고 정리하는 역할을 합니다.
   * @param {Array} processes - 잠재적으로 중복된 프로세스 정보 배열
   * @returns {Array} WindowHandle이 고유한 프로세스 정보 배열
   */
  static removeDuplicatesByHandle(processes) {
    const handleMap = new Map();

    // 배열을 순회하며 WindowHandle을 키로 사용하여 Map에 저장합니다.
    // 동일한 WindowHandle이 있으면 나중에 들어온 정보로 덮어씌워집니다.
    // (보통 더 상세한 정보인 Enhanced 정보가 남게 됩니다)
    for (const process of processes) {
      if (process && process.WindowHandle) { // 유효한 핸들이 있는 경우에만
        handleMap.set(process.WindowHandle, process);
      }
    }

    // Map의 값들만 추출하여 배열로 반환합니다.
    return Array.from(handleMap.values());
  }

  // 참고: Chrome 테스트를 계속 사용하려면 이 함수는 KeyManager.js로 옮기는 것이 좋습니다.
  // 이 파일에 남겨두려면, KeyManager.js의 generateUniqueWindowHandleForChrome 코드를 여기에 복사해야 합니다.
  // 지금은 기능에 직접적인 영향이 없으므로 일단 그대로 둡니다.
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
      nameHash = ((nameHash << 5) - nameHash) + char;
      nameHash = nameHash & nameHash;
    }
    const sequenceNumber = this.chromeWindowHandleCache.size + 1;
    const uniqueHandle = Math.abs(nameHash) + Math.abs(originalHandle) + (sequenceNumber * 10000);
    this.chromeWindowHandleCache.set(cacheKey, uniqueHandle);
    return uniqueHandle;
  }
}

export default ProcessDetector;