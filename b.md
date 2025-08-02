# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remote Manager MVP - 원격지원 관리 도구

ezHelp, TeamViewer 등 원격지원 프로그램을 사용할 때 다수의 원격지를 효율적으로 관리하고 정보를 추출할 수 있는 Electron 기반 데스크톱 애플리케이션

### 구현 완료된 MVP 기능
1. ✅ **대시보드형 UI**: 왼쪽 네비게이션 + 오른쪽 콘텐츠 영역
2. ✅ **전체/원격 프로세스 조회**: PowerShell을 통해 MainWindowTitle이 있는 프로세스 표시
3. ✅ **원격 프로세스 필터링**: ezHelp/TeamViewer 원격 세션만 정확히 필터링
4. ✅ **정보 추출 및 복사**: 타이틀에서 IP와 컴퓨터명을 추출하여 업무용 형태로 복사
5. ✅ **라벨 편집 기능**: 원격 프로세스 라벨을 사용자 정의로 수정 가능
6. ✅ **드래그앤드롭**: 원격 프로세스 목록의 순서 변경 가능
7. ✅ **반응형 네비게이션**: 화면 크기에 따른 사이드바 동작 (접기/펼치기)
8. ✅ **UTF-8 인코딩**: 한글 프로세스명 정상 표시

### 그룹화 시스템 (v2.0)
9. ✅ **그룹 관리**: 사이드바에서 그룹 추가/수정/삭제
10. ✅ **그룹별 뷰**: 그룹을 클릭하여 해당 그룹의 프로세스만 표시
11. ✅ **프로세스-그룹 할당**: 드롭다운으로 원격 프로세스를 그룹에 직접 할당
12. ✅ **그룹 간 드래그앤드롭**: 원격 프로세스를 그룹 간 이동 가능
13. ✅ **그룹 데이터 영속성**: localStorage에 그룹 정보 저장/로드

### 카테고리 시스템 (v2.1)
14. ✅ **PC 종류별 카테고리**: 엑스레이, 타서버, 새서버, 구서버
15. ✅ **카테고리별 배경색**: 각 카테고리마다 고유한 색상으로 시각적 구분
16. ✅ **카테고리 할당**: 드롭다운으로 원격 프로세스에 카테고리 지정
17. ✅ **그룹 뷰 카테고리 표시**: 그룹 내에서도 카테고리 라벨과 배경색 표시
18. ✅ **카테고리 데이터 영속성**: localStorage에 카테고리 정보 저장/로드

### 정렬 및 필터링 시스템 (v2.2)
19. ✅ **다양한 정렬 옵션**: 기본순서, 이름순, PID순, 그룹순, 카테고리순
20. ✅ **그룹별 필터링**: 특정 그룹의 프로세스만 표시
21. ✅ **카테고리별 필터링**: 특정 카테고리의 프로세스만 표시
22. ✅ **미분류 필터링**: 그룹 없음, 카테고리 없음 필터 제공
23. ✅ **실시간 필터링**: 정렬/필터 변경 시 즉시 반영

### UI/UX 개선사항 (v2.3)
24. ✅ **키보드 단축키**: Ctrl+B, F2로 사이드바 토글
25. ✅ **스낵바 개선**: 클릭으로 즉시 사라짐, 에러는 수동 닫기
26. ✅ **그룹 다이얼로그**: Enter키로 그룹 추가, Escape로 취소
27. ✅ **그룹 뷰 간소화**: 그룹 내에서는 수정/그룹선택 버튼 제거

### 고급 기능 (v2.4)
28. ✅ **윈도우 포커스 기능**: 원격 프로세스의 윈도우를 클릭 한 번으로 포커스
29. ✅ **버튼 레이아웃 개선**: 2줄 구조로 설정/액션 버튼 분리하여 가독성 향상

### 실시간 모니터링 시스템 (v2.5)
30. ✅ **연결 상태 표시**: 프로세스별 실시간 연결 상태 아이콘 (🟢연결/🔴끊김/🟠재연결)
31. ✅ **자동 새로고침**: 5초 간격 실시간 프로세스 모니터링 및 토글 기능
32. ✅ **연결 끊김 감지**: 프로세스 종료 시 즉시 감지 및 상태 표시
33. ✅ **PID 변경 대응**: 재연결 시 PID 변경되어도 설정 자동 이전
34. ✅ **연결 상태 알림**: 연결/끊김/재연결 시 실시간 팝업 알림
35. ✅ **자동 정리**: 끊어진 프로세스 1분 표시 후 5분 후 자동 제거

