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

**이전 업데이트 내용들은 이 위에 추가하세요**