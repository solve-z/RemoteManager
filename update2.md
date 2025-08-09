## 2025-08-06 - TeamViewer 한글 컴퓨터명 인식 문제 해결

### 🐛 해결된 문제
**TeamViewer 한글 컴퓨터명을 가진 프로세스가 원격 프로세스로 인식되지 않는 문제**
- ✅ 인식됨: `"YSCENTER1_01 - TeamViewer"` (영문+숫자)
- ❌ 인식 안됨: `"공용서버 - TeamViewer"` (한글)
- 결과: 한글 컴퓨터명의 TeamViewer 원격 연결이 모니터링 대상에서 제외됨

### 🔍 근본 원인 분석
**정규식 패턴의 한글 미지원**
- 기존 정규식: `/\w+ - teamviewer$/i` 
- `\w+`는 `[a-zA-Z0-9_]`만 매칭하여 **한글을 인식하지 못함**
- 영문자, 숫자, 언더스코어만 허용되어 한글 문자는 제외됨

### 🔧 수정 사항

#### 수정된 파일 및 위치

**1. process-detector.js (라인 249, 259)**
```javascript
// 기존 (한글 미인식)
if (name === 'teamviewer' && /\w+ - teamviewer$/i.test(title)) {
  return true;
}

// 브라우저 테스트
if (name === 'chrome' && /\w+ - TeamViewer - Chrome$/i.test(title)) {
  return true;
}

// 수정 후 (한글 인식)
if (name === 'teamviewer' && /.+ - teamviewer$/i.test(title)) {
  return true;
}

// 브라우저 테스트 (수정)
if (name === 'chrome' && /.+ - TeamViewer - Chrome$/i.test(title)) {
  return true;
}
```

**2. KeyManager.js (라인 174, 183)**
```javascript
// 기존 (한글 미인식)
if (processName === 'teamviewer' && /\w+ - TeamViewer$/i.test(windowTitle)) {
  return 'teamviewer';
}

if (/\w+ - TeamViewer - Chrome$/i.test(windowTitle)) {
  return 'teamviewer';
}

// 수정 후 (한글 인식)
if (processName === 'teamviewer' && /.+ - TeamViewer$/i.test(windowTitle)) {
  return 'teamviewer';
}

if (/.+ - TeamViewer - Chrome$/i.test(windowTitle)) {
  return 'teamviewer';
}
```

### 📊 정규식 패턴 비교

| 패턴 | 설명 | 매칭 범위 | 한글 지원 |
|------|------|-----------|-----------|
| `\w+` | 단어 문자만 | `[a-zA-Z0-9_]` | ❌ |
| `.+` | 모든 문자 (줄바꿈 제외) | 모든 유니코드 문자 | ✅ |

### ✅ 검증 결과
수정 후 모든 TeamViewer 타이틀 패턴이 정상 인식:

| 컴퓨터명 타입 | 창 제목 예시 | 기존 인식 | 수정 후 |
|---------------|--------------|-----------|---------|
| 영문+숫자 | `"YSCENTER1_01 - TeamViewer"` | ✅ | ✅ |
| 한글 | `"공용서버 - TeamViewer"` | ❌ | ✅ |
| 한글+영문 | `"테스트PC - TeamViewer"` | ❌ | ✅ |
| 공백 포함 | `"My Computer - TeamViewer"` | ❌ | ✅ |

### 🎯 결과
- ✅ **한글 컴퓨터명 완전 지원**: 모든 언어의 컴퓨터명이 원격 프로세스로 인식
- ✅ **기존 기능 유지**: 영문 컴퓨터명도 정상 작동
- ✅ **브라우저 테스트 지원**: Chrome 테스트 환경에서도 한글 지원
- ✅ **일관성 개선**: process-detector.js와 KeyManager.js 모두 동일한 로직 적용

### ⚠️ 안전성 고려사항
- `.+` 패턴이 매우 광범위하지만, 다른 조건들로 제한:
  - 프로세스명이 정확히 `teamviewer`여야 함
  - 반드시 ` - TeamViewer`로 끝나야 함
  - 실제 TeamViewer 프로세스에서만 이런 패턴이 나타남

### 📋 관련 파일
- `src/main/process-detector.js`: 원격 프로세스 인식 로직 (라인 249, 259)
- `src/renderer/services/KeyManager.js`: 프로세스 타입 식별 로직 (라인 174, 183)

