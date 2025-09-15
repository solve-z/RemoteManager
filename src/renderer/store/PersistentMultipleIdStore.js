/**
 * PersistentMultipleIdStore - multipleId 매핑 영구 저장소
 * handleToMultipleIdMap의 영구 보존을 통해 프로그램 재시작 후에도
 * 다중 세션의 multipleId 정보를 복원할 수 있도록 합니다.
 */

export class PersistentMultipleIdStore {
  constructor() {
    // 기본 매핑: windowHandle -> multipleId
    this.handleToMultipleIdMap = new Map();

    // 안정적 매핑: "stableKey_windowHandle" -> multipleId (충돌 방지용)
    this.stableKeyHandleMap = new Map();

    // localStorage 키
    this.storageKey = 'remotemanager_multipleids_v1';

    // 자동 정리를 위한 타임스탬프 저장
    this.handleTimestamps = new Map(); // windowHandle -> timestamp

    this.load();

    console.log('✅ PersistentMultipleIdStore 초기화:', {
      handleMappings: this.handleToMultipleIdMap.size,
      stableKeyMappings: this.stableKeyHandleMap.size,
    });
  }

  /**
   * multipleId 매핑 저장
   * @param {string} stableKey - 안정적 식별자
   * @param {number|string} windowHandle - 윈도우 핸들
   * @param {number} multipleId - 다중 세션 ID (#2, #3 등의 숫자 부분)
   */
  setMultipleId(stableKey, windowHandle, multipleId) {
    console.log('💾 multipleId 매핑 저장:', {
      stableKey,
      windowHandle,
      multipleId,
    });

    // 기본 매핑 저장
    this.handleToMultipleIdMap.set(windowHandle, multipleId);

    // 안정적 매핑 저장 (충돌 방지)
    const compositeKey = `${stableKey}_${windowHandle}`;
    this.stableKeyHandleMap.set(compositeKey, multipleId);

    // 타임스탬프 기록 (자동 정리용)
    this.handleTimestamps.set(windowHandle, Date.now());

    this.save();
  }

  /**
   * windowHandle로 multipleId 조회
   * @param {number|string} windowHandle - 윈도우 핸들
   * @returns {number|null} multipleId 또는 null
   */
  getMultipleId(windowHandle) {
    return this.handleToMultipleIdMap.get(windowHandle) || null;
  }

  /**
   * 안정적 키 + windowHandle 조합으로 multipleId 조회
   * @param {string} stableKey - 안정적 식별자
   * @param {number|string} windowHandle - 윈도우 핸들
   * @returns {number|null} multipleId 또는 null
   */
  getMultipleIdByStableKey(stableKey, windowHandle) {
    const compositeKey = `${stableKey}_${windowHandle}`;
    return this.stableKeyHandleMap.get(compositeKey) || null;
  }

  /**
   * 특정 stableKey와 관련된 모든 매핑 조회
   * @param {string} stableKey - 안정적 식별자
   * @returns {Array} [{windowHandle, multipleId}, ...]
   */
  getMappingsByStableKey(stableKey) {
    const mappings = [];
    for (const [compositeKey, multipleId] of this.stableKeyHandleMap) {
      if (compositeKey.startsWith(`${stableKey}_`)) {
        const windowHandle = compositeKey.replace(`${stableKey}_`, '');
        mappings.push({ windowHandle, multipleId });
      }
    }
    return mappings;
  }

  /**
   * 매핑 삭제
   * @param {number|string} windowHandle - 윈도우 핸들
   */
  removeMapping(windowHandle) {
    console.log('🗑️ multipleId 매핑 삭제:', { windowHandle });

    this.handleToMultipleIdMap.delete(windowHandle);
    this.handleTimestamps.delete(windowHandle);

    // stableKeyHandleMap에서도 해당 windowHandle 포함된 키들 삭제
    for (const [compositeKey, _] of this.stableKeyHandleMap) {
      if (compositeKey.endsWith(`_${windowHandle}`)) {
        this.stableKeyHandleMap.delete(compositeKey);
      }
    }

    this.save();
  }

  /**
   * 특정 stableKey와 관련된 모든 매핑 삭제
   * @param {string} stableKey - 안정적 식별자
   */
  removeMappingsByStableKey(stableKey) {
    console.log('🗑️ stableKey 관련 매핑 모두 삭제:', { stableKey });

    let removedCount = 0;
    const keysToRemove = [];

    for (const [compositeKey, _] of this.stableKeyHandleMap) {
      if (compositeKey.startsWith(`${stableKey}_`)) {
        keysToRemove.push(compositeKey);
        removedCount++;
      }
    }

    for (const key of keysToRemove) {
      this.stableKeyHandleMap.delete(key);
    }

    console.log(`✅ ${removedCount}개의 매핑 삭제됨`);
    if (removedCount > 0) {
      this.save();
    }
  }

