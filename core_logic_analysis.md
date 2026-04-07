# RemoteManager 핵심 기능 동작 분석 보고서

본 문서는 RemoteManager 프로젝트의 핵심 기능(프로세스 감지, 창 포커스, 특수 프로세스 처리)의 동작 방식과 현재 발생하고 있는 성능 이슈(지연 시간)의 원인을 분석한 내용을 담고 있습니다.

## 1. 핵심 기능 동작 원리

### 1.1 프로세스 감지 (Process Detection)

- **모듈**: `src/main/process-detector.js`
- **동작 방식**:
  1. PowerShell 스크립트를 실행하여 시스템의 모든 창 정보를 수집합니다.
  2. `Get-Process` 명령어로 기본적인 프로세스 목록을 가져옵니다.
  3. Win32 API(`EnumWindows`, `GetWindowText`, `IsIconic` 등)를 C# 코드로 호출하여 최소화되거나 숨겨진 창까지 정밀하게 탐색합니다.
  4. 자바스크립트 단에서 `WindowHandle`을 기준으로 중복을 제거하여 최종 프로세스 리스트를 생성합니다.
- **특징**: `WindowHandle`을 유일한 식별자로 사용하여 다중 세션 및 동일 프로세스 내 여러 창을 구분합니다.

### 1.2 창 포커스 제어 (Window Management & Focus)

- **모듈**: `src/main/window-manager.js`
- **동작 방식**:
  1. 렌더러 프로세스에서 IPC(`focus-window`)를 통해 요청이 들어옵니다.
  2. `WindowManager` 클래스가 PowerShell 스크립트를 생성하여 실행합니다.
  3. PowerShell 내부에서 C# 코드를 동적으로 컴파일(`Add-Type`)하여 Win32 API를 직접 호출합니다.
  4. **포커스 알고리즘**:
     - `AttachThreadInput`: 현재 포그라운드 스레드와 타겟 스레드를 연결하여 포커스 권한을 획득합니다.
     - `ShowWindow(handle, 9)`: 창이 최소화된 경우 복원합니다.
     - `BringWindowToTop`: 창을 최상위로 올립니다.
     - `SetForegroundWindow`: 최종적으로 창에 포커스를 줍니다.
- **특징**: 단순한 포커스 외에도 권한 획득을 위한 스레드 어태치먼트 로직이 포함되어 있습니다.

### 1.3 EzHelp 특수 처리

- **동작 방식**:
  1. 프로세스 타입이 `ezhelp`인 경우, 포커스 시 `ShowEzHelpControlBar` 함수가 추가 호출됩니다.
  2. 해당 프로세스의 모든 창을 `EnumWindows`로 탐색하여 클래스명이 `HiRemoteMenuBar`인 창을 찾습니다.
  3. 해당 창의 스타일에서 `WS_VISIBLE` 비트를 활성화하여 숨겨진 컨트롤바를 강제로 화면에 표시합니다.

---

## 2. 성능 이슈 분석 (0.5~1초 지연)

### 2.1 원인 분석

[상황 및 배경]
Windows 전용 Electron 앱(RemoteManager)의 윈도우 창 관리 및 포커스 모듈을 최적화하려고 해.
현재 `window-manager.js`에서 원격 대상 창을 포커스하기 위해 `child_process.spawn`으로 PowerShell을 띄우고, 내부에서 `Add-Type`을 통해 C# 코드를 동적 컴파일하여 Win32 API를 호출하고 있어.

[문제점]
매 포커스 요청마다 PowerShell 프로세스 생성 및 C# 빌드 오버헤드가 발생하여 0.5초~1초의 지연(Delay) 현상이 발생하고 있어. 이 지연 시간을 0ms에 가깝게 줄여야 해.

[목표]
기존의 무거운 PowerShell + C# 스크립트 방식을 완전히 걷어내고, Node.js에서 C/C++ 네이티브 공유 라이브러리를 직접 호출할 수 있는 `koffi` 모듈을 도입해서 코드를 전면 리팩토링해 줘.

[구현을 위한 핵심 제약 및 요구사항]

1. Win32 API 선언: `koffi.load('user32.dll')` 등을 사용하여 기존 C# 코드에 있던 모든 Win32 API(SetForegroundWindow, ShowWindow, AttachThreadInput, EnumWindows 등)의 원형을 Koffi 문법에 맞게 선언할 것.
2. 타입 처리:
   - Window Handle(HWND, IntPtr)은 자바스크립트에서 Number 대신 안전하게 처리가 가능하도록 포인터나 `BigInt` 등을 활용할 것.
   - `out` 파라미터를 받는 함수(예: GetWindowThreadProcessId)는 `Uint32Array` 등 메모리 배열을 사용하여 값을 올바르게 추출할 것.
   - `GetWindowText`, `GetClassName` 처럼 버퍼(StringBuilder)가 필요한 곳은 `Buffer.alloc()`을 올바르게 사용할 것.
3. EnumWindows 콜백 처리: ezHelp 컨트롤바를 찾기 위한 `EnumWindows` 호출 시, 자바스크립트 화살표 함수를 `koffi.register`와 `koffi.pointer`로 감싸서 C 콜백으로 넘기고, 탐색 종료 후 메모리 누수가 없도록 `unregister` 처리를 고려할 것.
4. 구조 유지: 기존 `WindowManager` 클래스의 정적 메서드 시그니처(`focusWindow`, `focusWindowByHandle`)와 반환 타입(`Promise<boolean>`)은 그대로 유지해서 다른 파일(`main.js`)에 영향을 주지 않도록 할 것.

기존 `window-manager.js`를. 요구사항에 맞춰 Koffi가 적용된 완벽한 교체 코드를 작성해 줘.
