# RemoteManager v4.0 재설계 기획서

> 현재 프로젝트의 문제점들을 분석하고 처음부터 다시 설계하는 종합적인 개선 계획

## 📊 현재 프로젝트 문제점 분석

### 🔥 심각한 문제들
1. **renderer.js 1991 라인의 스파게티 코드**: 모든 기능이 한 파일에 집중
2. **3가지 키 관리 시스템 혼재**: `getSettingsKey`, `getProcessKey`, `deriveSettingsKeyFromHistory`
3. **데이터 관리 혼란**: localStorage + 메모리 혼용으로 동기화 문제
4. **디버깅 지옥**: 키 불일치, 설정 유실, 상태 불일치 등 예측 불가능한 버그들
5. **성능 이슈**: 전체 DOM 재렌더링, PowerShell 남발, 메모리 누수

### 💡 개선 방향
- **모듈화**: 기능별 파일 분리 및 컴포넌트화
- **단일 진실의 원천**: 통합된 데이터 스토어와 키 관리
- **순수 자바스크립트**: 빌드 과정 없이 바로 실행 가능한 구조
- **테스트 친화적**: 단위 테스트 가능한 순수 함수 중심 설계
- **사용자 중심**: 복잡성을 숨기고 직관적인 UI/UX 제공

---

## 🏗️ 새로운 아키텍처 설계

### 1. 파일 구조 (모듈화)

```
RemoteManager-v4/
├── src/
│   ├── main/                    # Electron 메인 프로세스
│   │   ├── main.js             # 메인 엔트리포인트
│   │   ├── process-detector.js  # 프로세스 감지 (PowerShell/WinAPI)
│   │   └── window-manager.js   # 창 관리 (포커스, 최소화 등)
│   │
│   ├── renderer/               # 렌더러 프로세스
│   │   ├── index.html          # UI 레이아웃 (기존 유지)
│   │   ├── index.js            # 메인 엔트리포인트
│   │   │
│   │   ├── components/         # UI 컴포넌트들
│   │   │   ├── ProcessList.js  # 프로세스 목록 렌더링
│   │   │   ├── GroupManager.js # 그룹 관리 UI
│   │   │   ├── Sidebar.js      # 사이드바 네비게이션
│   │   │   └── StatusBar.js    # 상태표시줄
│   │   │
│   │   ├── store/              # 상태 관리
│   │   │   ├── ProcessStore.js # 프로세스 데이터 스토어
│   │   │   ├── GroupStore.js   # 그룹 데이터 스토어
│   │   │   └── SettingsStore.js# 설정 데이터 스토어
│   │   │
│   │   ├── services/           # 비즈니스 로직
│   │   │   ├── ProcessService.js   # 프로세스 관련 로직
│   │   │   ├── GroupService.js     # 그룹 관련 로직
│   │   │   ├── KeyManager.js       # 통합 키 관리
│   │   │   └── NotificationService.js # 알림 서비스
│   │   │
│   │   └── utils/              # 유틸리티
│   │       ├── constants.js    # 상수 정의
│   │       └── helpers.js      # 헬퍼 함수들
│   │
│   └── styles/                 # 스타일시트
│       ├── main.css           # 기존 style.css 기반
│       ├── components.css     # 컴포넌트별 스타일
│       └── themes.css         # 테마 및 색상 시스템
│
├── tests/                     # 테스트 코드
│   ├── unit/                  # 단위 테스트
│   ├── integration/           # 통합 테스트
│   └── e2e/                   # E2E 테스트
│
├── docs/                      # 문서
│   ├── ARCHITECTURE.md        # 아키텍처 문서
│   ├── API.md                 # API 문서
│   └── TROUBLESHOOTING.md     # 문제 해결 가이드
│
└── config/                    # 설정 파일들
    └── jest.config.js         # 테스트 설정
```

### 2. 핵심 데이터 모델 설계

