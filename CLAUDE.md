# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RemoteManager** - 원격지원 관리 도구

ezHelp, TeamViewer 등 원격지원 프로그램을 사용할 때 다수의 원격지를 효율적으로 관리하고 정보를 추출할 수 있는 Electron 기반 데스크톱 애플리케이션입니다.

## Current Status

✅ **Implementation Complete**: RemoteManager v4.0 모듈화 아키텍처 구현 완료
- `a.md`: 기본 요구사항 및 기능 명세서
- `b.md`: 기존 v3.x 버전의 완전한 CLAUDE.md 문서 (1991라인 구현 완료)
- `plan.md`: v4.0 재설계 계획서 (모듈화된 아키텍처)

### 구현 완료 현황 (2024년)
- ✅ **전체 프로젝트 구조**: 32개 파일, 15,063 라인 구현
- ✅ **모듈화 아키텍처**: Store Pattern, Service Layer, Component System
- ✅ **프로세스 감지**: spawn 기반 PowerShell + Windows API
- ✅ **Chrome 브라우저 테스트 지원**: ezHelp/TeamViewer 시뮬레이션
- ✅ **실시간 상태 관리**: 연결/재연결/끊김 추적
- ✅ **완전한 UI 시스템**: 반응형 디자인, 다크모드, 알림
- ✅ **그룹 관리 시스템**: 그룹 생성/수정/삭제, 프로세스 할당, 그룹 배지 표시

### 최근 수정 사항 (2025-08-02)
- ✅ **그룹 배지 표시 개선**: ProcessList.js에서 그룹 ID 대신 실제 그룹명 표시
- ✅ **그룹 선택 드롭다운 수정**: 동적 그룹 옵션 로딩으로 실시간 그룹 목록 반영
- ✅ **프로세스 렌더링 최적화**: renderGroupOptions 함수 추가로 성능 개선
- ✅ **그룹 할당 UI 개선**: 현재 선택된 그룹이 정확히 표시되도록 수정
- ✅ **프로세스 삭제 시 그룹 정리**: 프로세스 삭제 시 자동으로 그룹에서도 제거
- ✅ **프로세스 히스토리 보존**: 자동 정리 시 히스토리 유지로 재연결 복원 가능

## Project Architecture (Implemented v4.0)

### 핵심 설계 원칙
1. **모듈화**: 기능별 파일 분리 및 컴포넌트화
2. **단일 진실의 원천**: 통합된 데이터 스토어와 키 관리
3. **순수 자바스크립트**: 빌드 과정 없이 바로 실행 가능한 구조
4. **테스트 친화적**: 단위 테스트 가능한 순수 함수 중심 설계

### 구현된 파일 구조
```
RemoteManager-v4/
├── src/
│   ├── main/                    # Electron 메인 프로세스
│   │   ├── main.js             # 메인 엔트리포인트
│   │   ├── process-detector.js  # 프로세스 감지 (PowerShell/WinAPI)
│   │   └── window-manager.js   # 창 관리 (포커스, 최소화 등)
│   │
│   ├── renderer/               # 렌더러 프로세스
│   │   ├── index.html          # UI 레이아웃
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
│       ├── main.css           # 메인 스타일
│       ├── components.css     # 컴포넌트별 스타일
│       └── themes.css         # 테마 및 색상 시스템
│
├── tests/                     # 테스트 코드
│   ├── unit/                  # 단위 테스트
│   ├── integration/           # 통합 테스트
│   └── e2e/                   # E2E 테스트
│
└── docs/                      # 문서
    ├── ARCHITECTURE.md        # 아키텍처 문서
    ├── API.md                 # API 문서
    └── TROUBLESHOOTING.md     # 문제 해결 가이드
```

## Key Features (Implemented)

### 핵심 기능
1. **프로세스 감지**: PowerShell + Windows API를 통한 원격 프로세스 감지
2. **그룹 관리**: 원격지를 그룹별로 체계적 관리
3. **카테고리 시스템**: 엑스레이, 타서버, 새서버, 구서버 분류
4. **실시간 모니터링**: 연결 상태 추적 및 자동 새로고침
5. **정보 추출**: IP[컴퓨터명] 형태로 복사 기능
6. **윈도우 포커스**: 클릭 한 번으로 해당 원격 창 포커스

### 원격 프로세스 식별 규칙
- **ezHelp**: `ezHelpViewer`이면서 타이틀에 "원격지 IP" 또는 "Relay" 포함
- **TeamViewer**: 타이틀이 "컴퓨터명 - TeamViewer" 패턴
- **제외**: `ezHelpManager`, 단순 `TeamViewer` 타이틀은 관리창이므로 제외

### 데이터 표시 형태
- **ezHelp**: `(46) desktop-6bcogpv[192.168.0.18]`
- **TeamViewer**: `[YSCENTER1_01] TeamViewer`

### 복사 형태
- **ezHelp**: `192.168.0.18[desktop-6bcogpv]`
- **TeamViewer**: `[YSCENTER1_01]`

## Technology Stack

- **플랫폼**: Electron (크로스플랫폼)
- **언어**: JavaScript (ES6 모듈)
- **UI**: HTML/CSS/JavaScript (순수)
- **시스템 연동**: PowerShell + Windows API
- **테스트**: Jest (단위), Playwright (E2E)
- **상태 관리**: Store Pattern (Observer)

## Development Workflow

### 프로젝트 시작하기
```bash
# 아직 코드가 없으므로 v4.0 구조로 새로 시작
mkdir -p src/{main,renderer/{components,store,services,utils},styles}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs

# package.json 생성
npm init -y
npm install electron --save-dev
npm install jest --save-dev
```