  /**
   * 오래된 매핑 자동 정리 (30일 이상 된 것들)
   * @param {number} maxAge - 최대 보존 기간 (밀리초, 기본: 30일)
   */
  cleanupOldMappings(maxAge = 30 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const expiredHandles = [];

    for (const [windowHandle, timestamp] of this.handleTimestamps) {
      if (now - timestamp > maxAge) {
        expiredHandles.push(windowHandle);
      }
    }

    if (expiredHandles.length > 0) {
      console.log('🧹 오래된 매핑 자동 정리:', {
        count: expiredHandles.length,
        handles: expiredHandles,
      });

      for (const handle of expiredHandles) {
        this.removeMapping(handle);
      }
    }
  }

  /**
   * localStorage에서 데이터 로드
   */
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      console.log('📂 PersistentMultipleIdStore 로드 시작:', {
        hasData: !!data,
      });

      if (data) {
        const parsed = JSON.parse(data);
        console.log('📂 파싱된 데이터:', {
          version: parsed.version,
          hasHandleMap: !!parsed.handleToMultipleIdMap,
          hasStableKeyMap: !!parsed.stableKeyHandleMap,
          hasTimestamps: !!parsed.handleTimestamps,
        });

        // 매핑 데이터 복원
        if (parsed.handleToMultipleIdMap) {
          this.handleToMultipleIdMap = new Map(parsed.handleToMultipleIdMap);
        }

        if (parsed.stableKeyHandleMap) {
          this.stableKeyHandleMap = new Map(parsed.stableKeyHandleMap);
        }

        if (parsed.handleTimestamps) {
          this.handleTimestamps = new Map(parsed.handleTimestamps);
        }

        console.log('✅ multipleId 매핑 로드 완료:', {
          handleMappings: this.handleToMultipleIdMap.size,
          stableKeyMappings: this.stableKeyHandleMap.size,
          timestamps: this.handleTimestamps.size,
        });

        // 자동 정리 실행
        this.cleanupOldMappings();
      }
    } catch (error) {
      console.error('❌ multipleId 매핑 로드 실패:', error);
      // 로드 실패 시 초기화
      this.handleToMultipleIdMap = new Map();
      this.stableKeyHandleMap = new Map();
      this.handleTimestamps = new Map();
    }
  }

  /**
   * localStorage에 데이터 저장
   */
  save() {
    try {
      const data = {
        version: '2.2.0',
        handleToMultipleIdMap: Array.from(this.handleToMultipleIdMap.entries()),
        stableKeyHandleMap: Array.from(this.stableKeyHandleMap.entries()),
        handleTimestamps: Array.from(this.handleTimestamps.entries()),
        timestamp: new Date().toISOString(),
      };

      console.log('💾 PersistentMultipleIdStore 저장:', {
        handleMappings: data.handleToMultipleIdMap.length,
        stableKeyMappings: data.stableKeyHandleMap.length,
        timestamps: data.handleTimestamps.length,
      });

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('❌ multipleId 매핑 저장 실패:', error);
    }
  }

  /**
   * 통계 정보 조회
   * @returns {Object} 저장소 통계
   */
  getStatistics() {
    return {
      handleMappings: this.handleToMultipleIdMap.size,
      stableKeyMappings: this.stableKeyHandleMap.size,
      timestamps: this.handleTimestamps.size,
      storageKey: this.storageKey,
    };
  }

  /**
   * 전체 데이터 내보내기 (디버깅용)
   * @returns {Object} 전체 매핑 데이터
   */
  exportData() {
    return {
      handleToMultipleIdMap: Array.from(this.handleToMultipleIdMap.entries()),
      stableKeyHandleMap: Array.from(this.stableKeyHandleMap.entries()),
      handleTimestamps: Array.from(this.handleTimestamps.entries()),
    };
  }

  /**
   * 전체 데이터 초기화 (테스트용)
   */
  clear() {
    console.log('🧹 PersistentMultipleIdStore 전체 초기화');
    this.handleToMultipleIdMap.clear();
    this.stableKeyHandleMap.clear();
    this.handleTimestamps.clear();
    localStorage.removeItem(this.storageKey);
  }
}