```powerShell

# 아래는 실제 내가 뽑고싶어하는 데이터들의 예시야 
# 단, "MainWindowTitle":  "TeamViewer" , "MainWindowTitle":  "ezHelpManager Ver. 2.0.6.0" 는 원격관리창이기때문에 필요없는 정보

        Get-Process | 
        Where-Object {$_.MainWindowTitle -ne ""} | 
        Select-Object ProcessName, MainWindowTitle | 
        ConvertTo-Json
    
    # 아래 결과
    [
      {
        "ProcessName":  "ezHelpManager",
        "MainWindowTitle":  "ezHelpManager Ver. 2.0.6.0"
      },
      {
        "ProcessName":  "ezHelpViewer",
        "MainWindowTitle":  "ezHelp - desktop-6bcogpv(Relay) - 원격지 IP : 192.168.0.18(121.164.168.194) - 원격제어 경과시간 : 00:00:04 - 상담원(46)"
      },
      {
        "ProcessName":  "TeamViewer",
        "MainWindowTitle":  "YSCENTER1_01 - TeamViewer"
      },
      {
        "ProcessName":  "TeamViewer",
        "MainWindowTitle":  "TeamViewer"
    } ,
    ]
```


#### 2.1 Process 객체 (단일 진실의 원천)
```javascript
/**
 * RemoteProcess 객체 구조
 * @typedef {Object} RemoteProcess
 * @property {string} id - 통합 고유 ID (UUID)
 * @property {number} pid - 현재 PID
 * @property {string} processName - 프로세스명 (ezHelpViewer, TeamViewer)
 * @property {string} windowTitle - 창 제목
 * @property {'ezhelp'|'teamviewer'} type - 프로세스 타입
 * @property {string} computerName - 컴퓨터명 (핵심 식별자)
 * @property {string} [ipAddress] - IP 주소 (ezHelp만)
 * @property {string} [windowHandle] - 창 핸들 (TeamViewer 다중세션용)
 * @property {'connected'|'disconnected'|'reconnected'} status - 상태 정보
 * @property {boolean} isMinimized - 최소화 여부
 * @property {boolean} isHidden - 숨김 여부
 * @property {Date} createdAt - 최초 감지 시간
 * @property {Date} lastSeen - 마지막 확인 시간
 * @property {Date} [disconnectedAt] - 연결 끊어진 시간
 * @property {string} [customLabel] - 사용자 정의 라벨
 * @property {ProcessCategory} [category] - 카테고리 할당
 * @property {string} [groupId] - 그룹 ID
 */

/**
 * ProcessGroup 객체 구조
 * @typedef {Object} ProcessGroup
 * @property {string} id - UUID
 * @property {string} name - 그룹명
 * @property {string[]} processIds - Process.id 배열
 * @property {Date} createdAt - 생성 시간
 * @property {string} [color] - 그룹 색상
 */


/**
 * @typedef {'xray'|'old-server'|'new-server'|'other-server'} ProcessCategory

const CATEGORIES = {
    'xray': { name: '엑스레이', color: '#e3f2fd', borderColor: '#2196f3' },
    'other-server': { name: '타서버', color: '#fff3e0', borderColor: '#ff9800' },
    'new-server': { name: '새서버', color: '#f3e5f5', borderColor: '#9c27b0' },
    'old-server': { name: '구서버', color: '#fce4ec', borderColor: '#e91e63' }
};

 */
```

#### 2.2 통합 키 관리 시스템
```javascript
class KeyManager {
  /**
   * 프로세스의 고유 ID 생성 (UUID 기반)
   * - 한 번 생성되면 변하지 않음
   * - 모든 설정의 키로 사용
   * @returns {string}
   */
  static generateProcessId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 프로세스 매칭 키 생성 (재연결 감지용)
   * - 컴퓨터명 기반으로 동일한 원격지 인식 / 근데 만약 다른 치과 원격지에서 컴퓨터명이 같으면 프로세스가 다름  
   * @param {Object} process - 프로세스 정보
   * @returns {string}
   */
  static getMatchingKey(process) {
    if (process.type === 'ezhelp') {
      return `ezhelp_${process.computerName}`;
    } else {
      return `teamviewer_${process.computerName}`;
    }
  }
  
  /**
   * 디스플레이 키 생성 (UI 표시용)
   * @param {RemoteProcess} process - 프로세스 객체
   * @returns {string}
   */
  static getDisplayKey(process) {
    if (process.type === 'ezhelp') {
      return `${process.computerName}[${process.ipAddress}]`;
    } else {
      return `[${process.computerName}] TeamViewer`;
    }
  }
}
```

### 3. 상태 관리 시스템 (Store Pattern)

