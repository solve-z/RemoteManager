# RemoteManager 업데이트 로그

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