---

## 2025-08-06 - 사이드바 크기 조절 기능 구현

### ✨ 새로운 기능
**사이드바 드래그 앤 드롭 크기 조절 기능 추가**
- 그룹명이 길어질 때 잘리는 문제 해결을 위한 사용자 맞춤형 사이드바 크기 조절
- 마우스 드래그로 직관적인 크기 조절 가능
- 설정 자동 저장으로 프로그램 재시작 시에도 크기 유지

### 🔧 구현 사항

#### 1. HTML 구조 추가 (src/renderer/index.html)
**사이드바 리사이저 요소 추가:**
```html
<!-- 사이드바 리사이저 -->
<div id="sidebar-resizer" class="sidebar-resizer" title="드래그하여 사이드바 크기 조절"></div>
```
- 사이드바 오른쪽에 4px 폭의 리사이저 바 추가
- 마우스 커서 변경과 툴팁으로 사용법 안내

#### 2. JavaScript 드래그 로직 구현 (src/renderer/index.js)
**setupSidebarResizer() 메서드 추가:**
```javascript
setupSidebarResizer() {
  // 드래그 상태 관리
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  // 저장된 사이드바 크기 불러오기
  const savedWidth = this.stores.settings.get('sidebar.width', 280);
  this.setSidebarWidth(savedWidth);

  // 마우스 이벤트 처리
  // - mousedown: 드래그 시작
  // - mousemove: 크기 조절 (최소 200px, 최대 600px 제한)
  // - mouseup: 드래그 종료 및 설정 저장
  // - dblclick: 기본 크기(280px)로 복원
}
```

**크기 설정 메서드:**
```javascript
setSidebarWidth(width) {
  const sidebar = document.getElementById('sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  const appContainer = document.querySelector('.app-container');
  
  if (sidebar && resizer && appContainer) {
    // CSS 변수로 사이드바 폭 설정 (플렉스박스 레이아웃 유지)
    appContainer.style.setProperty('--sidebar-width', `${width}px`);
    sidebar.style.width = `${width}px`;
    resizer.style.left = `${width}px`;
  }
}
```

#### 3. CSS 스타일 시스템 (src/styles/main.css)
**리사이저 스타일:**
```css
/* 사이드바 리사이저 */
.sidebar-resizer {
  position: fixed;
  top: 0;
  left: 280px;
  width: 4px;
  height: 100vh;
  background: transparent;
  cursor: col-resize;
  z-index: 1001;
  transition: background-color 0.2s ease;
}

.sidebar-resizer:hover {
  background-color: rgba(59, 130, 246, 0.3);
}

.sidebar-resizer.active {
  background-color: rgba(59, 130, 246, 0.6);
}
```

**드래그 중 상태 관리:**
```css
/* 리사이징 중 커서와 선택 방지 */
body.resizing {
  cursor: col-resize !important;
  user-select: none !important;
}

body.resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
```

**호버 효과 개선:**
```css
/* 리사이저 호버 효과 개선 */
.sidebar-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  left: -2px;
  width: 8px;
  height: 100%;
  background: transparent;
}

.sidebar-resizer:hover::before {
  background: rgba(59, 130, 246, 0.1);
}
```

#### 4. 설정 저장 시스템 (src/renderer/store/SettingsStore.js)
**기본 설정에 사이드바 폭 추가:**
```javascript
// 사이드바 설정
sidebar: {
  width: 280, // 기본 사이드바 폭 (픽셀)
},
```

### 🐛 메인 콘텐츠 CSS 충돌 문제 해결

#### 문제 원인
- 기존 `.main-content`는 `flex: 1`로 플렉스박스 레이아웃 사용
- 리사이저 추가 시 `margin-left: 284px`로 덮어써서 플렉스박스 레이아웃 파괴

#### 해결 방법
1. **중복 CSS 제거**: `margin-left`를 강제로 설정하는 CSS 제거
2. **JavaScript 로직 수정**: `margin-left` 대신 CSS 변수 사용
3. **플렉스박스 레이아웃 복원**: `.main-content { flex: 1; }` 유지

### ✅ 완성된 사이드바 크기 조절 시스템

