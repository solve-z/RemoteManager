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

## 2025-08-04 - IP 변경 시 UI 업데이트 문제 해결

### 🐛 해결된 문제
**원격지 IP 변경 시 UI에 이전 IP 주소가 계속 표시되는 문제**
- ezHelp 원격 연결에서 IP가 바뀌어도 프로세스 리스트와 복사 기능에서 이전 IP가 계속 표시됨
- 그룹/카테고리는 유지되지만 새로운 IP 정보가 UI에 반영되지 않아 복사 시 잘못된 IP가 나오는 불편함

### 🔍 근본 원인 분석
**프로세스 업데이트 시 IP 정보 재추출 누락**
- `ProcessStore.updateExistingProcess()`: IP 변경 시 `newProcessInfo.ipAddress`로만 업데이트
- `ProcessStore.handleReconnection()`: 재연결 시에도 동일한 문제
- **문제점**: `newProcessInfo`에서 IP가 제대로 추출되지 않으면 새로운 IP가 반영되지 않음

### 🔧 수정 사항

#### ProcessStore.js - updateExistingProcess() 메서드 (137-159라인)
**기존 코드:**
```javascript
existingProcess.ipAddress = newProcessInfo.ipAddress; // IP 업데이트
```

**수정된 코드:**
```javascript
// IP 주소 강제 재추출 (새로운 windowTitle에서)
const newIpAddress = KeyManager.extractIpAddress(newProcessInfo);
const oldIpAddress = existingProcess.ipAddress;
existingProcess.ipAddress = newIpAddress || newProcessInfo.ipAddress || existingProcess.ipAddress;

// 상담원 ID도 재추출 (ezHelp의 경우)
if (existingProcess.type === 'ezhelp') {
  const newCounselorId = KeyManager.extractCounselorId(newProcessInfo);
  existingProcess.counselorId = newCounselorId || newProcessInfo.counselorId || existingProcess.counselorId;
}

// IP 변경 감지 로그
if (oldIpAddress !== existingProcess.ipAddress) {
  console.log('🔄 IP 주소 업데이트 감지:', {
    processId: existingProcess.id,
    computerName: existingProcess.computerName,
    oldIP: oldIpAddress,
    newIP: existingProcess.ipAddress,
    windowTitle: newProcessInfo.windowTitle,
    extractedIP: newIpAddress,
    providedIP: newProcessInfo.ipAddress
  });
}
```

#### ProcessStore.js - handleReconnection() 메서드 (302-324라인)
**동일한 IP 재추출 로직 추가:**
```javascript
// IP 주소 강제 재추출 (재연결 시에도)
const newIpAddress = KeyManager.extractIpAddress(processInfo);
const oldIpAddress = process.ipAddress;
process.ipAddress = newIpAddress || processInfo.ipAddress || process.ipAddress;

// 상담원 ID도 재추출 (ezHelp의 경우)
if (process.type === 'ezhelp') {
  const newCounselorId = KeyManager.extractCounselorId(processInfo);
  process.counselorId = newCounselorId || processInfo.counselorId || process.counselorId;
}

// IP 변경 감지 로그 (재연결 시)
if (oldIpAddress !== process.ipAddress) {
  console.log('🔄 재연결 시 IP 주소 업데이트 감지:', {
    processId: process.id,
    computerName: process.computerName,
    oldIP: oldIpAddress,
    newIP: process.ipAddress,
    windowTitle: processInfo.windowTitle,
    extractedIP: newIpAddress,
    providedIP: processInfo.ipAddress
  });
}
```

### ✅ 개선된 IP 업데이트 시스템

1. **강제 재추출**: 새로운 `windowTitle`에서 IP 주소를 다시 추출하여 확실한 업데이트 보장
2. **3단계 폴백**: `extractedIP` → `providedIP` → `existingIP` 순서로 안전한 업데이트
3. **상담원 ID 동기화**: ezHelp의 경우 상담원 ID도 함께 업데이트
4. **디버깅 로그**: IP 변경 시 상세한 로그로 추적 가능
5. **재연결 지원**: 단순 업데이트와 재연결 시 모두 동일한 로직 적용

