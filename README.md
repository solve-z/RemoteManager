# 🖥️ RemoteManager v1.1.0

> **원격지원 관리 도구** - ezHelp, TeamViewer 등 원격지원 프로그램을 효율적으로 관리하는 Electron 기반 데스크톱 애플리케이션

[![Windows](https://img.shields.io/badge/Platform-Windows-blue)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-v28.0.0-blue)](https://electronjs.org)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green)](https://nodejs.org)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 📋 목차

- [🎯 프로젝트 개요](#-프로젝트-개요)
- [🏗️ 아키텍처](#️-아키텍처)
- [🚀 시작하기](#-시작하기)
- [💻 개발 가이드](#-개발-가이드)
- [📊 코드 구조 분석](#-코드-구조-분석)
- [🔧 주요 기능](#-주요-기능)
- [🎨 UI/UX](#-uiux)
- [🤝 기여하기](#-기여하기)

## 🎯 프로젝트 개요

RemoteManager는 Windows 환경에서 ezHelp, TeamViewer 등의 원격지원 프로그램을 사용할 때 다수의 원격지를 체계적으로 관리하고 정보를 추출할 수 있는 도구입니다.

### ✨ 주요 특징

- 🔍 **자동 프로세스 감지**: PowerShell + Windows API 기반 원격 프로세스 실시간 감지
- 📁 **그룹 관리**: 원격지를 그룹별로 체계적 관리 및 분류
- 🎯 **원클릭 포커스**: 클릭 한 번으로 해당 원격 창 포커스 및 제어
- 📊 **실시간 모니터링**: 연결 상태 추적 및 자동 새로고침
- 📋 **정보 추출**: IP[컴퓨터명] 형태로 빠른 복사 기능
- 🎨 **현대적 UI**: 반응형 디자인과 다크모드 지원

## 🏗️ 아키텍처

### 전체 구조도

```
🏗️ RemoteManager v1.1.1 Architecture
├── 📱 Main Process (Electron)
│   ├── main.js (엔트리포인트)
│   ├── process-detector.js (PowerShell + WinAPI)
│   └── window-manager.js (창 포커스 관리)
│
├── 🖥️ Renderer Process 
│   ├── 🎯 Entry: index.html, index.js, preload.js
│   ├── 🧩 Components (UI 레이어)
│   │   ├── ProcessList.js (메인 프로세스 목록)
│   │   ├── GroupManager.js (그룹 관리 모달)
│   │   ├── Sidebar.js (네비게이션)
│   │   ├── StatusBar.js (상태표시줄)
│   │   └── ConflictDialog.js (충돌 해결)
│   │
│   ├── 🛠️ Services (비즈니스 로직)
│   │   ├── ProcessService.js (프로세스 조작)
│   │   ├── GroupService.js (그룹 CRUD)
│   │   ├── KeyManager.js (통합 키 관리)
│   │   └── NotificationService.js (알림)
│   │
│   ├── 📦 Store (상태 관리)
│   │   ├── ProcessStore.js (프로세스 상태)
│   │   ├── GroupStore.js (그룹 데이터)
│   │   └── SettingsStore.js (설정)
│   │
│   └── 🔧 Utils
│       ├── constants.js (상수)
│       └── helpers.js (헬퍼)
│
└── 🎨 Styles
    ├── main.css (레이아웃)
    ├── components.css (컴포넌트별)
    └── themes.css (테마 시스템)
```

### 3계층 아키텍처

```
📊 3-Layer Architecture
│
├── 🏪 Store Layer (데이터 저장소)
│   ├── ProcessStore - Observer 패턴으로 프로세스 상태 관리
│   ├── GroupStore - localStorage 기반 그룹 데이터 영속화
│   └── SettingsStore - 중첩 설정 구조 및 타입 검증
│
├── ⚙️ Service Layer (비즈니스 로직)
│   ├── ProcessService - IPC 통신을 통한 프로세스 조작
│   ├── GroupService - 그룹 CRUD 및 이벤트 발행
│   ├── KeyManager - 통합 키 관리 및 충돌 해결
│   └── NotificationService - 토스트 알림 및 스택 관리
│
└── 🎨 Component Layer (UI)
    ├── ProcessList - 필터링, 정렬, 렌더링
    ├── Sidebar - 그룹 네비게이션 및 제목 업데이트
    ├── GroupManager - 모달 기반 그룹 관리
    └── StatusBar - 실시간 통계 표시
```

## 🚀 시작하기

### 시스템 요구사항

- **운영체제**: Windows 10/11
- **Node.js**: 18.0.0 이상
- **PowerShell**: 5.1 이상 (Windows 기본 제공)

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/your-username/RemoteManager.git
cd RemoteManager

# 의존성 설치
npm install

# 개발 모드 실행 (DevTools 포함)
npm run dev

# 프로덕션 실행
npm start
```

### 빌드

```bash
# Windows 설치 파일 생성
npm run build:win

# 포터블 버전 생성
npm run build

# 개발용 빌드 (폴더만)
npm run build:dir
```

## 💻 개발 가이드

### 개발 명령어

```bash
# 개발 서버 시작
npm run dev

# 테스트 실행
npm test

# 테스트 (watch 모드)
npm run test:watch

# 린트 검사
npm run lint

# 린트 자동 수정
npm run lint:fix
```

### 코딩 규칙

1. **ES6 모듈 시스템** 사용 (`import`/`export`)
2. **JSDoc** 타입 문서화 필수
3. **순수 함수** 중심 설계 (부작용 최소화)
4. **에러 처리** 모든 비동기 작업에 try-catch
5. **Observer 패턴** 상태 변경 알림

### 아키텍처 원칙

- **모듈화**: 기능별 파일 분리 및 컴포넌트화
- **단일 진실의 원천**: 통합된 데이터 스토어와 키 관리
- **순수 자바스크립트**: 빌드 과정 없이 바로 실행 가능
- **테스트 친화적**: 단위 테스트 가능한 구조

## 📊 코드 구조 분석

### 데이터 흐름

```
🔄 Data Flow
User Interaction 
    ↓
Component Layer 
    ↓
Service Layer 
    ↓
Store Layer 
    ↓
Observer Notification 
    ↓
UI Update
```

### IPC 통신 흐름

```
🔌 IPC Communication
Renderer Process → Main Process
    ├── process-scan (프로세스 스캔)
    ├── focus-window (창 포커스)
    └── window-actions (최소화/복원)

Main Process → Windows API
    ├── PowerShell (spawn 기반)
    ├── EnumWindows API
    └── SetForegroundWindow API
```

### 프로세스 식별 로직

```javascript
// ezHelp 프로세스 식별
processName === 'ezHelpViewer' && 
(title.includes('원격지 IP') || title.includes('Relay'))

// TeamViewer 프로세스 식별  
title.match(/^(.+) - TeamViewer$/) && 
!title.includes('TeamViewer 옵션')
```

## 🔧 주요 기능

### 1. 프로세스 감지

- **PowerShell + EnumWindows API**: 최소화된 창까지 감지
- **UTF-8 인코딩**: 한글 프로세스명 정상 처리
- **실시간 상태 추적**: 연결/재연결/끊김 자동 감지

### 2. 그룹 관리

- **동적 그룹 생성**: 실시간 그룹 옵션 업데이트
- **프로세스 할당**: 드래그 앤 드롭 또는 선택 할당
- **그룹별 필터링**: 사이드바를 통한 빠른 필터링

### 3. 안정적 식별자 시스템

- **컴퓨터명 기반 키**: `ezhelp_desktop-6bcogpv`, `teamviewer_YSCENTER1_01`
- **IP 변경 감지**: 같은 컴퓨터의 다른 IP 연결 시 사용자 확인
- **충돌 해결**: 3가지 선택지 제공 (같은 컴퓨터/다른 컴퓨터/항상 새로 등록)

### 4. 창 포커스 기능

```javascript
// 원클릭 창 포커스
async focusProcess(processId) {
  const process = this.processStore.getProcess(processId);
  const result = await window.electronAPI.focusWindow(process.windowHandle);
  return result.success;
}
```

## 🎨 UI/UX

### 디자인 시스템

- **색상 체계**: CSS 변수 기반 테마 시스템
- **타입그래피**: Segoe UI 기반 가독성 중심
- **간격 시스템**: 4px 단위 일관성 유지
- **애니메이션**: 60fps 부드러운 전환 효과

### 반응형 디자인

```css
/* 데스크톱 (기본) */
.app-container {
  grid-template-columns: 250px 1fr;
}

/* 태블릿 (1024px 이하) */
@media (max-width: 1024px) {
  .filters-header { font-size: 13px; }
}

/* 모바일 (480px 이하) */  
@media (max-width: 480px) {
  .app-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
```

### 접근성

- **키보드 내비게이션**: 모든 기능 키보드로 접근 가능
- **ARIA 라벨**: 스크린 리더 지원
- **색상 대비**: WCAG 2.1 AA 기준 준수
- **포커스 인디케이터**: 명확한 포커스 표시

## 🛠️ 기술 스택

| 분야 | 기술 |
|------|------|
| 플랫폼 | Electron 28.0.0 |
| 언어 | JavaScript (ES6 모듈) |
| UI | HTML5, CSS3, Pure JavaScript |
| 시스템 연동 | PowerShell, Windows API |
| 상태 관리 | Observer Pattern |
| 테스트 | Jest, Playwright |
| 빌드 | Electron Builder |

## 🧪 테스트

### 테스트 구조

```
tests/
├── unit/           # 단위 테스트
│   ├── store/      # Store 레이어 테스트
│   ├── services/   # Service 레이어 테스트
│   └── utils/      # 유틸리티 함수 테스트
├── integration/    # 통합 테스트
│   └── components/ # 컴포넌트 연동 테스트
└── e2e/           # E2E 테스트
    └── scenarios/  # 사용자 시나리오 테스트
```

### 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 파일 테스트
npm test -- ProcessStore.test.js

# 커버리지 포함 테스트
npm test -- --coverage
```

## 📈 성능 최적화

### 메모리 관리

- **Map 자료구조**: O(1) 조회 성능
- **Observer 패턴**: 효율적인 상태 변경 알림
- **DOM 가상화**: 대량 프로세스 목록 처리

### 네트워크 최적화

- **IPC 배치 처리**: 중복 호출 방지
- **캐싱 전략**: 프로세스 히스토리 메모리 캐시
- **지연 로딩**: 필요할 때만 컴포넌트 초기화

## 📋 릴리스 노트

### v1.1.0 (2025-08-04) - UI/UX 대폭 개선 및 안정성 향상

#### 🎨 주요 UI/UX 개선사항

**로딩 시스템 혁신**
- ✅ **직선형 로딩바 제거**: 시각적 피로를 유발하던 상단 프로그레스바 완전 제거
- ✅ **버튼 스피너 도입**: 새로고침 버튼에 통합된 14px 스피너로 로딩 상태 표시
- ✅ **CSS 아이콘 시스템**: 이모지 크기 차이 문제 해결을 위한 통일된 CSS 아이콘 구현

**버튼 UI 완전 개선**
- ✅ **크기 안정화**: 모든 버튼이 상태 변화 시에도 크기 불변 보장
- ✅ **완벽한 정렬**: 아이콘과 텍스트의 정확한 수직 중앙 정렬
- ✅ **자동 새로고침 아이콘**: ▶️(시작) ↔ ⏸️(중지) 통일된 CSS 아이콘으로 교체

**반응형 디자인 강화**
- ✅ **768px 이하**: 헤더 버튼 텍스트 자동 숨김으로 공간 최적화
- ✅ **480px 이하**: 모든 버튼 텍스트 숨김으로 모바일 지원 강화

#### 🔧 핵심 기능 안정성 개선

**프로세스 식별 정확도 향상**
- ✅ **ezHelp 타이틀 변경 대응**: "잠김", "화면 녹화 중" 등 상태 변화 시에도 정확한 컴퓨터명 추출
- ✅ **IP 변경 즉시 반영**: 원격지 IP 변경 시 UI와 복사 기능에 실시간 업데이트
- ✅ **카테고리 지속성**: 프로그램 재시작 후에도 사용자 설정 카테고리 완벽 보존

**데이터 무결성 완전 보장**
- ✅ **완전 삭제 시스템**: 끊어진 프로세스 삭제 시 그룹/카테고리 설정도 함께 정리
- ✅ **그룹 개수 동기화**: 사이드바 표시 개수와 실제 프로세스 개수 완벽 일치
- ✅ **안정적 키 정리**: 고아 데이터 자동 정리로 장기 사용 안정성 확보

**UI 동기화 시스템**
- ✅ **그룹 색상 동기화**: 사이드바와 프로세스 리스트 그룹 배지 색상 완벽 일치
- ✅ **상호 배타적 하이라이팅**: 네비게이션과 그룹 선택의 명확한 구분

#### 🚀 성능 및 사용성 향상

**메모리 및 성능 최적화**
- 🔄 **IPC 통신 효율화**: 중복 호출 방지 및 배치 처리
- 🔄 **Observer 패턴 최적화**: 효율적인 상태 변경 알림 시스템
- 🔄 **DOM 조작 최소화**: 가상 스크롤링으로 대량 프로세스 렌더링 최적화

**개발자 경험 개선**
- 📝 **상세한 디버그 로그**: IP 변경, 프로세스 상태 변화 등 상세 추적 가능
- 🧪 **모듈화된 아키텍처**: 단위 테스트 친화적 구조로 유지보수성 향상
- 📚 **완벽한 문서화**: update.md에 모든 변경사항 상세 기록

### v1.0.0 (2025-08-03) - 안정화 릴리스

**핵심 기능 구현 완료**
- ✅ **모듈화 아키텍처**: Store Pattern 기반 3계층 구조 완성
- ✅ **프로세스 감지**: PowerShell + Windows API 기반 실시간 감지
- ✅ **그룹 관리**: 완전한 CRUD 시스템 및 UI 구현
- ✅ **창 포커스**: 원클릭 원격 창 포커스 기능 안정화

## 🔮 향후 계획

### v1.2 계획

- [ ] **테스트 커버리지 100%**: 모든 컴포넌트 테스트 작성
- [ ] **고급 필터링**: 정규식 기반 프로세스 검색
- [ ] **히스토리 로그**: 연결 기록 저장 및 분석
- [ ] **설정 UI**: 사용자 정의 설정 인터페이스

### v1.3 계획

- [ ] **다국어 지원**: i18n 시스템 구축
- [ ] **플러그인 시스템**: 확장 가능한 아키텍처
- [ ] **클라우드 동기화**: 설정 및 그룹 정보 동기화
- [ ] **macOS 지원**: 크로스 플랫폼 확장

## 🤝 기여하기

### 기여 방법

1. **이슈 생성**: 버그 리포트나 기능 제안
2. **포크 생성**: 개인 저장소로 포크
3. **브랜치 생성**: `feature/기능명` 또는 `fix/버그명`
4. **커밋 작성**: [Conventional Commits](https://conventionalcommits.org/) 준수
5. **PR 생성**: 상세한 설명과 함께 Pull Request

### 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 스타일 변경 (포맷팅 등)
refactor: 코드 리팩토링
test: 테스트 추가 또는 수정
chore: 빌드 프로세스나 도구 변경
```

### 코드 리뷰 기준

- **기능성**: 요구사항 충족 여부
- **성능**: 메모리 사용량 및 실행 속도
- **보안**: 안전한 코딩 패턴 준수
- **가독성**: 코드 이해도 및 문서화
- **테스트**: 적절한 테스트 커버리지

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.

## 👥 팀

- **개발팀**: RemoteManager Team
- **메인테이너**: [@your-username](https://github.com/your-username)

## 📞 지원

- **이슈 트래커**: [GitHub Issues](https://github.com/your-username/RemoteManager/issues)
- **문서**: [Wiki](https://github.com/your-username/RemoteManager/wiki)
- **릴리스 노트**: [Releases](https://github.com/your-username/RemoteManager/releases)

---

<div align="center">

**⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요! ⭐**

Made with ❤️ by RemoteManager Team

</div>