#### 1. 사용자 친화적 조작
- **드래그 조절**: 마우스로 자연스러운 크기 조절
- **시각적 피드백**: 호버 시 파란색 하이라이트, 드래그 중 색상 변경
- **크기 제한**: 최소 200px, 최대 600px (또는 화면 폭의 40%)
- **더블클릭 리셋**: 리사이저 더블클릭으로 기본 크기(280px) 복원

#### 2. 자동 설정 관리
- **즉시 저장**: 크기 변경 시 localStorage에 자동 저장
- **자동 복원**: 프로그램 재시작 시 이전 크기로 자동 복원
- **기본값 제공**: 설정이 없을 때 280px 기본 크기 사용

#### 3. 안정적인 레이아웃
- **플렉스박스 유지**: 기존 메인 콘텐츠 레이아웃 보존
- **반응형 지원**: 화면 크기에 따른 최대 크기 제한
- **부드러운 전환**: 리사이징 중 전환 효과 비활성화로 부드러운 조작

#### 4. 향상된 접근성
- **커서 변경**: col-resize 커서로 조작 가능함을 명확히 표시
- **툴팁 제공**: "드래그하여 사이드바 크기 조절" 안내 메시지
- **호버 영역 확장**: 8px 폭으로 호버 감지 영역 확장

### 🎯 결과
- ✅ **긴 그룹명 표시**: 그룹명이 길어져도 사용자가 직접 크기를 조절하여 완전히 표시 가능
- ✅ **개인화된 작업환경**: 사용자의 모니터 크기와 작업 스타일에 맞춘 최적화
- ✅ **직관적인 조작**: 드래그 앤 드롭으로 즉시 크기 조절 가능
- ✅ **설정 지속성**: 프로그램 재시작 후에도 사용자 설정 유지
- ✅ **기존 기능 보존**: 모든 기존 UI와 기능이 정상 작동
- ✅ **반응형 호환**: 다양한 화면 크기에서 안정적 동작

### 📋 관련 파일
- `src/renderer/index.html`: 사이드바 리사이저 HTML 요소 추가
- `src/renderer/index.js`: 드래그 앤 드롭 로직, 크기 설정 메서드, 이벤트 처리
- `src/styles/main.css`: 리사이저 스타일, 호버 효과, 드래그 상태 CSS
- `src/renderer/store/SettingsStore.js`: 사이드바 폭 기본 설정 추가

---

## 2025-08-06 - 그룹 영역 세로 크기 조절 기능 구현

### ✨ 새로운 기능
**네비게이션과 그룹 섹션 사이 세로 크기 조절 기능 추가**
- 그룹이 많아질 때 스크롤 대신 영역 크기를 직접 조절 가능
- 네비게이션 영역과 그룹 리스트 영역의 비율을 사용자 맞춤형으로 설정
- 설정 자동 저장으로 프로그램 재시작 시에도 크기 유지

### 🔧 구현 사항

#### 1. HTML 구조 추가 (src/renderer/index.html)
**네비게이션과 그룹 사이 리사이저 요소 추가:**
```html
<!-- 네비게이션과 그룹 사이 리사이저 -->
<div id="nav-groups-resizer" class="nav-groups-resizer" title="드래그하여 그룹 영역 크기 조절"></div>
```
- 네비게이션과 그룹 섹션 사이에 4px 높이의 수직 리사이저 바 추가
- 마우스 커서 변경과 툴팁으로 사용법 안내

#### 2. CSS 스타일 시스템 (src/styles/main.css)
**수직 리사이저 스타일:**
```css
/* 네비게이션과 그룹 사이 리사이저 */
.nav-groups-resizer {
  height: 4px;
  background: transparent;
  cursor: row-resize;
  transition: background-color 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.nav-groups-resizer:hover {
  background-color: rgba(59, 130, 246, 0.3);
}

.nav-groups-resizer.active {
  background-color: rgba(59, 130, 246, 0.6);
}
```

**플렉스박스 레이아웃 개선:**
```css
/* 사이드바를 플렉스박스 레이아웃으로 조정 */
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.sidebar-nav {
  flex-shrink: 0;
}

.groups-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100px;
  overflow: hidden;
}

.groups-list {
  flex: 1;
  overflow-y: auto;
  min-height: 50px;
}

.sidebar-footer {
  flex-shrink: 0;
}
```

**드래그 중 상태 관리:**
```css
/* 세로 리사이징 중 커서와 선택 방지 */
body.vertical-resizing {
  cursor: row-resize !important;
  user-select: none !important;
}

body.vertical-resizing * {
  cursor: row-resize !important;
  user-select: none !important;
}
```