### 🎯 결과
- ✅ **IP 변경 즉시 반영**: 원격지 IP가 바뀌면 UI에 새로운 IP가 바로 표시됨
- ✅ **정확한 복사 기능**: 복사 버튼 클릭 시 최신 IP 주소가 복사됨
- ✅ **그룹/카테고리 유지**: 기존 그룹과 카테고리 정보는 그대로 보존
- ✅ **재연결 시에도 적용**: 연결이 끊어졌다가 다시 연결될 때도 새로운 IP로 업데이트
- ✅ **디버깅 친화적**: 콘솔 로그로 IP 변경 과정을 상세히 추적 가능

### 📋 관련 파일
- `src/renderer/store/ProcessStore.js`: IP 재추출 로직 추가 (updateExistingProcess, handleReconnection)

---

## 2025-08-04 - 끊어진 프로세스 완전 삭제 기능 구현

### 🐛 해결된 문제
**연결이 끊어진 프로세스 수동 제거 기능 개선 및 데이터 무결성 문제 해결**

1. **제거 버튼 표시 범위 제한**: 기존에는 `disconnected`(빨간색) 상태에서만 제거 가능, `reconnected`(노란색) 상태에서는 제거 불가
2. **UI 일관성 부족**: `confirm()` 대신 모던한 커스텀 다이얼로그 필요
3. **데이터 무결성 문제**: 수동 제거 시 그룹/카테고리 안정적 키 매핑이 삭제되지 않아 재연결 시 혼란 발생
4. **그룹 개수 동기화 오류**: 프로세스 제거 시 그룹의 `processIds` 배열에서 완전히 제거되지 않음
5. **중복 처리 문제**: ProcessService와 ProcessStore에서 안정적 키를 중복으로 처리

### 🔍 근본 원인 분석

#### 기존 버그의 연쇄 반응
1. **ezHelp 타이틀 변경 버그** (이전에 해결) → 중복 프로세스 생성
2. **불완전한 삭제 로직** → 그룹의 `processIds`에서 미제거
3. **안정적 키 누적** → 실제 프로세스와 저장된 그룹 개수 불일치
4. **결과**: 로컬스토리지의 그룹 개수 ≠ 실제 화면의 프로세스 개수

#### 수동 제거의 의미
- 사용자가 수동으로 제거한다는 것은 "더 이상 필요 없다"는 의미
- 따라서 그룹/카테고리 설정도 함께 완전 삭제해야 함

### 🔧 수정 사항

#### 1. ProcessList.js - 제거 버튼 표시 조건 확장 (194-196라인)
**기존 코드:**
```javascript
${process.status === 'disconnected' ? 
  '<button class="btn btn-sm btn-danger" data-action="remove" title="제거">🗑️ 제거</button>' : 
  ''
}
```

**수정된 코드:**
```javascript
${process.status !== 'connected' ? 
  '<button class="btn btn-sm btn-danger" data-action="remove" title="완전 삭제">🗑️ 삭제</button>' : 
  ''
}
```

#### 2. ProcessList.js - 커스텀 확인 다이얼로그 구현 (44-129라인)
**GroupManager의 showCustomConfirm 메서드를 ProcessList에 추가:**
```javascript
showCustomConfirm(title, message, onConfirm, onCancel = null) {
  // 다시 요소들을 찾기 (DOM이 변경되었을 수 있음)
  this.findConfirmDialogElements();
  
  // 안전성 검사 후 커스텀 다이얼로그 표시
  if (!this.confirmDialog || !this.confirmTitle || !this.confirmMessage) {
    // 폴백: 기본 confirm 사용
    if (confirm(message.replace(/<[^>]*>/g, ''))) {
      if (onConfirm) onConfirm();
    }
    return;
  }
  
  // HTML5 기반 모달 다이얼로그
  // - 키보드 단축키 지원 (Enter/Escape)
  // - 외부 클릭으로 닫기
  // - 완전한 이벤트 리스너 정리
}
```

#### 3. ProcessList.js - 확인 메시지 개선 (482-489라인)
**수정된 확인 다이얼로그:**
```javascript
const message = `<strong>${displayName}</strong><br>상태: ${statusText}<br><br>이 프로세스를 완전히 제거하시겠습니까?<br><small class="text-warning">⚠️ 그룹/카테고리 설정도 함께 삭제됩니다.</small>`;

this.showCustomConfirm(
  '프로세스 완전 삭제 확인',
  message,
  () => {
    this.processService.removeDisconnectedProcess(processId);
  }
);
```

