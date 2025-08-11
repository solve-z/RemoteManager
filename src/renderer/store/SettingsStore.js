/**
 * SettingsStore - 사용자 설정 관리 스토어
 * 애플리케이션 설정과 사용자 개인화 정보 관리
 */

export class SettingsStore {
  constructor() {
    this.settings = new Map();
    this.listeners = new Set();
    this.defaultSettings = this.getDefaultSettings();
    this.load();
  }

  /**
   * 기본 설정값 정의
   * @returns {Object} 기본 설정 객체
   */
  getDefaultSettings() {
    return {
      // UI 설정
      ui: {
        sidebarCollapsed: false,
        theme: 'light',
        language: 'ko',
        compactMode: false,
      },

      // 사이드바 설정
      sidebar: {
        width: 280, // 기본 사이드바 폭 (픽셀)
        navHeight: 300, // 기본 네비게이션 영역 높이 (픽셀)
      },
      
      // 자동 새로고침 설정
      autoRefresh: {
        enabled: true,
        interval: 5000, // 5초
        showNotifications: true,
      },
      
      // 프로세스 설정
      process: {
        autoCleanup: true,
        cleanupDelay: 300000, // 5분
        showDisconnected: true,
        disconnectedDisplayTime: 60000, // 1분
      },
      
      // 알림 설정
      notifications: {
        enabled: true,
        showConnectionStatus: true,
        showReconnection: true,
        showDisconnection: true,
        autoHideDelay: 3000, // 3초
        position: 'top-right',
      },
      
      // 그룹 설정
      groups: {
        autoAssign: false,
        preserveOnDisconnect: true,
        showEmptyGroups: true,
        defaultColor: '#3b82f6',
      },
      
      // 카테고리 설정
      categories: {
        showLabels: true,
        showColors: true,
        defaultCategory: null,
      },
      
      // 성능 설정
      performance: {
        virtualScrolling: true,
        maxVisibleItems: 100,
        lazyLoading: true,
      },
      
      // 보안 설정
      security: {
        confirmProcessTermination: true,
        confirmGroupDeletion: true,
        confirmDataClear: true,
      },
      
      // 키보드 단축키
      shortcuts: {
        refresh: 'F5',
        toggleSidebar: 'Ctrl+B',
        toggleAutoRefresh: 'Ctrl+R',
        focusSearch: 'Ctrl+F',
      },
      
      // 내보내기/가져오기 설정
      export: {
        includeGroups: true,
        includeCategories: true,
        includeSettings: false,
        format: 'json',
      },
    };
  }

  /**
   * 설정값 가져오기
   * @param {string} key - 설정 키 (점 표기법 지원, 예: 'ui.theme')
   * @param {*} defaultValue - 기본값
   * @returns {*} 설정값
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.settings;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // 기본 설정에서 찾기
        value = this.getDefaultValue(key);
        break;
      }
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * 설정값 저장
   * @param {string} key - 설정 키
   * @param {*} value - 설정값
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.settings;

    // 중첩 객체 생성
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = value;

    // 변경사항 저장 및 알림
    this.save();
    this.notifyListeners(key, value, oldValue);
  }

  /**
   * 여러 설정값 한번에 저장
   * @param {Object} updates - 설정 업데이트 객체
   */
  setMultiple(updates) {
    const changes = [];

    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.get(key);
      this.setWithoutSave(key, value);
      changes.push({ key, value, oldValue });
    }

    this.save();
    