### 수동 프로세스 관리 시스템 (v3.0)
36. ✅ **수동 프로세스 추가**: 왼쪽 메뉴에서 프로세스 정보를 직접 입력하여 추가
37. ✅ **입력값 검증**: 프로세스명, 윈도우 제목, PID 필수 입력 및 유효성 검사
38. ✅ **중복 PID 체크**: 동일한 PID를 가진 프로세스 추가 방지
39. ✅ **키보드 단축키**: Enter로 추가, Escape로 취소 지원
40. ✅ **더미 데이터 제거**: 테스트용 더미 프로세스 완전 삭제
41. ✅ **그룹 라벨 개선**: 사이드바 활성 색상과 통일, 대괄호 제거

### 고급 창 감지 시스템 (v3.1)
42. ✅ **EnumWindows API 통합**: 모든 창 상태 감지 (최소화/숨김 포함)
43. ✅ **TeamViewer 다중 세션**: 단일 프로세스의 여러 세션 개별 인식
44. ✅ **최소화 창 감지**: IsIconic API로 최소화된 ezHelp/TeamViewer 창도 목록 표시
45. ✅ **창 상태별 표시**: 연결/최소화/숨김 상태 시각적 구분 및 라벨링
46. ✅ **WindowHandle 기반 식별**: 창별 고유 식별자로 정확한 세션 관리
47. ✅ **호환성 유지**: 기존 Get-Process 방식과 병행하여 안정성 보장

### UI/UX 특징