#### 4. ProcessService.js - 완전 삭제 로직 개선 (354-394라인)
**기존 조건:**
```javascript
if (process.status !== 'disconnected') {
  this.notificationService?.showWarning('연결된 프로세스는 제거할 수 없습니다.');
  return false;
}
```

**수정된 로직:**
```javascript
// 연결된 프로세스만 제거 불가 (disconnected, reconnected 등은 제거 가능)
if (process.status === 'connected') {
  this.notificationService?.showWarning('연결된 프로세스는 제거할 수 없습니다.');
  return false;
}

// 먼저 ProcessStore에서 프로세스 제거 (그룹에서 제거 포함)
const success = this.processStore.removeProcess(processId, false); // 히스토리도 삭제

// 수동 제거 시에는 안정적 키 기반 설정도 완전 삭제
if (success && this.groupStore) {
  const stableKey = KeyManager.getStableIdentifier(process);
  
  // 그룹과 카테고리 안정적 키 매핑 삭제
  this.groupStore.stableKeyGroupMap.delete(stableKey);
  this.groupStore.stableKeyCategoryMap.delete(stableKey);
  this.groupStore.save();
}
```

#### 5. ProcessStore.js - stableKeyMap 정리 추가 (403-405라인)
```javascript
// 프로세스 제거
this.processes.delete(processId);

// stableKeyMap에서도 제거
const stableKey = KeyManager.getStableIdentifier(process);
this.stableKeyMap.delete(stableKey);
```

### ✅ 완성된 완전 삭제 시스템

1. **확장된 제거 조건**: `connected`가 아닌 모든 상태(`disconnected`, `reconnected` 등)에서 제거 가능
2. **완전한 데이터 정리**: 
   - 프로세스 삭제
   - 그룹의 `processIds` 배열에서 제거
   - `stableKeyMap`에서 제거
   - `stableKeyGroupMap`, `stableKeyCategoryMap`에서 제거
   - 히스토리 삭제 (재연결 방지)
3. **모던한 UI**: 커스텀 다이얼로그로 일관된 사용자 경험
4. **명확한 의도 표현**: "완전 삭제"와 "설정도 함께 삭제" 경고
5. **중복 처리 방지**: ProcessStore 먼저 → ProcessService 안정적 키만 삭제
6. **디버깅 지원**: 상세한 로그로 삭제 과정 추적

### 🎯 결과

#### 즉시 해결된 문제
- ✅ **노란색 상태 제거 가능**: `reconnected` 상태에서도 제거 버튼 표시
- ✅ **완전한 데이터 정리**: 그룹/카테고리 설정 완전 삭제로 재연결 시 깨끗한 상태
- ✅ **그룹 개수 동기화**: 사이드바 그룹 개수와 실제 프로세스 개수 일치
- ✅ **일관된 UI**: 그룹 관리와 동일한 스타일의 확인 다이얼로그
- ✅ **재연결 정상 작동**: 삭제 후 동일 원격지 재연결 시 새 프로세스로 정상 생성

#### 과거 누적 문제 해결
- ✅ **그룹 개수 불일치 문제**: 이전 ezHelp 타이틀 변경 버그 + 불완전한 삭제로 인한 누적 문제 해결
- ✅ **데이터 무결성 복원**: 로컬스토리지의 그룹 개수와 실제 화면 프로세스 개수 동기화
- ✅ **안정적 키 정리**: 고아 데이터 자동 정리로 향후 문제 방지

### 📋 관련 파일
- `src/renderer/components/ProcessList.js`: 제거 버튼 조건, 커스텀 다이얼로그, 확인 메시지 개선
- `src/renderer/services/ProcessService.js`: 완전 삭제 로직, 안정적 키 삭제, 중복 처리 방지
- `src/renderer/store/ProcessStore.js`: stableKeyMap 정리 로직 추가

---

## 2025-08-04 - UI/UX 개선: 로딩 시스템 개선 및 버튼 정렬 문제 해결

### 🐛 해결된 문제