#### 3.1 ProcessStore (중앙 집중식 상태 관리)
```javascript
class ProcessStore {
  constructor() {
    this.processes = new Map();
    this.listeners = new Set();
  }
  
  /**
   * 프로세스 추가/업데이트
   * - 기존 프로세스가 있으면 상태 업데이트
   * - 새 프로세스면 새로 추가
   * @param {Object} processInfo - 프로세스 정보
   */
  updateProcess(processInfo) {
    const matchingKey = KeyManager.getMatchingKey(processInfo);
    const existingProcess = this.findByMatchingKey(matchingKey);
    
    if (existingProcess) {
      // 기존 프로세스 업데이트 (재연결)
      this.updateExistingProcess(existingProcess, processInfo);
    } else {
      // 새 프로세스 추가
      this.addNewProcess(processInfo);
    }
    
    this.notifyListeners();
  }
  
  /**
   * 연결 끊어진 프로세스 표시
   * @param {string} processId - 프로세스 ID
   */
  markAsDisconnected(processId) {
    const process = this.processes.get(processId);
    if (process) {
      process.status = 'disconnected';
      process.disconnectedAt = new Date();
      this.notifyListeners();
    }
  }
  
  /**
   * 오래된 프로세스 자동 정리
   */
  cleanupOldProcesses() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    for (const [id, process] of this.processes) {
      // 그룹에 속하지 않고, 1분 이상 끊어진 프로세스만 삭제
      if (!process.groupId && 
          process.status === 'disconnected' && 
          process.disconnectedAt && 
          process.disconnectedAt.getTime() < fiveMinutesAgo) {
        this.processes.delete(id);
      }
    }
    
    this.notifyListeners();
  }
  
  /**
   * 리스너 등록
   * @param {Function} listener - 상태 변경 리스너
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * 모든 리스너에게 변경 알림
   */
  notifyListeners() {
    const processes = Array.from(this.processes.values());
    this.listeners.forEach(listener => listener(processes));
  }
}
```

#### 3.2 GroupStore (그룹 관리)
```javascript
class GroupStore {
  constructor() {
    this.groups = new Map();
    this.load();
  }
  
  /**
   * 그룹 생성
   * 단, 그룹 생성 시 중복된 이름으로 그룹 생성 불가 
   * 원격 프로세스 하나에 그룹 하나만 지정가능 
   * @param {string} name - 그룹명
   * @returns {ProcessGroup}
   */
  createGroup(name) {
    const group = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      processIds: [],
      createdAt: new Date()
    };
    
    this.groups.set(group.id, group);
    this.save();
    return group;
  }
  
  /**
   * 프로세스를 그룹에 할당
   * @param {string} processId - 프로세스 ID
   * @param {string|null} groupId - 그룹 ID (null이면 그룹 해제)
   */
  assignProcessToGroup(processId, groupId) {
    // 모든 그룹에서 해당 프로세스 제거
    for (const group of this.groups.values()) {
      const index = group.processIds.indexOf(processId);
      if (index > -1) {
        group.processIds.splice(index, 1);
      }
    }
    
    // 새 그룹에 추가 (null이면 그룹 해제)
    if (groupId && this.groups.has(groupId)) {
      this.groups.get(groupId).processIds.push(processId);
    }
    
    this.save();
  }
  
  /**
   * localStorage에서 로드
   */
  load() {
    try {
      const data = localStorage.getItem('processGroups_v4');
      if (data) {
        const groupsArray = JSON.parse(data);
        this.groups = new Map(groupsArray.map(group => [group.id, group]));
      }
    } catch (error) {
      console.error('그룹 데이터 로드 실패:', error);
    }
  }
  
  /**
   * localStorage에 저장
   */
  save() {
    try {
      const groupsData = Array.from(this.groups.values());
      localStorage.setItem('processGroups_v4', JSON.stringify(groupsData));
    } catch (error) {
      console.error('그룹 데이터 저장 실패:', error);
    }
  }
}
```

### 4. 컴포넌트 기반 UI 시스템

