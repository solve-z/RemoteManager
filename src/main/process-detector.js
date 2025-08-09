/**
 * ProcessDetector - Windows 프로세스 감지 모듈
 * 컴퓨터에서 실행 중인 특정 원격 제어 프로그램(ezHelp, TeamViewer)을 찾아내서 그에 대한 상세 정보를 보고하는 것
 * PowerShell과 Windows API를 통한 원격 프로세스 감지
 */

import { spawn } from 'child_process';

/**
 * 프로세스 감지기 클래스
 */
class ProcessDetector {
  /**
   * 원격 프로세스 감지 (EnumWindows API 기반)
   * @returns {Promise<Array>} 원격 프로세스 배열
   */
  static async detectRemoteProcesses() {
    return new Promise((resolve, reject) => {
      const powerShellScript = `
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        
        # 기존 방식 (호환성 유지)
        $standardProcesses = Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
            ForEach-Object {
                @{
                    ProcessName = $_.ProcessName
                    MainWindowTitle = $_.MainWindowTitle
                    Id = $_.Id
                    WindowHandle = [int64]$_.MainWindowHandle
                    IsMinimized = $false
                    IsVisible = $true
                    DetectionMethod = "Standard"
                }
            }
        
        # Windows API 함수 정의 (최소화 창 감지용)
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        using System.Collections.Generic;
        
        public class WindowEnumerator {
            [DllImport("user32.dll")]
            public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
            
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
            
            [DllImport("user32.dll")]
            public static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
            
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            
            public static List<WindowInfo> GetAllWindows() {
                var windows = new List<WindowInfo>();
                EnumWindows((hWnd, lParam) => {
                    try {
                        uint processId;
                        GetWindowThreadProcessId(hWnd, out processId);
                        
                        var title = new StringBuilder(256);
                        GetWindowText(hWnd, title, title.Capacity);
                        
                        bool isMinimized = IsIconic(hWnd);
                        bool isVisible = IsWindowVisible(hWnd);
                        
                        windows.Add(new WindowInfo {
                            Handle = hWnd,
                            ProcessId = processId,
                            Title = title.ToString(),
                            IsMinimized = isMinimized,
                            IsVisible = isVisible
                        });
                    } catch { }
                    return true;
                }, IntPtr.Zero);
                return windows;
            }
        }
        
        public class WindowInfo {
            public IntPtr Handle { get; set; }
            public uint ProcessId { get; set; }
            public string Title { get; set; }
            public bool IsMinimized { get; set; }
            public bool IsVisible { get; set; }
        }
"@
        
        # 고급 창 감지 (최소화된 창 + TeamViewer 다중 세션)
        $allWindows = [WindowEnumerator]::GetAllWindows()
        $enhancedProcesses = @()
        
        foreach ($window in $allWindows) {
            if ($window.Title -ne "") {
                try {
                    $process = Get-Process -Id $window.ProcessId -ErrorAction SilentlyContinue
                    if ($process) {
                        $shouldInclude = $false
                        $reason = ""
                        
                        # 1. 최소화된 창 감지
                        if ($window.IsMinimized) {
                            $shouldInclude = $true
                            $reason = "Minimized"
                        }
                        
                        # 2. TeamViewer 다중 세션 감지 (실제 + 브라우저 테스트)
                        if (($process.ProcessName -eq "TeamViewer" -and $window.Title -match "^(.+) - TeamViewer$") -or
                            (($process.ProcessName -eq "chrome" -or $process.ProcessName -eq "msedge" -or $process.ProcessName -eq "firefox") -and 
                             $window.Title -match "^(.+) - TeamViewer")) {
                            $shouldInclude = $true
                            $reason = "TeamViewer Multi-Session"
                        }
                        
                        # 3. Chrome 브라우저 테스트 지원 (ezHelp)
                        if (($process.ProcessName -eq "chrome" -or $process.ProcessName -eq "msedge" -or $process.ProcessName -eq "firefox") -and 
                            ($window.Title -match "원격지 IP" -or $window.Title -match "Relay")) {
                            $shouldInclude = $true
                            $reason = "Chrome ezHelp Test"
                        }
                        
                        if ($shouldInclude) {
                            # 기존 표준 프로세스와 중복되지 않는지 확인
                            $isDuplicate = $standardProcesses | Where-Object {
                                $_.Id -eq $process.Id -and $_.MainWindowTitle -eq $window.Title
                            } | Measure-Object | Select-Object -ExpandProperty Count
                            
                            if ($isDuplicate -eq 0) {
                                $enhancedProcesses += @{
                                    ProcessName = $process.ProcessName
                                    MainWindowTitle = $window.Title
                                    Id = $process.Id
                                    WindowHandle = [int64]$window.Handle
                                    IsMinimized = $window.IsMinimized
                                    IsVisible = $window.IsVisible
                                    DetectionMethod = "Enhanced"
                                    DetectionReason = $reason
                                }
                            }
                        }
                    }
                } catch {
                    # 프로세스 접근 오류 무시
                }
            }
        }
        
        # 결과 합치기
        $allProcesses = $standardProcesses + $enhancedProcesses
        $allProcesses | ConvertTo-Json
      `;
      
      try {
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
          if (code === 0) {
            try {
              if (!output.trim()) {
                resolve([]);
                return;
              }
              
              const processes = JSON.parse(output);
              const realProcesses = Array.isArray(processes) ? processes : [processes];
              
              // 원격 프로세스 필터링 및 파싱
              const remoteProcesses = this.filterAndParseRemoteProcesses(realProcesses);
              resolve(remoteProcesses);
            } catch (parseError) {
              console.error('JSON 파싱 오류:', parseError);
              console.error('Raw output:', output);
              resolve([]);
            }
          } else {
            console.error('PowerShell 실행 오류:', error);
            reject(new Error(`프로세스 감지 중 오류가 발생했습니다: ${error}`));
          }
        });
      } catch (error) {
        console.error('프로세스 감지 실패:', error);
        reject(new Error(`프로세스 감지 중 오류가 발생했습니다: ${error.message}`));
      }
    });
  }


  /**
   * 원격 프로세스 필터링 및 파싱
   * @param {Array} processes - 전체 프로세스 배열
   * @returns {Array} 필터링된 원격 프로세스 배열
   */
  static filterAndParseRemoteProcesses(processes) {
    const remoteProcesses = [];

    for (const process of processes) {
      if (this.isRemoteProcess(process)) {
        const parsedProcess = this.parseProcessInfo(process);
        if (parsedProcess) {
          remoteProcesses.push(parsedProcess);
        }
      }
    }

    // WindowHandle 기반 중복 제거 (TeamViewer 다중세션 지원)
    return this.removeDuplicatesByHandle(remoteProcesses);
  }

  /**
   * 원격 프로세스 여부 판별
   * @param {Object} process - 프로세스 정보
   * @returns {boolean} 원격 프로세스 여부
   */
  static isRemoteProcess(process) {
    const name = process.ProcessName?.toLowerCase() || '';
    const title = process.MainWindowTitle || '';

    // ezHelp 원격 세션 (ezHelpManager 제외)
    if (name === 'ezhelpviewer' && (title.includes('원격지') || title.includes('Relay'))) {
      return true;
    }

    // TeamViewer 원격 세션 (단순 TeamViewer 제외)
    if (name === 'teamviewer' && /.+ - teamviewer$/i.test(title)) {
      return true;
    }

    // 브라우저 테스트: Chrome에서 ezHelp 시뮬레이션
    if (name === 'chrome' && (title.includes('원격지 IP') || title.includes('Relay'))) {
      return true;
    }

    // 브라우저 테스트: Chrome에서 TeamViewer 시뮬레이션
    if (name === 'chrome' && /.+ - TeamViewer - Chrome$/i.test(title)) {
      return true;
    }

    return false;
  }

  /**
   * 프로세스 정보 파싱
   * @param {Object} rawProcess - 원시 프로세스 정보
   * @returns {Object|null} 파싱된 프로세스 정보
   */
  static parseProcessInfo(rawProcess) {
    try {
      const processName = rawProcess.ProcessName;
      const windowTitle = rawProcess.MainWindowTitle;
      const pid = rawProcess.Id;
      const windowHandle = rawProcess.WindowHandle;
      const isMinimized = rawProcess.IsMinimized;
      const isVisible = rawProcess.IsVisible;

      if (processName.toLowerCase() === 'ezhelpviewer') {
        return this.parseEzHelpProcess({
          processName,
          windowTitle,
          pid,
          windowHandle,
          isMinimized,
          isVisible,
        });
      } else if (processName.toLowerCase() === 'teamviewer') {
        return this.parseTeamViewerProcess({
          processName,
          windowTitle,
          pid,
          windowHandle,
          isMinimized,
          isVisible,
        });
      } else if (processName.toLowerCase() === 'chrome') {
        // Chrome 브라우저 테스트 지원
        if (windowTitle.includes('원격지 IP') || windowTitle.includes('Relay')) {
          return this.parseEzHelpProcess({
            processName: 'ezHelpViewer', // 실제 프로세스명으로 변환
            windowTitle,
            pid,
            windowHandle,
            isMinimized,
            isVisible,
          });
        } else if (/\w+ - TeamViewer - Chrome$/i.test(windowTitle)) {
          // Chrome 테스트: 창 제목 기반으로 고유한 WindowHandle 생성
          const cleanTitle = windowTitle.replace(' - Chrome', '');
          const uniqueWindowHandle = this.generateUniqueWindowHandleForChrome(cleanTitle, windowHandle);
          
          return this.parseTeamViewerProcess({
            processName: 'TeamViewer', // 실제 프로세스명으로 변환
            windowTitle: cleanTitle, // Chrome 부분 제거
            pid,
            windowHandle: uniqueWindowHandle, // 고유한 WindowHandle 사용
            isMinimized,
            isVisible,
          });
        }
      }

      return null;
    } catch (error) {
      console.error('프로세스 파싱 오류:', error);
      return null;
    }
  }

  /**
   * ezHelp 프로세스 파싱
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 파싱된 ezHelp 프로세스
   */
  static parseEzHelpProcess(processInfo) {
    const { windowTitle, pid, windowHandle, isMinimized, isVisible } = processInfo;
    
    // IP 주소 추출
    const ipMatch = windowTitle.match(/원격지 IP : ([\d.]+)/);
    const ipAddress = ipMatch ? ipMatch[1] : null;

    // 컴퓨터명 추출 (잠김, 녹화중 등의 상태 정보 고려)
    let computerName = null;
    
    // 예시: "ezHelp - dentweb-svr 잠김(Relay) - 원격지 IP : ..."
    // 예시: "ezHelp - dentweb-svr(Relay) - 원격지 IP : ... (화면 녹화 중입니다.)"
    
    // 패턴 1: "ezHelp - 컴퓨터명 잠김(Relay)" 형태
    let computerMatch = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\s+잠김\(/);
    if (computerMatch) {
      computerName = computerMatch[1].trim();
    } else {
      // 패턴 2: "ezHelp - 컴퓨터명(Relay)" 형태 (정상)
      computerMatch = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\(/);
      if (computerMatch) {
        computerName = computerMatch[1].trim();
      } else {
        // 기존 방식 (호환성 유지)
        const fallbackMatch = windowTitle.match(/ezHelp - ([^(]+)/);
        computerName = fallbackMatch ? fallbackMatch[1].trim() : null;
      }
    }

    // 상담원 번호 추출
    const counselorMatch = windowTitle.match(/상담원\((\d+)\)/);
    const counselorId = counselorMatch ? counselorMatch[1] : null;

    if (!computerName || !ipAddress) {
      return null;
    }

    return {
      id: `ezhelp_${windowHandle}_${pid}`,
      pid: pid,
      processName: 'ezHelpViewer',
      windowTitle: windowTitle,
      windowHandle: windowHandle,
      type: 'ezhelp',
      computerName: computerName,
      ipAddress: ipAddress,
      counselorId: counselorId,
      status: 'connected',
      isMinimized: isMinimized,
      isHidden: !isVisible,
      createdAt: new Date(),
      lastSeen: new Date(),
    };
  }

  /**
   * TeamViewer 프로세스 파싱
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 파싱된 TeamViewer 프로세스
   */
  static parseTeamViewerProcess(processInfo) {
    const { windowTitle, pid, windowHandle, isMinimized, isVisible } = processInfo;
    
    // 컴퓨터명 추출 (예: "YSCENTER1_01 - TeamViewer")
    const computerMatch = windowTitle.match(/^(.+) - TeamViewer$/);
    const computerName = computerMatch ? computerMatch[1].trim() : null;

    if (!computerName) {
      return null;
    }

    return {
      id: `teamviewer_${windowHandle}_${pid}`,
      pid: pid,
      processName: 'TeamViewer',
      windowTitle: windowTitle,
      windowHandle: windowHandle,
      type: 'teamviewer',
      computerName: computerName,
      status: 'connected',
      isMinimized: isMinimized,
      isHidden: !isVisible,
      createdAt: new Date(),
      lastSeen: new Date(),
    };
  }

  /**
   * WindowHandle 기반 중복 제거
   * @param {Array} processes - 프로세스 배열
   * @returns {Array} 중복 제거된 프로세스 배열
   */
  static removeDuplicatesByHandle(processes) {
    const handleMap = new Map();
    
    for (const process of processes) {
      const handle = process.windowHandle;
      if (!handleMap.has(handle)) {
        handleMap.set(handle, process);
      }
    }
    
    return Array.from(handleMap.values());
  }

  /**
   * Chrome 테스트용 고유 WindowHandle 생성
   * @param {string} windowTitle - 창 제목 (Chrome 제거 후)
   * @param {number} originalHandle - 원본 Chrome WindowHandle
   * @returns {number} 고유한 WindowHandle
   */
  static generateUniqueWindowHandleForChrome(windowTitle, originalHandle) {
    // WindowHandle 맵 캐시 (창별로 고정된 값 유지)
    if (!this.chromeWindowHandleCache) {
      this.chromeWindowHandleCache = new Map();
    }
    
    // 창 제목을 기반으로 고유 식별자 생성
    const cacheKey = windowTitle + '_' + originalHandle;
    
    // 이미 생성된 WindowHandle이 있으면 재사용
    if (this.chromeWindowHandleCache.has(cacheKey)) {
      const cachedHandle = this.chromeWindowHandleCache.get(cacheKey);
      console.log('🔄 Chrome 캐시된 WindowHandle 재사용:', {
        windowTitle: windowTitle,
        cacheKey: cacheKey,
        cachedHandle: cachedHandle
      });
      return cachedHandle;
    }
    
    // 새로운 고유 WindowHandle 생성
    const computerName = windowTitle.replace(' - TeamViewer', '');
    let nameHash = 0;
    for (let i = 0; i < computerName.length; i++) {
      const char = computerName.charCodeAt(i);
      nameHash = ((nameHash << 5) - nameHash) + char;
      nameHash = nameHash & nameHash;
    }
    
    // 현재 캐시 크기를 기반으로 순차적 번호 추가 (같은 이름이라도 다른 WindowHandle)
    const sequenceNumber = this.chromeWindowHandleCache.size + 1;
    const uniqueHandle = Math.abs(nameHash) + Math.abs(originalHandle) + (sequenceNumber * 10000);
    
    // 캐시에 저장
    this.chromeWindowHandleCache.set(cacheKey, uniqueHandle);
    
    console.log('🧪 Chrome 새 WindowHandle 생성 및 캐시:', {
      windowTitle: windowTitle,
      computerName: computerName,
      cacheKey: cacheKey,
      originalHandle: originalHandle,
      sequenceNumber: sequenceNumber,
      uniqueHandle: uniqueHandle,
      cacheSize: this.chromeWindowHandleCache.size
    });
    
    return uniqueHandle;
  }
}

export default ProcessDetector;