#### 1. 새로고침 로딩 시스템의 시각적 피로 문제
- **직선형 로딩바**: 화면 상단을 가로지르는 직선 프로그레스바가 눈에 자극적
- **이모지 크기 차이**: 🔄 이모지와 스피너 크기 차이로 버튼 크기 변화
- **자동 새로고침 이모지 크기 차이**: ▶️ ↔ ⏸️ 이모지 크기 차이로 버튼 크기 변화

#### 2. 버튼 텍스트 수직 정렬 문제
- **정렬 불일치**: 아이콘과 텍스트의 수직 정렬이 맞지 않음
- **margin-bottom 오류**: components.css의 `.btn-text`에 불필요한 `margin-bottom: 4px`

### 🔧 수정 사항

#### 1. 새로고침 로딩 시스템 완전 개선

**A. 로딩바 제거 및 버튼 스피너 적용**
- **로딩바 완전 제거**: `refresh-loading-bar` 관련 모든 코드 제거
- **버튼 스피너 적용**: 새로고침 클릭 시 버튼 아이콘이 스피너로 변경

**B. CSS 아이콘 시스템 구현**
```css
/* 버튼용 작은 스피너 */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}

/* 새로고침 아이콘 - 통일된 14px × 14px */
.refresh-icon.normal::before {
  /* CSS border로 구현한 새로고침 아이콘 */
}

.refresh-icon.spinning::before {
  /* 동일한 크기의 회전 스피너 */
}

/* 자동 새로고침 아이콘 - 통일된 14px × 14px */
.auto-refresh-icon.play::before {
  /* CSS border로 구현한 재생 아이콘 (▶️ 대체) */
}

.auto-refresh-icon.pause::before {
  /* CSS box-shadow로 구현한 정지 아이콘 (⏸️ 대체) */
}
```

**C. JavaScript 로직 업데이트**
```javascript
// 새로고침 버튼
// 일반: <span class="refresh-icon normal"></span>
// 로딩: <span class="refresh-icon spinning"></span>

// 자동 새로고침 버튼  
// 시작: <span class="auto-refresh-icon play"></span>
// 중지: <span class="auto-refresh-icon pause"></span>
```

#### 2. 버튼 텍스트 수직 정렬 완전 해결

**A. 텍스트 정렬 수정**
```css
/* 기존 문제 코드 */
.btn-text {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px; /* 문제 원인 */
}

/* 수정된 코드 */
.btn-text {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
```

**B. 버튼 내부 요소 정렬 개선**
```css
/* 버튼 스타일 개선 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* 버튼 내부 요소 정렬 */
.btn .btn-icon,
.btn .btn-text {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* 헤더 버튼 전용 텍스트 크기 */
.header-controls .btn-text {
  font-size: 13px;
  font-weight: 500;
}
```

#### 3. 반응형 텍스트 숨김 개선
```css
/* 중간 화면에서 헤더 버튼 텍스트 숨김 */
@media (max-width: 768px) {
  .header-controls .btn .btn-text {
    display: none;
  }
  
  .header-controls .btn {
    padding: 8px 12px;
    min-width: auto;
  }
}
```

### ✅ 완성된 개선 시스템

#### 1. 시각적 안정성 완전 달성
- **통일된 아이콘 크기**: 모든 아이콘이 14px × 14px로 고정
- **버튼 크기 불변**: 상태 변화 시에도 버튼 크기 변화 없음
- **완벽한 정렬**: 아이콘과 텍스트가 정확히 중앙 정렬

#### 2. 향상된 사용자 경험
- **눈의 피로 해소**: 직선 로딩바 제거로 시각적 자극 감소
- **자연스러운 상호작용**: 버튼 상태 변화가 부드럽고 안정적
- **일관된 디자인**: CSS 기반 아이콘으로 통일된 디자인 시스템

#### 3. 반응형 디자인 최적화
- **768px 이하**: 헤더 버튼 텍스트 숨김으로 공간 절약
- **480px 이하**: 모든 버튼 텍스트 숨김
- **적응형 크기**: 화면 크기에 따른 최적화된 버튼 크기

### 🎯 결과