#### 4.1 ProcessList 컴포넌트
```javascript
class ProcessList {
  constructor(container) {
    this.container = container;
    this.processes = [];
    this.bindEvents();
  }
  
  /**
   * 프로세스 목록 렌더링 (가상 스크롤링 지원)
   * @param {RemoteProcess[]} processes - 프로세스 배열
   */
  render(processes) {
    this.processes = processes;
    
    // 가상 스크롤링으로 성능 최적화
    const visibleProcesses = this.getVisibleProcesses();
    
    this.container.innerHTML = visibleProcesses
      .map(process => this.renderProcessItem(process))
      .join('');
      
    this.attachEventListeners();
  }
  
  /**
   * 개별 프로세스 아이템 렌더링
   * @param {RemoteProcess} process - 프로세스 객체
   * @returns {string}
   */
  renderProcessItem(process) {
    const displayName = process.customLabel || KeyManager.getDisplayKey(process);
    const statusIcon = this.getStatusIcon(process.status);
    const categoryClass = process.category ? `category-${process.category}` : '';
    
    return `
      <div class="process-item ${categoryClass}" data-process-id="${process.id}">
        <div class="process-header">
          <span class="status-icon">${statusIcon}</span>
          <span class="process-name">${displayName}</span>
          ${process.groupId ? `<span class="group-badge">${this.getGroupName(process.groupId)}</span>` : ''}
        </div>
        <div class="process-actions">
          <button class="btn-copy" data-action="copy">📋 복사</button>
          <button class="btn-focus" data-action="focus">🎯 포커스</button>
          <button class="btn-edit" data-action="edit">✏️ 편집</button>
          ${process.status === 'disconnected' ? '<button class="btn-remove" data-action="remove">🗑️ 제거</button>' : ''}
        </div>
      </div>
    `;
  }
  
#### 프로세스 이름 표시 형태 (간소화됨)
- **ezHelp**: `(46) desktop-6bcogpv[192.168.0.18]`
- **TeamViewer**: `[YSCENTER1_01] TeamViewer`

#### 복사 형태
- **ezHelp**: `192.168.0.18[desktop-6bcogpv]`
- **TeamViewer**: `[YSCENTER1_01]`


  /**
   * 상태 아이콘 반환
   * @param {string} status - 프로세스 상태
   * @returns {string}
   */
  getStatusIcon(status) {
    switch (status) {
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'reconnected': return '🟡';
      default: return '⚪';
    }
  }
  
  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    this.container.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-action')) {
        const processId = e.target.closest('.process-item').dataset.processId;
        const action = e.target.dataset.action;
        this.handleAction(processId, action);
      }
    });
  }
}
```

### 5. 서비스 레이어 (비즈니스 로직 분리)

#### 5.1 ProcessService
```javascript
class ProcessService {
  constructor(processStore, notificationService) {
    this.processStore = processStore;
    this.notificationService = notificationService;
  }
  
  /**
   * PowerShell에서 프로세스 목록 가져오기
   */
  async loadProcesses() {
    try {
      const rawProcesses = await this.invokeProcessDetection();
      const remoteProcesses = this.filterRemoteProcesses(rawProcesses);
      
      // 현재 프로세스 목록 업데이트
      this.updateProcessStatuses(remoteProcesses);
      
      // 끊어진 프로세스 감지
      this.detectDisconnectedProcesses(remoteProcesses);
      
    } catch (error) {
      this.notificationService.showError('프로세스 감지 실패', error.message);
    }
  }
}

 /**
   * 🚨 목록가져오기 Known Issues & Solutions
   */
### **PowerShell Get-Process 한계 문제**

#### **문제 상황**
1. **최소화된 창 미감지**
   - Get-Process의 MainWindowTitle은 가시적인 창만 인식
   - 조건: `MainWindowHandle != 0`, `IsWindowVisible == true`, `WindowState != Minimized`
   - ezHelp 창 최소화 시 프로세스 목록에서 사라짐

2. **TeamViewer 다중 세션 문제**  
   - 단일 프로세스로 다중 세션 관리
   - Get-Process는 마지막 열린 창의 타이틀만 표시
   - 각 세션을 개별적으로 인식 불가

#### **🎯 해결 방안: Windows API 기반 창 열거**

**선택된 방법: EnumWindows + 창 상태 검사**

```powershell
# PowerShell 구현 방식
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnumerator {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
"@```

**장점:**
- ✅ 최소화된 창도 감지 가능
- ✅ TeamViewer 다중 세션 모두 인식  
- ✅ ezHelp 숨겨진 창도 찾기 가능
- ✅ 완전한 창 정보 수집

**구현 전략:**
1. **기존 Get-Process와 병행 사용**
   - 1차 필터링: Get-Process (빠른 검색)
   - 2차 정밀검사: EnumWindows (완전한 검색)

2. **창 상태별 처리**
   - 활성 창: 기존 방식으로 감지
   - 최소화 창: EnumWindows로 보완
   - 숨겨진 창: IsWindowVisible 체크

3. **TeamViewer 특별 처리**
   - 단일 프로세스의 다중 창 구분
   - 창 제목으로 각 세션 식별



  
  /**
   * 프로세스 상태 업데이트 (단순화)
   * @param {Object[]} currentProcesses - 현재 프로세스 목록
   */
  updateProcessStatuses(currentProcesses) {
    const currentIds = new Set();
    
    // 현재 프로세스들 처리
    for (const processInfo of currentProcesses) {
      const process = this.processStore.updateProcess(processInfo);
      currentIds.add(process.id);
    }
    
    // 사라진 프로세스들을 끊어진 상태로 표시
    this.processStore.markMissingAsDisconnected(currentIds);
  }
  
  /**
   * 원격 프로세스 필터링 (단순화)
   * @param {Object[]} processes - 전체 프로세스 목록
   * @returns {Object[]}
   */
  filterRemoteProcesses(processes) {
    return processes
      .filter(p => this.isRemoteProcess(p))
      .map(p => this.parseProcessInfo(p));
  }
  
  /**
   * 원격 프로세스 판별
   * @param {Object} process - 프로세스 정보
   * @returns {boolean}
   */
  isRemoteProcess(process) {
    const name = process.ProcessName.toLowerCase();
    const title = process.MainWindowTitle.toLowerCase();
    
    // ezHelp 원격 세션
    if (name === 'ezhelpviewer' && (title.includes('원격지') || title.includes('relay'))) {
      return true;
    }
    
    // TeamViewer 원격 세션
    if (name === 'teamviewer' && /\w+ - teamviewer$/i.test(process.MainWindowTitle)) {
      return true;
    }
    
    return false;
  }
}
```

### 6. 에러 처리 및 로깅 시스템

#### 6.1 통합 에러 처리
```javascript
class ErrorHandler {
  /**
   * 에러 처리
   * @param {Error} error - 에러 객체
   * @param {string} context - 컨텍스트
   */
  static handle(error, context) {
    console.error(`[${context}] ${error.message}`, error);
    
    // 사용자에게 친화적인 메시지 표시
    const userMessage = this.getUserFriendlyMessage(error, context);
    NotificationService.showError(userMessage);
    
    // 선택적으로 에러 리포팅 서비스에 전송
    this.reportError(error, context);
  }
  