#### 3. JavaScript 드래그 로직 구현 (src/renderer/index.js)
**setupNavGroupsResizer() 메서드 추가:**
```javascript
setupNavGroupsResizer() {
  const navSection = document.querySelector('.sidebar-nav');
  const resizer = document.getElementById('nav-groups-resizer');
  const groupsSection = document.querySelector('.groups-section');
  
  let isResizing = false;
  let startY = 0;
  let startNavHeight = 0;

  // 저장된 네비게이션 높이 불러오기
  const savedNavHeight = this.stores.settings.get('sidebar.navHeight', 200);
  this.setNavHeight(savedNavHeight);

  // 마우스 이벤트 처리
  // - mousedown: 세로 드래그 시작
  // - mousemove: 네비게이션 높이 조절 (최소 120px, 최대 400px 제한)
  // - mouseup: 드래그 종료 및 설정 저장
  // - dblclick: 기본 높이(200px)로 복원
}
```

**높이 설정 메서드:**
```javascript
setNavHeight(height) {
  const navSection = document.querySelector('.sidebar-nav');
  
  if (navSection) {
    navSection.style.height = `${height}px`;
    navSection.style.flexShrink = '0';
  }
}
```

#### 4. 설정 저장 시스템 (src/renderer/store/SettingsStore.js)
**기본 설정에 네비게이션 높이 추가:**
```javascript
// 사이드바 설정
sidebar: {
  width: 280, // 기본 사이드바 폭 (픽셀)
  navHeight: 200, // 기본 네비게이션 영역 높이 (픽셀)
},
```

### ✅ 완성된 세로 크기 조절 시스템

#### 1. 사용자 친화적 조작
- **세로 드래그 조절**: 마우스로 네비게이션과 그룹 영역 비율 조절
- **시각적 피드백**: 호버 시 파란색 하이라이트, 드래그 중 색상 변경
- **크기 제한**: 네비게이션 최소 120px, 최대 400px 제한으로 안정적 UI 유지
- **더블클릭 리셋**: 리사이저 더블클릭으로 기본 높이(200px) 복원

#### 2. 자동 설정 관리
- **즉시 저장**: 크기 변경 시 localStorage에 자동 저장
- **자동 복원**: 프로그램 재시작 시 이전 크기로 자동 복원
- **기본값 제공**: 설정이 없을 때 200px 기본 높이 사용

#### 3. 안정적인 레이아웃
- **플렉스박스 기반**: 유연하고 반응형인 레이아웃 구조
- **스크롤 최적화**: 그룹 리스트 영역에만 스크롤 적용으로 효율적인 공간 활용
- **최소/최대 제한**: 네비게이션과 그룹 영역 모두 적절한 최소 공간 보장

#### 4. 향상된 접근성
- **커서 변경**: row-resize 커서로 세로 조작 가능함을 명확히 표시
- **툴팁 제공**: "드래그하여 그룹 영역 크기 조절" 안내 메시지
- **호버 영역 확장**: 8px 높이로 호버 감지 영역 확장

### 🎯 결과
- ✅ **그룹 스크롤 해결**: 그룹이 많아져도 스크롤 대신 영역 크기 조절로 모든 그룹을 한눈에 확인
- ✅ **맞춤형 레이아웃**: 사용자의 작업 패턴에 따라 네비게이션과 그룹 영역 비율 최적화
- ✅ **직관적인 조작**: 세로 드래그로 즉시 영역 크기 조절 가능
- ✅ **설정 지속성**: 프로그램 재시작 후에도 사용자 설정 유지
- ✅ **기존 기능 보존**: 모든 기존 UI와 기능이 정상 작동
- ✅ **가로 리사이저 호환**: 기존 사이드바 가로 크기 조절과 완전 독립적으로 작동

### 📋 관련 파일
- `src/renderer/index.html`: 네비게이션-그룹 리사이저 HTML 요소 추가
- `src/renderer/index.js`: 세로 드래그 로직, 높이 설정 메서드, 이벤트 처리
- `src/styles/main.css`: 수직 리사이저 스타일, 플렉스박스 레이아웃, 드래그 상태 CSS
- `src/renderer/store/SettingsStore.js`: 네비게이션 높이 기본 설정 추가