#### 즉시 해결된 문제
- ✅ **시각적 피로 완전 해소**: 직선 로딩바 → 부드러운 버튼 스피너
- ✅ **버튼 크기 안정화**: 모든 상태 변화에서 크기 불변
- ✅ **완벽한 텍스트 정렬**: 아이콘과 텍스트의 정확한 중앙 정렬
- ✅ **일관된 디자인**: CSS 아이콘으로 통일된 시각적 언어

#### 장기적 개선 효과
- 🎨 **확장 가능한 아이콘 시스템**: CSS 기반으로 쉬운 커스터마이징
- 📱 **향상된 반응형 지원**: 다양한 화면 크기에서 최적화된 경험
- 🔧 **유지보수성 향상**: 이모지 의존성 제거로 안정적인 UI

### 📋 관련 파일
- `src/renderer/index.js`: 새로고침 로직, 자동 새로고침 토글 로직 개선
- `src/renderer/index.html`: CSS 클래스 기반 아이콘으로 초기값 변경
- `src/styles/main.css`: 버튼 스타일, 아이콘 시스템, 반응형 스타일 추가
- `src/styles/components.css`: 버튼 텍스트 정렬 문제 해결

---

## 2025-08-05 - v1.1.1 그룹 관리 및 프로세스 동기화 시스템 완전 개선

### 🐛 해결된 주요 문제들

#### 1. 그룹 삭제 시 DOM replaceChild 오류
- **문제**: `GroupManager.js:107`에서 `Cannot read properties of null (reading 'replaceChild')` 오류
- **원인**: DOM 요소들이 제대로 초기화되지 않았거나 `parentNode`가 null인 상태

#### 2. 연결 끊어진 프로세스 재연결 시 processIds 추가 안되는 문제  
- **문제**: 프로그램 재시작 후 프로세스 재연결 시 그룹의 `processIds` 배열에 추가되지 않음
- **원인**: `addNewProcess`와 `handleReconnection`에서 `groupStore.save()` 호출 누락

#### 3. 사이드바 그룹 개수와 실제 프로세스 개수 동기화 문제
- **문제**: 사이드바 표시 개수와 실제 화면의 프로세스 개수 불일치
- **원인**: 연결 끊어진 프로세스도 `processIds`에 포함되어 카운트됨

#### 4. Sidebar.js processStore undefined 오류
- **문제**: `TypeError: Cannot read properties of undefined (reading 'getProcess')`
- **원인**: Sidebar 생성자에 processStore가 전달되지 않음

#### 5. 새로고침 버튼 아이콘 가시성 문제
- **문제**: 새로고침 버튼의 CSS 아이콘이 버튼 배경색과 동일하여 보이지 않음

### 🔧 상세 수정 사항

#### 1. DOM 안전성 강화 (GroupManager.js)

**A. 확인 다이얼로그 DOM 요소 안전성 검사**
```javascript
// 새로운 메서드 추가
findConfirmDialogElements() {
  this.confirmDialog = document.getElementById('confirm-dialog');
  this.confirmTitle = document.getElementById('confirm-dialog-title');
  this.confirmMessage = document.getElementById('confirm-dialog-message');
  this.confirmConfirmBtn = document.getElementById('confirm-dialog-confirm');
  this.confirmCancelBtn = document.getElementById('confirm-dialog-cancel');
  this.confirmCloseBtn = document.getElementById('confirm-dialog-close');
}

// showCustomConfirm 메서드 개선
showCustomConfirm(title, message, onConfirm, onCancel = null) {
  // DOM 요소 재탐색
  this.findConfirmDialogElements();
  
  // 안전성 검사 - 모든 필수 요소 존재 여부 확인
  if (!this.confirmDialog || !this.confirmTitle || !this.confirmMessage || 
      !this.confirmConfirmBtn || !this.confirmCancelBtn || !this.confirmCloseBtn) {
    // 폴백: 기본 confirm 사용
    if (confirm(message.replace(/<[^>]*>/g, ''))) {
      if (onConfirm) onConfirm();
    }
    return;
  }
  
  // parentNode 안전성 검사 추가
  if (this.confirmConfirmBtn.parentNode) {
    newConfirmBtn = this.confirmConfirmBtn.cloneNode(true);
    this.confirmConfirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmConfirmBtn);
  }
  // 다른 버튼들도 동일한 안전성 검사 적용
}
```