### 개발 명령어
```bash
# 의존성 설치
npm install

# 개발 모드 실행 (DevTools 포함)
npm run dev

# 프로덕션 실행
npm start

# 테스트 실행
npm test

# 린트 실행
npm run lint
```

## Implementation Notes

### v3.x에서 v4.0로의 주요 변경사항
1. **1991라인 스파게티 코드** → **모듈화된 컴포넌트**
2. **3가지 키 관리 시스템** → **단일 ID 기반 통합 시스템**
3. **localStorage + 메모리 혼재** → **중앙 집중식 스토어 패턴**
4. **예측 불가능한 버그** → **JSDoc과 테스트로 안정화**

### 핵심 해결 과제
1. **PowerShell 한계**: Get-Process는 최소화된 창 미감지 → EnumWindows API 보완
2. **TeamViewer 다중세션**: 단일 프로세스의 다중 창 → WindowHandle 기반 구분
3. **키 관리 복잡성**: 설정 저장과 히스토리 추적의 서로 다른 키 전략 통합
4. **그룹 데이터 무결성**: 연결 끊김 시 그룹 할당 유지

### 사용자 언어
- 사용자는 한글로 답변을 원함
- PowerShell UTF-8 인코딩으로 한글 프로세스명 정상 표시
- 업무에서 자주 사용하는 IP[컴퓨터명] 형태로 복사 기능 제공

## Development Guidelines

### 코딩 규칙
1. **ES6 모듈 시스템** 사용 (`import`/`export`)
2. **JSDoc** 타입 문서화 필수
3. **순수 함수** 중심 설계 (부작용 최소화)
4. **에러 처리** 모든 비동기 작업에 try-catch
5. **디버깅 로그** 개발 환경에서만 출력

### 테스트 전략
1. **단위 테스트**: 각 서비스와 유틸리티 함수
2. **통합 테스트**: 스토어와 컴포넌트 연동
3. **E2E 테스트**: 주요 사용자 시나리오

### 성능 고려사항
1. **가상 스크롤링**: 대량 프로세스 처리
2. **메모리 최적화**: 불필요한 DOM 노드 최소화
3. **PowerShell 호출 최적화**: 중복 호출 방지

## Reference Documents

자세한 기능 명세와 기존 구현사항은 다음 문서들을 참조:
- `a.md`: 기본 요구사항 및 필요 기능
- `b.md`: v3.x 완전한 구현 문서 (참고용)
- `plan.md`: v4.0 상세 재설계 계획서

## Implementation Details (v4.0 Complete)

### 구현된 주요 컴포넌트

#### 메인 프로세스 (src/main/)
- **main.js**: Electron 메인 프로세스, IPC 핸들러 구현
- **process-detector.js**: spawn 기반 PowerShell + Windows API 프로세스 감지
- **window-manager.js**: Windows API를 통한 창 포커스 및 관리

#### 렌더러 프로세스 (src/renderer/)
- **index.html**: 반응형 UI 레이아웃, 사이드바 + 메인 콘텐츠
- **index.js**: RemoteManagerApp 클래스, 애플리케이션 생명주기 관리
- **preload.js**: CommonJS 기반 IPC 브리지

#### Store Layer (상태 관리)
- **ProcessStore.js**: UUID 기반 프로세스 상태 관리, Observer 패턴
- **GroupStore.js**: localStorage 기반 그룹 데이터 영속화
- **SettingsStore.js**: 중첩 설정 구조 지원, 타입 검증

#### Service Layer (비즈니스 로직)
- **ProcessService.js**: 프로세스 조작, 상태 업데이트, 알림 연동
- **GroupService.js**: 그룹 CRUD, 프로세스 할당 관리
- **KeyManager.js**: 통합 키 관리, Chrome 브라우저 테스트 지원
- **NotificationService.js**: 토스트 알림, 위치 기반 스택 관리

#### UI Components
- **ProcessList.js**: 가상 스크롤링, 필터링, 정렬, 컨텍스트 메뉴
- **Sidebar.js**: 그룹 네비게이션, 접기/펼치기, 그룹 관리
- **StatusBar.js**: 실시간 통계, 연결 상태 표시
- **GroupManager.js**: 모달 기반 그룹 CRUD 인터페이스

#### Styling System
- **main.css**: CSS Grid 기반 레이아웃, 반응형 디자인
- **components.css**: 컴포넌트별 모듈화된 스타일
- **themes.css**: CSS 변수 기반 테마 시스템, 다크모드

### 기술적 특징

#### Chrome 브라우저 테스트 지원
```javascript
// 지원하는 테스트 패턴:
// - "WORKSTATION-02 - TeamViewer - Chrome"
// - "ezHelp - TestPC(Relay) - 원격지 IP : 192.168.1.189(1.2.3.4) - Chrome"
```

#### 안정적인 프로세스 감지
- spawn 기반 PowerShell 실행으로 bash 호환성 문제 해결
- EnumWindows API로 최소화된 창도 감지
- UTF-8 인코딩으로 한글 프로세스명 정상 처리

#### 실시간 상태 추적
- 5초 간격 자동 새로고침
- 연결/재연결/끊김 상태 자동 감지 및 알림
- WindowHandle 기반 TeamViewer 다중세션 구분

## Next Steps (Future Enhancements)

1. **테스트 작성**: Jest 기반 단위 테스트, Playwright E2E 테스트
2. **추가 기능**: 
   - 프로세스 히스토리 로그
   - 고급 필터링 및 검색
   - 설정 UI 개선
   - 키보드 단축키 확장
3. **성능 최적화**: 대량 프로세스 처리 개선
4. **배포**: Electron Builder를 통한 Windows 배포판 생성

v4.0는 기존 v3.x의 1991라인 스파게티 코드를 완전히 재설계하여 모듈화, 테스트 가능성, 확장성을 크게 개선한 완성된 버전입니다.