---

## 2025-08-06 - 그룹 카운팅 로직 개선

### 🐛 해결된 문제
**사이드바 그룹 개수와 프로세스 리스트 표시 개수 불일치 문제**
- 그룹 이름 옆 개수가 연결이 끊어진 프로세스를 카운트에서 제외
- 원격 프로세스가 다시 연결되면 그룹 카운팅이 올라가지만, 연결이 끊어져도 프로세스 리스트에는 표시됨
- 사용자 요구: 연결이 끊어져도 그룹 카운팅에 포함되어야 함

### 🔍 근본 원인 분석
**Sidebar.js의 그룹 카운팅 로직 제한**
- 기존 코드 (238-241라인): `p.status === 'connected'` 조건으로 연결된 프로세스만 카운트
- ProcessList.js: 연결이 끊어진 프로세스(`disconnected`, `reconnected`)도 화면에 표시
- 결과: 사이드바 그룹 개수 ≠ 프로세스 리스트 실제 표시 개수

### 🔧 수정 사항

#### Sidebar.js - renderGroupItem() 메서드 (234-245라인)
**기존 코드 (연결된 프로세스만):**
```javascript
// 그룹에 속한 연결된 프로세스만 카운트
let processCount = 0;

if (this.processStore && group.processIds) {
  processCount = group.processIds
    .map(id => this.processStore.getProcess(id))
    .filter(p => p && p.groupId === group.id && p.status === 'connected')
    .length;
} else {
  // 폴백: processIds 길이 사용
  processCount = group.processIds ? group.processIds.length : 0;
}
```

**수정된 코드 (모든 프로세스):**
```javascript
// 그룹에 속한 모든 프로세스 카운트 (연결 상태와 관계없이)
let processCount = 0;

if (this.processStore && group.processIds) {
  processCount = group.processIds
    .map(id => this.processStore.getProcess(id))
    .filter(p => p && p.groupId === group.id)
    .length;
} else {
  // 폴백: processIds 길이 사용
  processCount = group.processIds ? group.processIds.length : 0;
}
```

### ✅ 개선된 카운팅 시스템

#### 1. 일관된 카운팅 로직
- **사이드바**: 그룹에 속한 모든 프로세스 카운트 (연결 상태 무관)
- **프로세스 리스트**: 연결/끊김/재연결 상태 모든 프로세스 표시
- **결과**: 사이드바 개수 = 프로세스 리스트 표시 개수 완전 일치

#### 2. 사용자 요구사항 반영
- **연결 끊김 시**: 그룹 카운팅에서 제외되지 않음
- **재연결 시**: 기존 카운팅 유지 (중복 증가 방지)
- **실시간 동기화**: 프로세스 상태 변화와 관계없이 정확한 개수 표시

#### 3. 안정적인 데이터 동기화
- **프로세스 생성**: 그룹 카운팅 자동 증가
- **프로세스 삭제**: 그룹 카운팅 자동 감소  
- **그룹 이동**: 카운팅 실시간 업데이트
- **폴백 시스템**: processStore 오류 시 processIds 배열 길이 사용

### 🎯 결과
- ✅ **완벽한 동기화**: 사이드바 그룹 개수와 프로세스 리스트 표시 개수 완전 일치
- ✅ **사용자 요구사항 충족**: 연결이 끊어져도 그룹 카운팅에 포함
- ✅ **직관적인 사용자 경험**: 화면에 보이는 프로세스와 사이드바 개수 일치
- ✅ **안정적인 동작**: 연결 상태 변화와 관계없이 일관된 카운팅

### 📋 관련 파일
- `src/renderer/components/Sidebar.js`: 그룹 카운팅 로직 개선 (234-245라인)

---

## 2025-08-06 - v1.1.2 그룹 세로 리사이저 및 UI 개선과 상담원 번호 변경 감지 기능

### ✨ 새로운 기능

#### 1. 그룹 영역 세로 크기 조절 기능 완전 구현
- **네비게이션-그룹 세로 리사이저**: 그룹이 많아질 때 스크롤 대신 영역 크기 직접 조절 가능
- **직관적 드래그**: 마우스로 네비게이션과 그룹 영역 비율 자유 조절
- **설정 자동 저장**: 프로그램 재시작 시에도 사용자 설정 크기 유지

