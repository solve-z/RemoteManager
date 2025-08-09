feat(Process): 다중 세션 재연결 로직 및 충돌 처리 안정화

동일 컴퓨터 이름으로 다중 원격 세션을 생성하고 새로고침 시, 재연결에 실패하고 불필요한 충돌 다이얼로그가 재발생하는 문제를 해결합니다.

### 문제 원인

1.  **외부 상태의 한계**: 애플리케이션 UI에 '#2'를 표시하더라도 실제 Windows 창(`MainWindowTitle`)의 제목은 변경되지 않았습니다. 이로 인해 새로고침 시 `process-detector`는 이름이 동일한 여러 창을 감지하여 `multipleId` 정보를 복원할 수 없었습니다.
2.  **"자기 자신과의 충돌"**: `multipleId`가 복원되지 않아 잘못된 `stableKey`가 계산되었고, 이로 인해 `ProcessStore`가 재연결 대상을 새로운 충돌로 오인하여 불필요한 다이얼로그를 반복적으로 표시했습니다.

### 해결 방안

애플리케이션의 "내부 상태"를 활용하여 외부 상태의 한계를 극복하는 방식으로 로직을 전면 수정했습니다.

-   **`ProcessStore`에 `handleToMultipleIdMap` 추가**:
    -   `WindowHandle`을 키로, `multipleId`를 값으로 하는 "기억 저장소"를 도입했습니다.
    -   사용자가 충돌 다이얼로그에서 "다른 컴퓨터"를 선택하면, 생성된 새 프로세스의 `WindowHandle`과 `multipleId`를 이 맵에 기록합니다.

-   **`KeyManager.normalizeProcessInfo` 로직 강화**:
    -   이제 "날것"의 프로세스 정보를 정규화할 때, 창 제목을 파싱하기 전에 먼저 `handleToMultipleIdMap`을 조회합니다.
    -   맵에 `WindowHandle`이 기록되어 있으면, 해당 `multipleId`를 즉시 복원하여 완전한 `processInfo` 객체를 생성합니다.

-   **`ProcessService` 역할 수정**:
    -   `updateProcessStatuses` 함수가 `ProcessStore`로부터 `handleToMultipleIdMap`을 받아 `KeyManager.normalizeProcessInfo`에 전달하도록 수정하여, 데이터 정규화 과정에 "기억"이 반영되도록 했습니다.

### 기대 효과

-   다중 세션으로 생성된 원격 프로세스가 새로고침 후에도 `multipleId`를 잃지 않고 정확하게 식별됩니다.
-   재연결 로직이 정상적으로 동작하여 더 이상 불필요한 충돌 다이얼로그가 발생하지 않습니다.
-   전체적인 프로세스 식별 및 상태 관리 로직의 안정성이 크게 향상되었습니다.