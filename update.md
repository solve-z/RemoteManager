# RemoteManager 업데이트 로그

## 2025-08-04 - ezHelp 타이틀 변경 시 프로세스 중복 인식 문제 해결

### 🐛 해결된 문제
**ezHelp 원격 제어 상태 변경 시 새로운 프로세스로 잘못 인식하는 문제**
- 원격 제어 잠김 시: `"ezHelp - dentweb-svr 잠김(Relay)"` → 새로운 원격으로 인식
- 화면 녹화 중: `"ezHelp - dentweb-svr(Relay) - ... (화면 녹화 중입니다.)"` → 기존 라벨 유지 필요
- 결과: 기존 설정한 라벨과 그룹 정보가 사라지고 새로운 프로세스로 생성됨

### 🔍 근본 원인 분석
**컴퓨터명 추출 정규식의 한계**
- `KeyManager.js`와 `process-detector.js` 모두 동일한 문제
- 기존 정규식: `/ezHelp - ([^(]+)/` → `"잠김"` 텍스트 포함하여 추출
- 예시: `"dentweb-svr 잠김"` vs `"dentweb-svr"` → 다른 컴퓨터로 인식

### 🔧 수정 사항

**개선된 단계별 패턴 매칭 구현:**

#### KeyManager.js (200-215라인)
```javascript
// 패턴 1: "ezHelp - 컴퓨터명 잠김(Relay)" 형태
let match = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\s+잠김\(/);
if (match) {
  return match[1].trim();
}

// 패턴 2: "ezHelp - 컴퓨터명(Relay)" 형태 (정상)
match = windowTitle.match(/ezHelp - ([^(\s]+(?:-[^(\s]+)*)\(/);
if (match) {
  return match[1].trim();
}
```

#### process-detector.js (340-355라인)
동일한 로직으로 일관성 있게 수정

### ✅ 검증 결과
모든 ezHelp 상태 변화에서 올바른 컴퓨터명 추출:
- `dentweb-svr(Relay)` → `dentweb-svr` ✅
- `dentweb-svr 잠김(Relay)` → `dentweb-svr` ✅ (기존: `dentweb-svr 잠김` ❌)
- `WORK-STATION-01 잠김(Relay)` → `WORK-STATION-01` ✅

### 🎯 결과
- ✅ 원격 제어 잠김/해제 시 기존 프로세스로 정확히 인식
- ✅ 화면 녹화 시작/종료 시에도 동일한 컴퓨터명 유지  
- ✅ 사용자가 설정한 라벨과 그룹 정보 완벽 보존
- ✅ 복잡한 컴퓨터명(하이픈 포함)도 정확히 처리

### 📋 관련 파일
- `src/renderer/services/KeyManager.js`: 컴퓨터명 추출 로직 개선
- `src/main/process-detector.js`: PowerShell 출력 파싱 로직 개선

---

## 2025-08-04 - UI 동기화 및 하이라이팅 문제 해결

### 🐛 해결된 문제
1. **그룹 라벨 색상과 프로세스 리스트 그룹 배지 색상 동기화 문제**
   - 사이드바의 그룹 라벨 색상과 프로세스 리스트에 표시되는 그룹 배지의 색상이 일치하지 않는 문제

2. **사이드바 네비게이션과 그룹 선택 시 중복 하이라이팅 문제**
   - 네비게이션 항목과 그룹 항목이 동시에 활성화되어 두 곳 모두 하이라이팅되는 문제
   - 마지막에 클릭한 곳만 활성화되어야 하는데 기존에는 둘 다 활성 상태로 유지됨

### 🔍 분석 결과
1. **그룹 색상 동기화 문제**:
   - `Sidebar.js`의 `renderGroupItem()` 함수에서는 그룹 색상을 올바르게 적용
   - `ProcessList.js`의 `getGroupBadge()` 함수에서는 그룹 색상 정보를 사용하지 않음

2. **중복 하이라이팅 문제**:
   - `handleNavigation()` 함수에서 특정 조건에서만 그룹 선택 해제
   - `selectGroup()` 함수에서 네비게이션 링크의 active 상태를 해제하지 않음

### 🔧 수정 사항

#### ProcessList.js (279-289라인)
**기존 코드:**
```javascript
getGroupBadge(groupId) {
  if (!groupId) {
    return '';
  }

  // 그룹 서비스에서 실제 그룹 정보 가져오기
  const group = this.groupService.groupStore.getGroup(groupId);
  const groupName = group ? group.name : groupId.slice(-8);
  
  return `<span class="group-badge">${groupName}</span>`;
}
```

**수정된 코드:**
```javascript
getGroupBadge(groupId) {
  if (!groupId) {
    return '';
  }

  // 그룹 서비스에서 실제 그룹 정보 가져오기
  const group = this.groupService.groupStore.getGroup(groupId);
  const groupName = group ? group.name : groupId.slice(-8);
  const colorStyle = group && group.color ? `style="background-color: ${group.color};"` : '';
  
  return `<span class="group-badge" ${colorStyle}>${groupName}</span>`;
}
```

#### Sidebar.js (155-186라인)
**기존 코드:**
```javascript
handleNavigation(clickedLink) {
  // 모든 링크에서 active 클래스 제거
  const navLinks = this.element.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));

  // 클릭된 링크에 active 클래스 추가
  clickedLink.classList.add('active');

  // 그룹 선택 해제 (원격 프로세스 탭으로 이동할 때)
  if (clickedLink.id === 'nav-processes') {
    this.clearGroupSelection();
    // 프로세스 필터 초기화 이벤트 발생
    const clearFilterEvent = new CustomEvent('clear-group-filter');
    window.dispatchEvent(clearFilterEvent);
  }
  // ... 나머지 코드
}
```