  /**
   * 사용자 친화적 메시지 생성
   * @param {Error} error - 에러 객체
   * @param {string} context - 컨텍스트
   * @returns {string}
   */
  static getUserFriendlyMessage(error, context) {
    switch (context) {
      case 'process-detection':
        return '프로세스를 감지하는 중 문제가 발생했습니다. 관리자 권한으로 실행해주세요.';
      case 'window-focus':
        return '창을 포커스하는 중 문제가 발생했습니다. 해당 프로그램이 실행 중인지 확인해주세요.';
      default:
        return '예상치 못한 오류가 발생했습니다. 앱을 재시작해주세요.';
    }
  }
}
```

#### 6.2 로깅 시스템
```javascript
class Logger {
  /**
   * 디버그 로그
   * @param {string} message - 메시지
   * @param {*} data - 추가 데이터
   */
  static debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
  
  /**
   * 정보 로그
   * @param {string} message - 메시지
   * @param {*} data - 추가 데이터
   */
  static info(message, data) {
    console.log(`[INFO] ${message}`, data);
  }
  
  /**
   * 경고 로그
   * @param {string} message - 메시지
   * @param {*} data - 추가 데이터
   */
  static warn(message, data) {
    console.warn(`[WARN] ${message}`, data);
  }
  
  /**
   * 에러 로그
   * @param {string} message - 메시지
   * @param {Error} error - 에러 객체
   */
  static error(message, error) {
    console.error(`[ERROR] ${message}`, error);
  }
}


 /**
   * 디버그 로그
   * @param {string} message - 메시지
   * @param {*} data - 추가 데이터
   */
{
  "colors": {
    "primary": "#3b82f6",
    "primaryHover": "#2563eb",
    "background": "#f9fafb",
    "text": "#1f2937",
    "mutedText": "#6b7280",
    "border": "#d1d5db",
    "highlight": "#e0f2fe"
  },
  "font": {
    "family": "Inter, sans-serif",
    "size": "14px",
    "weight": "400"
  },
  "button": {
    "padding": "8px 12px",
    "borderRadius": "6px",
    "background": "#3b82f6",
    "color": "#ffffff",
    "hoverBackground": "#2563eb"
  },
  "input": {
    "padding": "6px 10px",
    "border": "1px solid #d1d5db",
    "borderRadius": "4px",
    "focusBorder": "#3b82f6"
  }
}