    // 모든 변경사항 알림
    changes.forEach(({ key, value, oldValue }) => {
      this.notifyListeners(key, value, oldValue);
    });
  }

  /**
   * 저장 없이 설정값 변경 (내부용)
   * @param {string} key - 설정 키
   * @param {*} value - 설정값
   */
  setWithoutSave(key, value) {
    const keys = key.split('.');
    let current = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 설정값 삭제
   * @param {string} key - 설정 키
   * @returns {boolean} 삭제 성공 여부
   */
  delete(key) {
    const keys = key.split('.');
    let current = this.settings;

    // 경로 탐색
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        return false; // 경로가 존재하지 않음
      }
      current = current[k];
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey in current) {
      const oldValue = current[lastKey];
      delete current[lastKey];
      
      this.save();
      this.notifyListeners(key, undefined, oldValue);
      return true;
    }

    return false;
  }

  /**
   * 기본값으로 재설정
   * @param {string} key - 설정 키 (전체 재설정시 생략)
   */
  reset(key = null) {
    if (key) {
      const defaultValue = this.getDefaultValue(key);
      if (defaultValue !== undefined) {
        this.set(key, defaultValue);
      }
    } else {
      this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
      this.save();
      this.notifyListeners();
    }
  }

  /**
   * 기본값 가져오기
   * @param {string} key - 설정 키
   * @returns {*} 기본값
   */
  getDefaultValue(key) {
    const keys = key.split('.');
    let value = this.defaultSettings;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 모든 설정 가져오기
   * @returns {Object} 전체 설정 객체
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * 설정 카테고리별 가져오기
   * @param {string} category - 카테고리명 (ui, autoRefresh 등)
   * @returns {Object} 해당 카테고리 설정
   */
  getCategory(category) {
    return this.get(category, {});
  }

  /**
   * localStorage에서 설정 로드
   */
  load() {
    try {
      const data = localStorage.getItem('remotemanager_settings_v4');
      if (data) {
        const loadedSettings = JSON.parse(data);
        
        // 기본값과 병합 (새로운 설정이 추가된 경우 대비)
        this.settings = this.mergeSettings(this.defaultSettings, loadedSettings);
      } else {
        // 기본 설정 사용
        this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
      this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
    }
  }

  /**
   * localStorage에 설정 저장
   */
  save() {
    try {
      localStorage.setItem('remotemanager_settings_v4', JSON.stringify(this.settings));
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  }

  /**
   * 설정 객체 병합 (깊은 병합)
   * @param {Object} defaults - 기본 설정
   * @param {Object} loaded - 로드된 설정
   * @returns {Object} 병합된 설정
   */
  mergeSettings(defaults, loaded) {
    const result = JSON.parse(JSON.stringify(defaults));

    function merge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    merge(result, loaded);
    return result;
  }

  /**
   * 설정 내보내기
   * @returns {Object} 내보낼 설정 데이터
   */
  exportData() {
    return {
      version: '1.2.0',
      timestamp: new Date().toISOString(),
      settings: this.getAll(),
    };
  }

  /**
   * 설정 가져오기
   * @param {Object} data - 가져올 설정 데이터
   * @returns {boolean} 성공 여부
   */
  importData(data) {
    try {
      if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('잘못된 설정 데이터 형식입니다.');
      }

      this.settings = this.mergeSettings(this.defaultSettings, data.settings);
      this.save();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('설정 가져오기 실패:', error);
      return false;
    }
  }

  /**
   * 특정 설정 변경 리스너 등록
   * @param {string|Function} keyOrListener - 설정 키 또는 리스너 함수
   * @param {Function} listener - 리스너 함수 (첫 번째 매개변수가 키인 경우)
   * @returns {Function} 언구독 함수
   */
  subscribe(keyOrListener, listener = null) {
    if (typeof keyOrListener === 'function') {
      // 전체 변경 리스너
      this.listeners.add(keyOrListener);
      return () => this.listeners.delete(keyOrListener);
    } else {
      // 특정 키 변경 리스너
      const wrappedListener = (changedKey, value, oldValue) => {
        if (changedKey === keyOrListener) {
          listener(value, oldValue);
        }
      };
      this.listeners.add(wrappedListener);
      return () => this.listeners.delete(wrappedListener);
    }
  }

  /**
   * 모든 리스너에게 변경 알림
   * @param {string} key - 변경된 설정 키
   * @param {*} value - 새 값
   * @param {*} oldValue - 이전 값
   */
  notifyListeners(key = null, value = null, oldValue = null) {
    this.listeners.forEach(listener => {
      try {
        if (key) {
          listener(key, value, oldValue);
        } else {
          listener();
        }
      } catch (error) {
        console.error('설정 스토어 리스너 에러:', error);
      }
    });
  }

  /**
   * 스토어 정리
   */
  cleanup() {
    this.listeners.clear();
  }
}