**수정된 코드:**
```javascript
handleNavigation(clickedLink) {
  // 모든 링크에서 active 클래스 제거
  const navLinks = this.element.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));

  // 클릭된 링크에 active 클래스 추가
  clickedLink.classList.add('active');

  // 그룹 선택 해제 (네비게이션 항목 클릭 시 항상 그룹 선택 해제)
  this.clearGroupSelection();

  // 프로세스 필터 초기화 이벤트 발생 (원격 프로세스 탭으로 이동할 때)
  if (clickedLink.id === 'nav-processes') {
    const clearFilterEvent = new CustomEvent('clear-group-filter');
    window.dispatchEvent(clearFilterEvent);
  }
  // ... 나머지 코드
}
```

#### Sidebar.js (437-465라인)
**기존 코드:**
```javascript
selectGroup(groupId) {
  // 그룹 아이템 활성 상태 업데이트
  const groupItems = this.element.querySelectorAll('.group-item');
  groupItems.forEach(item => {
    if (item.dataset.groupId === groupId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  // ... 나머지 코드
}
```

**수정된 코드:**
```javascript
selectGroup(groupId) {
  // 네비게이션 링크 active 상태 해제 (그룹 선택 시 네비게이션 선택 해제)
  const navLinks = this.element.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));

  // 그룹 아이템 활성 상태 업데이트
  const groupItems = this.element.querySelectorAll('.group-item');
  groupItems.forEach(item => {
    if (item.dataset.groupId === groupId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  // ... 나머지 코드
}
```

### ✅ 완성된 UI 동기화 시스템

1. **그룹 색상 동기화**:
   - 사이드바 그룹 라벨과 프로세스 리스트 그룹 배지가 동일한 색상으로 표시
   - 그룹 색상 변경 시 모든 UI 요소에 자동 반영

2. **상호 배타적 하이라이팅**:
   - 네비게이션 항목 클릭 시 → 모든 그룹 선택 해제
   - 그룹 항목 클릭 시 → 모든 네비게이션 선택 해제
   - 마지막에 클릭한 곳만 활성 상태 유지

### 🎯 결과
- 그룹 라벨과 프로세스 리스트의 그룹 배지 색상이 완벽하게 동기화됩니다
- 네비게이션과 그룹 선택이 상호 배타적으로 작동하여 하나만 활성화됩니다
- 사용자 경험이 더욱 직관적이고 일관성 있게 개선되었습니다

### 📋 관련 파일
- `src/renderer/components/ProcessList.js`: 그룹 배지 색상 동기화 로직 추가
- `src/renderer/components/Sidebar.js`: 상호 배타적 하이라이팅 로직 수정

---

## 2025-08-04 - 카테고리 지속성 문제 해결

### 🐛 해결된 문제
- **프로그램 재시작 시 기존 프로세스들의 카테고리가 유지되지 않는 문제**
- 그룹 정보는 `stableKeyGroupMap`으로 해결되었지만, 카테고리는 안정적 키 기반 저장이 누락되어 있었음

### 🔍 분석 결과
- `stableKeyCategoryMap`은 이미 GroupStore.js에 구현되어 있었음
- 프로세스 생성 시 카테고리 복원 로직도 ProcessStore.js에 구현되어 있었음
- **문제점**: ProcessService.js의 `setProcessCategory()` 메서드가 안정적 키 기반 저장을 사용하지 않음

### 🔧 수정 사항

#### ProcessService.js (296-340라인)
**기존 코드:**
```javascript
setProcessCategory(processId, category) {
  // 단순히 프로세스 설정만 업데이트 - 안정적 키 저장 없음
  const success = this.processStore.updateProcessSettings(processId, {
    category: category || null,
  });
}
```

**수정된 코드:**
```javascript
setProcessCategory(processId, category) {
  const process = this.processStore.getProcess(processId);
  
  // 1. 프로세스 설정 업데이트
  const success = this.processStore.updateProcessSettings(processId, {
    category: category || null,
  });

  // 2. 안정적 키 기반으로 카테고리 저장 (그룹과 동일한 방식)
  if (this.groupStore) {
    this.groupStore.setCategoryByStableKey(process, category);
    console.log('💾 카테고리 안정적 키 저장:', {
      processId: processId,
      category: category,
      stableKey: KeyManager.getStableIdentifier(process),
      computerName: process.computerName
    });
  }
}
```

### ✅ 완성된 카테고리 지속성 시스템

1. **저장**: `ProcessService.setProcessCategory()` → `GroupStore.setCategoryByStableKey()`
2. **영속화**: localStorage의 `stableKeyCategoryMap`에 저장
3. **복원**: 프로세스 생성 시 `ProcessStore.addNewProcess()`에서 자동 복원
4. **키 방식**: 컴퓨터명 기반 안정적 식별자 (`ezhelp_desktop-6bcogpv`, `teamviewer_YSCENTER1_01`)

### 🎯 결과
이제 사용자가 ezHelp/TeamViewer 원격 프로세스에 설정한 카테고리(엑스레이, 타서버, 새서버, 구서버)가 프로그램을 재시작해도 완벽하게 유지됩니다.

### 📋 관련 파일
- `src/renderer/services/ProcessService.js`: 카테고리 설정 시 안정적 키 저장 로직 추가
- `src/renderer/store/GroupStore.js`: 기존 `stableKeyCategoryMap` 시스템 활용
- `src/renderer/store/ProcessStore.js`: 기존 카테고리 복원 로직 활용

---

**이전 업데이트 내용들은 이 위에 추가하세요**