```









---

## 🚀 단계별 구현 계획

### Phase 1: 핵심 인프라 구축 (1-2주)
1. **프로젝트 설정**
   - ES6 모듈 시스템 적용
   - 테스트 프레임워크 설정 (Jest)
   - ESLint + Prettier 코드 품질 도구

2. **기본 구조 및 인터페이스 정의**
   - `constants.js`: 상수 및 설정값
   - `KeyManager`: 통합 키 관리 시스템
   - JSDoc 기반 타입 문서화

3. **스토어 시스템 구축**
   - `ProcessStore`: 프로세스 상태 관리
   - `GroupStore`: 그룹 데이터 관리
   - `SettingsStore`: 사용자 설정 관리

### Phase 2: 프로세스 감지 및 기본 UI (2-3주)
1. **프로세스 감지 시스템**
   - PowerShell 연동 개선
   - Windows API 통합 (EnumWindows)
   - 실시간 모니터링 구현

2. **기본 UI 컴포넌트**
   - `ProcessList`: 프로세스 목록 표시
   - `Sidebar`: 네비게이션 (기존 디자인 유지)
   - `StatusBar`: 상태 표시

3. **데이터 바인딩**
   - Store와 UI 컴포넌트 연결
   - 자동 업데이트 시스템

### Phase 3: 그룹 및 카테고리 시스템 (2주)
1. **그룹 관리**
   - `GroupManager`: 그룹 생성/수정/삭제
   - 드래그앤드롭 구현
   - 그룹별 필터링

2. **카테고리 시스템**
   - 카테고리 할당 UI
   - 색상 시스템 적용
   - 카테고리별 필터링

### Phase 4: 고급 기능 및 최적화 (2-3주)
1. **성능 최적화**
   - 가상 스크롤링 구현
   - 메모리 사용량 최적화
   - DOM 조작 최소화

2. **사용자 경험 개선**
   - 키보드 단축키
   - 컨텍스트 메뉴
   - 드래그앤드롭 시각적 피드백

3. **고급 기능**
   - 설정 내보내기/가져오기
   - 다크모드 지원
   - 알림 시스템 개선

### Phase 5: 테스트 및 안정화 (1-2주)
1. **테스트 코드 작성**
   - 단위 테스트 (Jest)
   - 통합 테스트
   - E2E 테스트 (Playwright)

2. **버그 수정 및 최적화**
   - 메모리 누수 확인
   - 성능 프로파일링
   - 사용자 피드백 반영

---

## 🎯 기대 효과

### 1. 개발 경험 개선
- **모듈화**: 기능별로 분리된 작은 파일들로 유지보수성 향상
- **순수 자바스크립트**: 빌드 과정 없이 바로 실행하여 개발 속도 향상
- **테스트 가능성**: 순수 함수 중심으로 단위 테스트 용이
- **디버깅**: 체계적인 로깅과 에러 처리로 문제 해결 시간 단축

### 2. 사용자 경험 개선
- **성능**: 가상 스크롤링과 최적화로 대량 프로세스 처리 가능
- **안정성**: 예측 가능한 동작과 일관된 상태 관리
- **직관성**: 복잡성을 숨기고 핵심 기능에 집중
- **확장성**: 새로운 기능 추가 시 기존 코드에 미치는 영향 최소화

### 3. 코드 품질 개선
- **단일 진실의 원천**: 하나의 통합된 데이터 모델
- **관심사 분리**: UI, 비즈니스 로직, 데이터 관리의 명확한 분리
- **재사용성**: 컴포넌트 기반 설계로 코드 재사용 극대화
- **확장성**: 새로운 원격 프로그램 지원 시 최소한의 코드 변경

---

## 📝 결론

현재의 1991 라인 스파게티 코드를 **모듈화된 순수 자바스크립트 아키텍처**로 재설계하여:

1. **복잡한 키 관리 시스템** → **단일 ID 기반 통합 시스템**
2. **localStorage + 메모리 혼재** → **중앙 집중식 스토어 패턴**
3. **거대한 단일 파일** → **기능별 모듈화된 컴포넌트**
4. **예측 불가능한 버그** → **JSDoc과 테스트로 안정화**

이를 통해 **개발자에게는 유지보수 편의성**을, **사용자에게는 안정적인 경험**을 제공하는 것이 목표입니다.

기존 UI/UX 디자인은 그대로 유지하면서, 내부 구조만 완전히 재설계하여 **겉으로는 같지만 속은 완전히 다른** 새로운 RemoteManager v4.0을 구축할 수 있습니다.