#### 모던 그레이 디자인
- 깔끔한 화이트/그레이 베이스
- 파란색 액센트 (#3b82f6)
- 프로페셔널한 비즈니스 룩앤필

#### 반응형 사이드바
- **데스크톱**: 접기/펼치기 토글 (280px ↔ 70px)
- **모바일**: 슬라이드 오버레이 방식
- 아이콘 + 텍스트 네비게이션

### 현재 동작 방식

#### 원격 프로세스 식별 규칙
- **ezHelp**: `ezHelpViewer`이면서 타이틀에 "원격지 IP" 또는 "Relay" 포함된 경우만
- **TeamViewer**: 타이틀이 "컴퓨터명 - TeamViewer" 패턴인 경우만
- **제외**: `ezHelpManager`, 단순 `TeamViewer` 타이틀은 원격 세션이 아니므로 제외

#### 프로세스 이름 표시 형태 (간소화됨)
- **ezHelp**: `(46) desktop-6bcogpv[192.168.0.18]`
- **TeamViewer**: `[YSCENTER1_01] TeamViewer`

#### 복사 형태
- **ezHelp**: `192.168.0.18[desktop-6bcogpv]`
- **TeamViewer**: `[YSCENTER1_01]`

#### 카테고리별 색상 체계
- **엑스레이**: 파란색 계열 (#e3f2fd 배경, #2196f3 테두리)
- **타서버**: 주황색 계열 (#fff3e0 배경, #ff9800 테두리)
- **새서버**: 보라색 계열 (#f3e5f5 배경, #9c27b0 테두리)
- **구서버**: 핑크색 계열 (#fce4ec 배경, #e91e63 테두리)

## Development Commands

```bash
# 의존성 설치
npm install

# 개발 모드 실행 (DevTools 포함)
npm run dev

# 프로덕션 실행
npm start
```

## Architecture

### 프로젝트 구조
```
RemoteManager/
├── main.js              # Electron 메인 프로세스 (PowerShell 연동)
├── renderer/             # 렌더러 프로세스 (UI)
│   ├── index.html       # 대시보드 HTML + 그룹 관리 다이얼로그
│   ├── style.css        # 모던 스타일 + 카테고리 색상 + 반응형
│   └── renderer.js      # 전체 UI 로직 (1600+ 라인)
│       ├── 프로세스 관리    # 조회, 필터링, 렌더링, 수동 추가
│       ├── 그룹 시스템      # 생성, 수정, 삭제, 할당
│       ├── 카테고리 시스템  # 할당, 색상 적용, 저장
│       ├── 정렬/필터링     # 다중 조건 정렬 및 필터
│       ├── 드래그앤드롭    # 그룹 간 이동, 순서 변경
│       ├── 실시간 모니터링  # 연결 상태 추적, 자동 새로고침
│       └── UI 인터랙션    # 키보드 단축키, 스낵바 등
├── package.json         # 프로젝트 설정
├── .gitignore          # Git 제외 파일
└── CLAUDE.md           # 이 파일
```

### 기술 스택
- **플랫폼**: Electron (크로스플랫폼)
- **언어**: JavaScript (Node.js + 웹 기술)  
- **UI**: HTML/CSS/JavaScript
- **시스템 연동**: PowerShell (Windows 프로세스 조회)

### 핵심 구현

#### PowerShell 연동 (main.js:38-130)
```javascript
// UTF-8 인코딩 설정으로 한글 처리 (더미 데이터 제거됨)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
Select-Object ProcessName, MainWindowTitle, Id | ConvertTo-Json
```

#### 대시보드 UI (index.html)
- 왼쪽 사이드바: 네비게이션 메뉴 + 그룹 섹션 + 프로세스 추가
- 오른쪽 메인: 헤더 + 프로세스 목록
- 다이얼로그: 그룹 관리 + 수동 프로세스 추가
- 반응형 디자인 (768px 브레이크포인트)

#### 원격 프로세스 필터링 (renderer.js:47-78)
```javascript
function filterRemoteProcesses(processes) {
    // ezHelpManager와 단순 TeamViewer 제외
    // 실제 원격 세션만 정확히 필터링
}
```

#### 라벨 편집 시스템 (renderer.js:240-291)
```javascript
function editProcessLabel(processId, currentLabel) {
    // 인라인 편집 모드
    // localStorage에 커스텀 라벨 저장
}
```

#### 드래그앤드롭 (renderer.js:295-405)
```javascript
function initializeDragAndDrop() {
    // 드롭 인디케이터 시각적 피드백
    // 자연스러운 위치 계산
}
```

#### 사이드바 토글 (renderer.js:196-205)
```javascript
function toggleSidebar() {
    // 데스크톱: 접기/펼치기 (collapsed)
    // 모바일: 열기/닫기 (overlay)
}
```

#### 윈도우 포커스 (main.js:132-215, renderer.js:1122-1138)
```javascript
// PowerShell을 통한 Windows API 호출
// SetForegroundWindow, ShowWindow, BringWindowToTop 사용
// 최소화된 창 복원 후 포커스
async function focusWindow(processId) {
    // IPC를 통해 메인 프로세스의 focus-window 핸들러 호출
}
```

#### 실시간 연결 상태 모니터링 (renderer.js:1216-1287)
```javascript
// 프로세스 키 기반 상태 추적
function updateProcessStatus(currentProcesses) {
    // 프로세스 식별키로 연결 상태 추적
    // PID 변경 시 설정 자동 이전
    // 연결/끊김/재연결 상태 감지 및 알림
}
```

#### 자동 새로고침 시스템 (renderer.js:1352-1393)
```javascript
// 5초 간격 자동 모니터링
function startAutoRefresh(intervalSeconds = 5) {
    // 주기적 프로세스 상태 확인
    // 토글 가능한 자동 새로고침
}
```

#### 수동 프로세스 추가 시스템 (renderer.js:1511-1636)
```javascript
// 프로세스 수동 추가 다이얼로그
function showProcessDialog() {
    // 입력 필드 초기화 및 다이얼로그 표시
    // 첫 번째 입력 필드에 포커스
}

function addManualProcess() {
    // 입력값 검증 및 중복 PID 체크
    // 새 프로세스 객체 생성 (manual 플래그 포함)
    // UI 업데이트 및 성공 메시지 표시
}
```

### 핵심 데이터 구조

#### 그룹 데이터 (localStorage: 'processGroups')
```javascript
{
  "group_1234567890": {
    "name": "서버실",
    "processIds": ["1234", "5678"],
    "createdAt": "2025-01-31T..."
  }
}
```

#### 카테고리 데이터 (localStorage: 'processCategories')
```javascript
{
  "1234": "xray",      // 프로세스 ID -> 카테고리 매핑
  "5678": "new-server"
}
```

#### 커스텀 라벨 (localStorage: 'customLabels')
```javascript
{
  "1234": "병원 메인서버",  // 프로세스 ID -> 사용자 라벨
  "5678": "엑스레이 PC"
}
```

#### 프로세스 상태 추적 (메모리: processHistory)
```javascript
{
  "ezhelp_192.168.0.18_desktop-6bcogpv": {
    "status": "connected",        // connected/disconnected/reconnected
    "currentPid": 5678,          // 현재 PID
    "originalPid": 1234,         // 최초 PID  
    "title": "ezHelp - desktop-6bcogpv...",
    "processName": "ezHelpViewer",
    "lastSeen": 1690876543210,   // 마지막 확인 시간
    "disconnectedTime": null     // 끊어진 시간
  }
}
```

## 향후 개선 계획

### 고급 기능
- 프로세스 종료 기능
- ✅ 윈도우 포커스 기능  
- ✅ 수동 프로세스 추가 기능
- 연결/종료 로그 기록
- 자동 새로고침 간격 설정
- 수동 추가 프로세스 편집/삭제 기능

### 성능 최적화
- 가상화 스크롤링 (많은 프로세스 처리)
- 프로세스 변화 감지 및 실시간 업데이트
- 메모리 사용량 최적화

## Notes

- 사용자는 한글로 답변을 원함
- PowerShell UTF-8 인코딩으로 한글 프로세스명 정상 표시
- 원격 프로세스만 정확히 필터링하여 불필요한 프로세스 제외
- 업무에서 자주 사용하는 IP[컴퓨터명] 형태로 복사 기능 제공
- 4가지 PC 카테고리로 원격지 종류를 시각적으로 구분
- 그룹화 시스템으로 다수의 원격지를 체계적으로 관리
- 키보드 단축키와 직관적인 UI로 업무 효율성 극대화
- 더미 데이터 없이 수동 프로세스 추가로 테스트 및 실제 업무 활용

## 🚨 Known Issues & Solutions

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
"@
```

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

**✅ 구현 완료 (v3.1):**
- `main.js`: EnumWindows 기반 PowerShell 스크립트 구현 완료
- `renderer.js`: 다중 세션 처리 및 창 상태 표시 완료
- `style.css`: 최소화/숨김 상태별 시각적 구분 스타일 추가

**해결된 문제들:**
1. ✅ **최소화된 창 감지**: IsIconic API로 최소화 상태 정확히 감지
2. ✅ **TeamViewer 다중 세션**: WindowHandle 기반 개별 세션 구분
3. ✅ **창 상태별 표시**: 연결/최소화/숨김 상태 시각적 구분
4. ✅ **성능 최적화**: 기존 Get-Process와 병행 사용으로 호환성 유지

**개선 사항:**
- 창별 고유 식별자(WindowHandle) 활용
- 중복 창 제거 로직으로 정확한 결과
- 창 상태별 색상 코딩 (주황=최소화, 회색=숨김, 빨강=끊김)
- TeamViewer 세션별 독립적인 관리 가능

### TeamViewer 다중세션 설정 격리 시스템 (v3.2) - ✅ 완료
48. ✅ **다중세션 설정 격리 구현**: WindowHandle/PID 기반 개별 세션 관리 완료
49. ✅ **고유 키 생성 시스템**: `getSettingsKey` 함수로 각 세션별 독립적 설정 저장
50. ✅ **브라우저 테스트 환경 지원**: TeamViewer 시뮬레이션 테스트 완료
51. ✅ **설정 격리 완료**: 같은 컴퓨터명의 다중세션에서도 독립적인 설정 관리

### 그룹 시스템 데이터 무결성 개선 (v3.3) - ✅ 완료
52. ✅ **그룹 할당 해제 방지**: 연결 끊김 시 그룹 할당이 해제되는 문제 해결
53. ✅ **끊어진 프로세스 영구 표시**: 그룹에 속한 프로세스는 연결 끊어져도 영구 표시
54. ✅ **자동 삭제 예외 처리**: 그룹 지정된 프로세스는 자동 삭제에서 제외
55. ✅ **설정 키 통합**: 프로세스 히스토리와 설정 저장 키 시스템 통합
56. ✅ **그룹 카운트 정확성**: 활성/전체 프로세스 개수 정확한 표시

## 🎯 해결된 핵심 문제들 (v3.2 → v3.3)

### **문제 1: TeamViewer 다중세션 설정 격리**
**✅ 해결 완료**
- **문제**: 같은 컴퓨터명의 다중세션에서 설정 공유
- **해결**: `getSettingsKey` 함수로 WindowHandle/PID 기반 고유 키 생성
- **결과**: 각 세션별 독립적인 그룹, 카테고리, 라벨 관리 가능

### **문제 2: 연결 끊김 시 그룹 할당 해제**
**✅ 해결 완료**
- **문제**: UI 렌더링 과정에서 끊어진 프로세스의 그룹 할당이 초기화됨
- **해결**: `renderProcessList`에서 그룹 소속 끊어진 프로세스 영구 표시 로직 추가
- **결과**: 그룹 할당이 연결 상태와 무관하게 유지됨

### **문제 3: 그룹 지정 프로세스 자동 삭제**
**✅ 해결 완료**  
- **문제**: 그룹에 속한 프로세스도 1분 후 자동 삭제됨
- **해결**: `cleanupOldDisconnectedProcesses`에서 그룹 멤버십 검사 추가
- **결과**: 그룹에 속한 프로세스는 자동 삭제에서 제외됨

### **문제 4: 프로세스 삭제 기능 실패**
**✅ 해결 완료**
- **문제**: 키 불일치로 인한 삭제 기능 실패
- **해결**: `removeDisconnectedProcess`에서 스마트 키 매칭 로직 구현
- **결과**: PID/프로세스명 기반 fallback으로 안정적인 삭제 가능

## 💡 기술적 개선사항

### **통합 키 관리 시스템**
```javascript
// 설정 저장용 키 (다중세션 지원)
function getSettingsKey(process) {
    // ezHelp: 컴퓨터명 기반 (단일세션)
    // TeamViewer: 컴퓨터명 + WindowHandle/PID (다중세션)
}

// 프로세스 히스토리 키 (연결 상태 추적)
function getProcessKey(process) {
    // 컴퓨터명 우선, IP/PID fallback
}
```

### **그룹 데이터 무결성 보장**
```javascript
// 끊어진 프로세스 표시 로직
const isInGroup = checkIfProcessInGroup(history);
if (isInGroup) {
    // 그룹 소속 프로세스는 영구 표시
    return true;
} else {
    // 일반 프로세스는 1분만 표시
    return (Date.now() - history.disconnectedTime) < 60000;
}
```

### **자동 정리 예외 처리**
```javascript
// 자동 삭제에서 그룹 프로세스 제외
const isInGroup = Object.values(groups).some(group => 
    group.processIds.includes(history.currentPid?.toString())
);
if (isInGroup) {
    console.log(`🛡️ 그룹 소속으로 자동 삭제 제외: ${key}`);
    return false; // 삭제하지 않음
}
```

## 📋 파일별 주요 변경사항 (v3.2 → v3.3)

### **renderer.js (현재 1800+ 라인)**
- **getSettingsKey 함수 (30-60라인)**: 다중세션 지원 키 생성 시스템
- **getProcessKey 함수 (1306-1329라인)**: 컴퓨터명 우선 히스토리 키 생성
- **checkIfProcessInGroup 함수**: 그룹 멤버십 검사 로직 추가
- **renderProcessList (286-304라인)**: 그룹 소속 끊어진 프로세스 영구 표시
- **cleanupOldDisconnectedProcesses (1650-1696라인)**: 그룹 프로세스 자동 삭제 예외
- **removeDisconnectedProcess (1589-1634라인)**: 스마트 키 매칭으로 안정적 삭제
- **assignProcessToGroup (1171-1220라인)**: 디버깅 로그 강화

### **main.js**
- **EnumWindows API 통합**: 최소화된 창과 TeamViewer 다중세션 감지 완료
- **WindowHandle 기반 식별**: 각 창별 고유 식별자 제공

### **test-teamviewer.html**
- **브라우저 기반 TeamViewer 시뮬레이션**: 다중세션 테스트 환경 제공
- **실시간 창 상태 변경**: 최소화/복원 테스트 기능

### **test-multisession.ps1**
- **PowerShell 기반 다중세션 감지**: EnumWindows API 테스트 스크립트

## 🚀 다음 개발 계획

### 향후 개선 가능한 기능들
1. **프로세스 종료 기능**: 원격 프로세스 직접 종료 기능
2. **연결 로그 시스템**: 연결/끊김 이벤트 히스토리 기록
3. **설정 내보내기/가져오기**: 그룹/카테고리 설정 백업/복원
4. **알림 설정**: 특정 프로세스 연결/끊김 시 알림 커스터마이징
5. **성능 모니터링**: CPU/메모리 사용량 표시
6. **원격 제어 통합**: TeamViewer/ezHelp 직접 제어 기능

### 기술적 최적화
1. **가상화 스크롤링**: 대량 프로세스 처리 시 성능 개선
2. **웹소켓 연동**: 실시간 다중 PC 모니터링
3. **플러그인 시스템**: 사용자 정의 기능 확장
4. **데이터베이스 연동**: SQLite 기반 데이터 영속성

## Memories
- **v3.2 → v3.3 핵심 성과**: TeamViewer 다중세션 완전 지원, 그룹 시스템 데이터 무결성 확보
- **키 관리 복잡성**: 설정 저장과 프로세스 히스토리에서 서로 다른 키 전략 필요
- **UI 렌더링 주의사항**: 끊어진 프로세스 처리 시 그룹 할당 초기화 방지 중요
- **테스트 환경의 중요성**: 브라우저 기반 시뮬레이션으로 개발 효율성 크게 향상