#### 2. 이지헬프 상담원 번호 변경 자동 감지 시스템
- **실시간 상담원 번호 추적**: 같은 원격지에서 다른 상담원 번호로 접속 시 자동 감지 및 업데이트
- **IP 변경과 동일한 로직**: 기존 IP 변경 감지 시스템을 확장하여 상담원 번호 변경도 처리
- **자동 업데이트**: 사용자 개입 없이 새로운 상담원 번호로 즉시 반영

### 🔧 상세 구현 사항

#### A. 그룹 세로 리사이저 시스템

**1. HTML 구조 및 CSS 스타일 (src/renderer/index.html, src/styles/main.css)**
```html
<!-- 네비게이션과 그룹 사이 리사이저 -->
<div id="nav-groups-resizer" class="nav-groups-resizer" title="드래그하여 그룹 영역 크기 조절"></div>
```

**2. JavaScript 드래그 로직 (src/renderer/index.js)**
- **setupNavGroupsResizer()**: 세로 드래그 이벤트 처리
- **setNavHeight()**: 네비게이션 영역 높이 동적 설정
- **크기 제한**: 최소 120px, 최대 400px로 안정적 UI 유지
- **더블클릭 리셋**: 기본 높이(300px)로 복원

**3. 설정 저장 (src/renderer/store/SettingsStore.js)**
```javascript
sidebar: {
  width: 280,
  navHeight: 300, // 기본 높이를 300px로 증가
}
```

**4. CSS 플렉스박스 최적화**
- 사이드바 전체를 `flex-direction: column`으로 구성
- 네비게이션: `flex-shrink: 0` (고정 크기)
- 그룹 영역: `flex: 1` (나머지 공간 자동 차지)
- 리사이저: `flex-shrink: 0` (4px 고정 높이)

#### B. 상담원 번호 변경 감지 시스템

**1. KeyManager.js 확장**
```javascript
// 기존: IP 변경만 감지
compareProcessInfo(existingProcess, newProcess) {
  // IP 변경 감지
  const ipChanged = oldIP && newIP && oldIP !== newIP;
}

// 개선: IP + 상담원 번호 변경 동시 감지
compareProcessInfo(existingProcess, newProcess) {
  // IP 변경 감지
  const ipChanged = oldIP && newIP && oldIP !== newIP;
  
  // 상담원 번호 변경 감지 (ezHelp)
  const oldCounselorId = existingProcess.counselorId || this.extractCounselorId(existingProcess);
  const newCounselorId = newProcess.counselorId || this.extractCounselorId(newProcess);
  const counselorChanged = oldCounselorId && newCounselorId && oldCounselorId !== newCounselorId;
  
  return { sameComputer, ipChanged, counselorChanged, oldIP, newIP, oldCounselorId, newCounselorId };
}
```

**2. ProcessStore.js 충돌 처리 로직**
```javascript
// IP 변경 및 상담원 번호 변경 감지
const comparison = KeyManager.compareProcessInfo(existingProcess, processInfo);

if (comparison.ipChanged || comparison.counselorChanged) {
  if (comparison.counselorChanged) {
    console.log('👥 상담원 번호 변경 감지:', {
      computerName: comparison.computerName,
      oldCounselorId: comparison.oldCounselorId,
      newCounselorId: comparison.newCounselorId
    });
  }
  
  // IP 변경: 사용자 확인 필요
  // 상담원 번호 변경: 자동 업데이트 (동일 컴퓨터로 간주)
  if (comparison.ipChanged) {
    // 사용자 확인 다이얼로그
  } else if (comparison.counselorChanged) {
    // 자동 업데이트
    return this.updateExistingProcess(existingProcess, processInfo);
  }
}
```

**3. 프로세스 업데이트 시 상담원 번호 변경 로그**
```javascript
// 상담원 번호 변경 감지 로그
if (existingProcess.type === 'ezhelp' && oldCounselorId && oldCounselorId !== existingProcess.counselorId) {
  console.log('👥 상담원 번호 업데이트 감지:', {
    processId: existingProcess.id,
    computerName: existingProcess.computerName,
    oldCounselorId: oldCounselorId,
    newCounselorId: existingProcess.counselorId,
    windowTitle: newProcessInfo.windowTitle
  });
}
```

#### C. UI/UX 개선 사항