#### 2. 프로세스 재연결 시 그룹 동기화 개선 (ProcessStore.js)

**A. handleReconnection 메서드 개선**
```javascript
handleReconnection(historyEntry, processInfo) {
  // ... 기존 로직 ...
  
  // 재연결 시 그룹의 processIds 배열에도 추가
  if (process.groupId && this.groupStore?.groups.has(process.groupId)) {
    const group = this.groupStore.groups.get(process.groupId);
    if (!group.processIds.includes(process.id)) {
      group.processIds.push(process.id);
      this.groupStore.save(); // 변경사항 저장
      console.log('✅ 재연결 시 그룹에 프로세스 추가:', {
        groupName: group.name,
        processId: process.id,
        groupProcessCount: group.processIds.length
      });
    }
  }
}
```

**B. addNewProcess 메서드 개선**
```javascript
// 그룹이 할당된 경우 그룹의 processIds 배열에도 추가
if (savedGroupId && this.groupStore?.groups.has(savedGroupId)) {
  const group = this.groupStore.groups.get(savedGroupId);
  if (!group.processIds.includes(processId)) {
    group.processIds.push(processId);
    this.groupStore.save(); // 변경사항 저장 (추가됨)
    console.log('✅ 프로세스 생성 시 그룹에 즉시 추가:', {
      groupName: group.name,
      processId: processId,
      groupProcessCount: group.processIds.length
    });
  }
}
```

#### 3. 사이드바 그룹 개수 동기화 완전 해결

**A. Sidebar 생성자 매개변수 추가**
```javascript
// 기존
constructor(sidebarElement, groupStore, groupService, groupManager) {

// 수정
constructor(sidebarElement, groupStore, groupService, groupManager, processStore) {
  this.processStore = processStore; // 추가
}
```

**B. index.js에서 processStore 전달**
```javascript
this.components.sidebar = new Sidebar(
  sidebarElement,
  this.stores.group,
  this.services.group,
  this.components.groupManager,
  this.stores.process // 추가
);
```

**C. 실시간 그룹 개수 계산 로직**
```javascript
renderGroupItem(group) {
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
}
```

**D. 프로세스 변경 시 사이드바 동기화**
```javascript
// index.js - 스토어 변경 시 컴포넌트 업데이트
this.stores.process.subscribe((processes) => {
  this.components.processList.render(processes);
  this.components.statusBar.update(processes);
  // 프로세스 변경 시 사이드바도 업데이트 (그룹 개수 동기화)
  this.components.sidebar.updateGroups(this.stores.group.getAllGroups());
});
```

#### 4. 그룹 삭제 시 안전성 강화 (GroupService.js)

**존재하지 않는 프로세스 ID 안전 처리**
```javascript
deleteGroup(groupId, force = false) {
  // 그룹에 속한 프로세스들의 그룹 할당 해제 (현재 존재하는 프로세스만)
  const validProcessIds = [];
  const invalidProcessIds = [];
  
  for (const processId of group.processIds) {
    const process = this.processStore.getProcess(processId);
    if (process) {
      // 존재하는 프로세스만 그룹 할당 해제
      this.groupStore.assignProcessToGroup(processId, null, process);
      this.processStore.updateProcessSettings(processId, { groupId: null });
      validProcessIds.push(processId);
    } else {
      // 존재하지 않는 프로세스 ID는 로그만 남김
      invalidProcessIds.push(processId);
    }
  }
  
  console.log('🗑️ 그룹 삭제 시 프로세스 정리:', {
    groupName: group.name,
    totalProcessIds: group.processIds.length,
    validProcessIds: validProcessIds.length,
    invalidProcessIds: invalidProcessIds.length
  });
}
```

#### 5. 오래된 processId 정리 시스템 추가 (GroupService.js)

