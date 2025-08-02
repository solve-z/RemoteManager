/**
 * helpers.js - 헬퍼 함수들
 * 공통으로 사용되는 유틸리티 함수들
 */

import { REGEX_PATTERNS, PROCESS_TYPES } from './constants.js';

/**
 * 문자열 유틸리티
 */
export const StringUtils = {
  /**
   * 문자열이 비어있는지 확인
   * @param {string} str - 확인할 문자열
   * @returns {boolean} 비어있으면 true
   */
  isEmpty(str) {
    return !str || str.trim().length === 0;
  },

  /**
   * 문자열 자르기 (말줄임표 추가)
   * @param {string} str - 자를 문자열
   * @param {number} maxLength - 최대 길이
   * @returns {string} 자른 문자열
   */
  truncate(str, maxLength) {
    if (!str || str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  },

  /**
   * 케밥 케이스를 타이틀 케이스로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} 변환된 문자열
   */
  kebabToTitle(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * HTML 이스케이프
   * @param {string} str - 이스케이프할 문자열
   * @returns {string} 이스케이프된 문자열
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

/**
 * 시간 유틸리티
 */
export const TimeUtils = {
  /**
   * 현재 시간을 문자열로 반환
   * @returns {string} 현재 시간 (HH:MM:SS)
   */
  getCurrentTime() {
    return new Date().toLocaleTimeString('ko-KR');
  },

  /**
   * 날짜를 문자열로 반환
   * @param {Date} date - 날짜 객체
   * @returns {string} 날짜 문자열 (YYYY-MM-DD)
   */
  formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('ko-KR');
  },

  /**
   * 시간 경과 계산
   * @param {Date} startTime - 시작 시간
   * @param {Date} endTime - 종료 시간 (기본: 현재 시간)
   * @returns {string} 경과 시간 문자열
   */
  getElapsedTime(startTime, endTime = new Date()) {
    if (!startTime) return '';

    const elapsed = endTime.getTime() - startTime.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return `${seconds}초`;
    }
  },

  /**
   * 상대적 시간 반환 (방금 전, 5분 전 등)
   * @param {Date} date - 날짜 객체
   * @returns {string} 상대적 시간 문자열
   */
  getRelativeTime(date) {
    if (!date) return '';

    const now = new Date();
    const elapsed = now.getTime() - date.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 전`;
    } else if (hours > 0) {
      return `${hours}시간 전`;
    } else if (minutes > 0) {
      return `${minutes}분 전`;
    } else if (seconds > 10) {
      return `${seconds}초 전`;
    } else {
      return '방금 전';
    }
  }
};

/**
 * DOM 유틸리티
 */
export const DomUtils = {
  /**
   * 요소가 화면에 보이는지 확인
   * @param {HTMLElement} element - 확인할 요소
   * @returns {boolean} 보이면 true
   */
  isElementInViewport(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * 요소를 화면 중앙으로 스크롤
   * @param {HTMLElement} element - 스크롤할 요소
   * @param {Object} options - 스크롤 옵션
   */
  scrollToElement(element, options = {}) {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
      ...options
    });
  },

  /**
   * 클래스 토글 (조건부)
   * @param {HTMLElement} element - 대상 요소
   * @param {string} className - 클래스명
   * @param {boolean} condition - 조건
   */
  toggleClass(element, className, condition) {
    if (!element) return;

    if (condition) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  },

  /**
   * 요소의 데이터 속성 가져오기
   * @param {HTMLElement} element - 대상 요소
   * @param {string} key - 데이터 키
   * @returns {string|null} 데이터 값
   */
  getData(element, key) {
    if (!element) return null;
    return element.dataset[key] || null;
  }
};

/**
 * 프로세스 유틸리티
 */
export const ProcessUtils = {
  /**
   * 프로세스 타입 감지
   * @param {Object} process - 프로세스 정보
   * @returns {string} 프로세스 타입
   */
  detectProcessType(process) {
    if (!process) return PROCESS_TYPES.UNKNOWN;

    const processName = (process.processName || process.ProcessName || '').toLowerCase();
    const windowTitle = process.windowTitle || process.MainWindowTitle || '';

    if (processName === 'ezhelpviewer' && 
        (windowTitle.includes('원격지') || windowTitle.includes('Relay'))) {
      return PROCESS_TYPES.EZHELP;
    }

    if (processName === 'teamviewer' && REGEX_PATTERNS.TEAMVIEWER_REMOTE.test(windowTitle)) {
      return PROCESS_TYPES.TEAMVIEWER;
    }

    return PROCESS_TYPES.UNKNOWN;
  },

  /**
   * 컴퓨터명 추출
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} 컴퓨터명
   */
  extractComputerName(process) {
    if (!process) return null;

    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const type = this.detectProcessType(process);

    if (type === PROCESS_TYPES.EZHELP) {
      const match = windowTitle.match(REGEX_PATTERNS.COMPUTER_NAME_EZHELP);
      return match ? match[1].trim() : null;
    } else if (type === PROCESS_TYPES.TEAMVIEWER) {
      const match = windowTitle.match(REGEX_PATTERNS.COMPUTER_NAME_TEAMVIEWER);
      return match ? match[1].trim() : null;
    }

    return null;
  },

  /**
   * IP 주소 추출 (ezHelp용)
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} IP 주소
   */
  extractIpAddress(process) {
    if (!process) return null;

    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const match = windowTitle.match(REGEX_PATTERNS.IP_ADDRESS);
    return match ? match[1] : null;
  },

  /**
   * 상담원 ID 추출 (ezHelp용)
   * @param {Object} process - 프로세스 정보
   * @returns {string|null} 상담원 ID
   */
  extractCounselorId(process) {
    if (!process) return null;

    const windowTitle = process.windowTitle || process.MainWindowTitle || '';
    const match = windowTitle.match(REGEX_PATTERNS.COUNSELOR_ID);
    return match ? match[1] : null;
  }
};

/**
 * 배열 유틸리티
 */
export const ArrayUtils = {
  /**
   * 배열에서 중복 제거
   * @param {Array} array - 원본 배열
   * @param {string} key - 중복 확인 키 (객체 배열의 경우)
   * @returns {Array} 중복 제거된 배열
   */
  removeDuplicates(array, key = null) {
    if (!Array.isArray(array)) return [];

    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      });
    } else {
      return [...new Set(array)];
    }
  },

  /**
   * 배열을 청크로 나누기
   * @param {Array} array - 원본 배열
   * @param {number} size - 청크 크기
   * @returns {Array} 청크 배열
   */
  chunk(array, size) {
    if (!Array.isArray(array) || size <= 0) return [];

    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * 배열 요소 이동
   * @param {Array} array - 원본 배열
   * @param {number} fromIndex - 원본 인덱스
   * @param {number} toIndex - 대상 인덱스
   * @returns {Array} 새 배열
   */
  moveElement(array, fromIndex, toIndex) {
    if (!Array.isArray(array) || fromIndex < 0 || toIndex < 0 || 
        fromIndex >= array.length || toIndex >= array.length) {
      return [...array];
    }

    const newArray = [...array];
    const [element] = newArray.splice(fromIndex, 1);
    newArray.splice(toIndex, 0, element);
    return newArray;
  }
};

/**
 * 클립보드 유틸리티
 */
export const ClipboardUtils = {
  /**
   * 텍스트를 클립보드에 복사
   * @param {string} text - 복사할 텍스트
   * @returns {Promise<boolean>} 성공 여부
   */
  async copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // 폴백: 임시 텍스트 영역 사용
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      return false;
    }
  },

  /**
   * 클립보드에서 텍스트 읽기
   * @returns {Promise<string|null>} 클립보드 텍스트
   */
  async readText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
      return null;
    } catch (error) {
      console.error('클립보드 읽기 실패:', error);
      return null;
    }
  }
};

/**
 * 키보드 유틸리티
 */
export const KeyboardUtils = {
  /**
   * 키 조합 확인
   * @param {KeyboardEvent} event - 키보드 이벤트
   * @param {string} combination - 키 조합 (예: 'Ctrl+B')
   * @returns {boolean} 일치 여부
   */
  isKeyCombination(event, combination) {
    if (!event || !combination) return false;

    const keys = combination.toLowerCase().split('+');
    const modifiers = keys.slice(0, -1);
    const mainKey = keys[keys.length - 1];

    // 메인 키 확인
    if (event.key.toLowerCase() !== mainKey.toLowerCase()) {
      return false;
    }

    // 수정자 키 확인
    for (const modifier of modifiers) {
      switch (modifier) {
        case 'ctrl':
          if (!event.ctrlKey) return false;
          break;
        case 'alt':
          if (!event.altKey) return false;
          break;
        case 'shift':
          if (!event.shiftKey) return false;
          break;
        case 'meta':
          if (!event.metaKey) return false;
          break;
      }
    }

    return true;
  }
};

/**
 * 검증 유틸리티
 */
export const ValidationUtils = {
  /**
   * 이메일 형식 검증
   * @param {string} email - 이메일 주소
   * @returns {boolean} 유효하면 true
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * IP 주소 형식 검증
   * @param {string} ip - IP 주소
   * @returns {boolean} 유효하면 true
   */
  isValidIpAddress(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  },

  /**
   * 그룹명 검증
   * @param {string} name - 그룹명
   * @returns {Object} 검증 결과
   */
  validateGroupName(name) {
    if (!name || StringUtils.isEmpty(name)) {
      return { valid: false, message: '그룹명을 입력해주세요.' };
    }

    if (name.length > 50) {
      return { valid: false, message: '그룹명은 50자 이하로 입력해주세요.' };
    }

    return { valid: true };
  }
};

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} delay - 지연 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * 쓰로틀 함수
 * @param {Function} func - 실행할 함수
 * @param {number} delay - 지연 시간 (ms)
 * @returns {Function} 쓰로틀된 함수
 */
export const throttle = (func, delay) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, delay);
    }
  };
};

/**
 * 딥 클론 함수
 * @param {*} obj - 복사할 객체
 * @returns {*} 복사된 객체
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
};

/**
 * UUID 생성
 * @returns {string} UUID 문자열
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * 전체 헬퍼 함수 컬렉션 (기본 내보내기용)
 */
export default {
  StringUtils,
  TimeUtils,
  DomUtils,
  ProcessUtils,
  ArrayUtils,
  ClipboardUtils,
  KeyboardUtils,
  ValidationUtils,
  debounce,
  throttle,
  deepClone,
  generateUUID
};