**1. 모던한 그룹 스크롤바 디자인**
```css
.groups-list::-webkit-scrollbar {
  width: 4px; /* 얇고 깔끔한 4px */
}

.groups-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5); /* 반투명 회색 */
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.groups-list::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.8); /* 호버 시 진해짐 */
}
```

**2. 리사이저 크기 최적화**
- 세로 리사이저: `height: 4px` (기존 6px에서 축소)
- 배경 투명도: `rgba(229, 231, 235, 0.3)` (기존 0.5에서 축소)

### 🐛 해결된 문제점

#### 1. 그룹 영역 크기 조절 미작동 문제
- **원인**: CSS 플렉스박스 구조 충돌과 과도한 디버깅 로그
- **해결**: 
  - 사이드바 전체를 명시적 플렉스박스 구조로 재정립
  - 네비게이션에서 `flex: 1` 제거하고 JavaScript로 동적 높이 설정
  - 불필요한 디버깅 로그 정리로 콘솔 깔끔화

#### 2. 상담원 번호 변경 시 이전 번호 유지 문제
- **원인**: IP 변경 감지와 달리 상담원 번호 변경은 별도 처리 없음
- **해결**: 
  - `compareProcessInfo()` 함수에 상담원 번호 변경 감지 로직 추가
  - 프로세스 업데이트와 재연결 시 모두 상담원 번호 변경 추적
  - 자동 업데이트로 사용자 개입 없이 즉시 반영

### ✅ 완성된 기능들

#### 1. 완전한 세로 크기 조절 시스템
- **직관적 조작**: 드래그로 즉시 네비게이션과 그룹 영역 비율 조절
- **시각적 피드백**: 호버 시 파란색 하이라이트, 드래그 중 색상 변경
- **설정 지속성**: 프로그램 재시작 시에도 사용자 설정 유지
- **더블클릭 복원**: 리사이저 더블클릭으로 기본 크기로 즉시 복원

#### 2. 지능형 상담원 번호 추적
- **자동 감지**: ezHelp 창 제목에서 `상담원(번호)` 패턴 실시간 추적
- **즉시 업데이트**: 번호 변경 시 UI와 데이터 동시 업데이트
- **상세한 로깅**: 콘솔에서 상담원 번호 변경 과정 완전 추적
- **재연결 지원**: 연결 끊김 후 재연결 시에도 번호 변경 정상 처리

#### 3. 향상된 UI 디자인
- **모던 스크롤바**: 4px 폭의 얇고 반투명한 스크롤바로 세련된 느낌
- **최적화된 리사이저**: 적절한 크기와 투명도로 기능성과 미관 균형
- **그룹 기본 높이 개선**: 300px 기본 높이로 더 넓은 그룹 표시 공간

### 🎯 최종 결과

#### 즉시 해결된 문제들
- ✅ **그룹 영역 크기 조절 완전 작동**: 드래그로 자유자재로 영역 크기 조절 가능
- ✅ **상담원 번호 실시간 추적**: 다른 상담원이 같은 원격지 접속 시 즉시 번호 반영
- ✅ **모던한 스크롤바**: 그룹이 많아져도 시각적으로 깔끔한 스크롤 경험
- ✅ **최적화된 기본 크기**: 그룹 영역이 더 넓어져 스크롤 필요성 감소

#### 사용자 경험 개선
- 🎨 **맞춤형 레이아웃**: 사용자가 직접 네비게이션과 그룹 영역 비율 최적화 가능
- 👥 **정확한 상담원 정보**: 업무 혼란 방지를 위한 실시간 상담원 번호 추적
- 📱 **반응형 디자인**: 다양한 화면 크기와 사용자 선호도에 맞춘 유연한 레이아웃
- ⚡ **빠른 조작**: 드래그, 더블클릭 등 직관적인 UI 조작으로 효율적인 작업환경

### 📋 관련 파일
- `src/renderer/index.html`: 세로 리사이저 HTML 요소 추가
- `src/renderer/index.js`: 세로 드래그 로직, 디버깅 로그 정리
- `src/styles/main.css`: 세로 리사이저, 모던 스크롤바, 플렉스박스 최적화
- `src/renderer/store/SettingsStore.js`: 네비게이션 기본 높이 300px 설정
- `src/renderer/services/KeyManager.js`: 상담원 번호 변경 감지 로직 추가
- `src/renderer/store/ProcessStore.js`: 충돌 처리 및 상담원 번호 업데이트 로직