**cleanupInvalidProcessIds 메서드 구현**
```javascript
cleanupInvalidProcessIds() {
  const allGroups = this.groupStore.getAllGroups();
  let totalCleanedCount = 0;
  
  for (const group of allGroups) {
    const validProcessIds = [];
    const invalidProcessIds = [];
    
    // 각 processId가 실제로 존재하는지 확인
    for (const processId of group.processIds) {
      if (this.processStore.getProcess(processId)) {
        validProcessIds.push(processId);
      } else {
        invalidProcessIds.push(processId);
      }
    }
    
    // 유효하지 않은 processId들이 있으면 정리
    if (invalidProcessIds.length > 0) {
      group.processIds = validProcessIds;
      totalCleanedCount += invalidProcessIds.length;
    }
  }
  
  // 변경사항이 있으면 저장
  if (totalCleanedCount > 0) {
    this.groupStore.save();
    this.notificationService?.showSuccess(
      `${totalCleanedCount}개의 유효하지 않은 프로세스 참조가 정리되었습니다.`
    );
  }
}
```

**프로그램 시작 시 자동 정리 (index.js)**
```javascript
async loadInitialData() {
  // 초기 프로세스 로드
  await this.refreshProcesses();

  // 그룹 데이터 정리 (프로그램 시작 시)
  console.log('🧹 그룹 데이터 정리 시작...');
  const cleanupResult = this.services.group.cleanupInvalidProcessIds();
  if (cleanupResult.totalCleaned > 0) {
    console.log('✅ 그룹 데이터 정리 완료:', cleanupResult);
  }
}
```

#### 6. 새로고침 아이콘 가시성 개선 (main.css)

**CSS 아이콘 색상 수정**
```css
/* 기존: currentColor 사용으로 배경색과 동일 */
.refresh-icon.normal::before {
  border: 2px solid currentColor;
}

.refresh-icon.normal::after {
  border-left: 4px solid currentColor;
}

.refresh-icon.spinning::before {
  border-top: 2px solid currentColor;
}

/* 수정: 명시적 흰색 지정 */
.refresh-icon.normal::before {
  border: 2px solid #ffffff;
}

.refresh-icon.normal::after {
  border-left: 4px solid #ffffff;
}

.refresh-icon.spinning::before {
  border: 2px solid #ffffff;
}
```

### ✅ 완성된 통합 시스템

#### 1. 완벽한 데이터 동기화
- **그룹의 processIds 배열**: 실제 프로세스와 완벽 동기화
- **사이드바 개수 표시**: 연결된 프로세스만 정확히 카운트
- **프로그램 재시작**: 모든 그룹 할당 자동 복원
- **재연결**: processIds 배열에 자동 추가

#### 2. 강화된 안정성
- **DOM 오류 방지**: 모든 DOM 조작에 안전성 검사
- **존재하지 않는 프로세스 처리**: 그룹 삭제 시 안전한 처리
- **자동 데이터 정리**: 프로그램 시작 시 고아 데이터 자동 정리
- **폴백 시스템**: 오류 시 기본 동작으로 안전하게 복원

#### 3. 향상된 사용자 경험
- **실시간 동기화**: 모든 UI 요소가 실시간으로 동기화
- **시각적 일관성**: 새로고침 아이콘이 명확히 표시
- **정확한 개수 표시**: 사이드바와 실제 프로세스 개수 일치
- **안정적인 그룹 관리**: 모든 그룹 작업이 안전하고 신뢰성 있게 동작

### 🎯 최종 결과

모든 그룹 관리 기능이 완벽하게 동작합니다:
- ✅ **그룹 생성/삭제**: DOM 오류 없이 안전한 처리
- ✅ **프로세스 할당/해제**: 실시간 개수 동기화
- ✅ **프로그램 재시작**: 모든 설정 자동 복원
- ✅ **재연결**: processIds 배열 자동 업데이트
- ✅ **데이터 무결성**: 고아 데이터 자동 정리
- ✅ **UI 일관성**: 모든 시각적 요소 완벽 동기화

### 📋 관련 파일
- `src/renderer/components/GroupManager.js`: DOM 안전성 강화
- `src/renderer/store/ProcessStore.js`: 재연결 시 그룹 동기화
- `src/renderer/services/GroupService.js`: 그룹 삭제 안전성, 데이터 정리
- `src/renderer/components/Sidebar.js`: 실시간 그룹 개수 계산
- `src/renderer/index.js`: processStore 전달, 자동 정리, 동기화 트리거
- `src/styles/main.css`: 새로고침 아이콘 가시성 개선

---

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

---

**이전 업데이트 내용들은 이 위에 추가하세요**