/**
 * constants.js - 상수 정의
 * 애플리케이션 전체에서 사용되는 상수값들
 */

/**
 * 프로세스 타입
 */
export const PROCESS_TYPES = {
  EZHELP: 'ezhelp',
  TEAMVIEWER: 'teamviewer',
  UNKNOWN: 'unknown'
};

/**
 * 프로세스 상태
 */
export const PROCESS_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTED: 'reconnected'
};

/**
 * 카테고리 정의
 */
export const CATEGORIES = {
  XRAY: {
    id: 'xray',
    name: '엑스레이',
    color: '#e3f2fd',
    borderColor: '#2196f3',
    textColor: '#0d47a1'
  },
  OTHER_SERVER: {
    id: 'other-server',
    name: '타서버',
    color: '#fff3e0',
    borderColor: '#ff9800',
    textColor: '#e65100'
  },
  NEW_SERVER: {
    id: 'new-server',
    name: '새서버',
    color: '#f3e5f5',
    borderColor: '#9c27b0',
    textColor: '#4a148c'
  },
  OLD_SERVER: {
    id: 'old-server',
    name: '구서버',
    color: '#fce4ec',
    borderColor: '#e91e63',
    textColor: '#880e4f'
  }
};

/**
 * 카테고리 배열 (UI 렌더링용)
 */
export const CATEGORY_LIST = Object.values(CATEGORIES);

/**
 * 정렬 옵션
 */
export const SORT_OPTIONS = {
  DEFAULT: 'default',
  NAME: 'name',
  PID: 'pid',
  GROUP: 'group',
  CATEGORY: 'category',
  STATUS: 'status',
  CREATED_AT: 'createdAt'
};

/**
 * 필터 옵션
 */
export const FILTER_OPTIONS = {
  ALL: '',
  UNGROUPED: 'ungrouped',
  UNCATEGORIZED: 'uncategorized'
};

/**
 * 알림 타입
 */
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * 알림 위치
 */
export const NOTIFICATION_POSITIONS = {
  TOP_RIGHT: 'top-right',
  TOP_LEFT: 'top-left',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left'
};

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS = {
  AUTO_REFRESH_INTERVAL: 5000, // 5초
  NOTIFICATION_AUTO_HIDE_DELAY: 3000, // 3초
  MAX_NOTIFICATIONS: 5,
  CLEANUP_DELAY: 300000, // 5분
  DISCONNECTED_DISPLAY_TIME: 60000, // 1분
  SIDEBAR_WIDTH: 280,
  SIDEBAR_COLLAPSED_WIDTH: 70
};

/**
 * 로컬 스토리지 키
 */
export const STORAGE_KEYS = {
  GROUPS: 'remotemanager_groups_v4',
  SETTINGS: 'remotemanager_settings_v4',
  CUSTOM_LABELS: 'remotemanager_labels_v4',
  CATEGORIES: 'remotemanager_categories_v4',
  UI_STATE: 'remotemanager_ui_state_v4'
};

/**
 * IPC 채널명
 */
export const IPC_CHANNELS = {
  DETECT_PROCESSES: 'detect-processes',
  FOCUS_WINDOW: 'focus-window',
  GET_APP_INFO: 'get-app-info',
  TERMINATE_PROCESS: 'terminate-process'
};

/**
 * 정규식 패턴
 */
export const REGEX_PATTERNS = {
  // ezHelp 원격 세션 감지
  EZHELP_REMOTE: /ezHelp - ([^(]+).*원격지 IP : ([\d.]+)/i,
  
  // TeamViewer 원격 세션 감지
  TEAMVIEWER_REMOTE: /^(.+) - TeamViewer$/i,
  
  // IP 주소 추출
  IP_ADDRESS: /원격지 IP : ([\d.]+)/i,
  
  // 상담원 번호 추출
  COUNSELOR_ID: /상담원\((\d+)\)/i,
  
  // 컴퓨터명 추출 (ezHelp)
  COMPUTER_NAME_EZHELP: /ezHelp - ([^(]+)/i,
  
  // 컴퓨터명 추출 (TeamViewer)
  COMPUTER_NAME_TEAMVIEWER: /^(.+) - TeamViewer$/i
};

/**
 * 키보드 단축키
 */
export const KEYBOARD_SHORTCUTS = {
  TOGGLE_SIDEBAR: 'Ctrl+B',
  REFRESH: 'F5',
  TOGGLE_AUTO_REFRESH: 'Ctrl+R',
  FOCUS_SEARCH: 'Ctrl+F',
  ESCAPE: 'Escape',
  ENTER: 'Enter'
};

/**
 * 애니메이션 지속 시간
 */
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
  NOTIFICATION: 300,
  SIDEBAR: 300
};

/**
 * 브레이크포인트 (반응형 디자인)
 */
export const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE_DESKTOP: 1200
};

/**
 * 색상 팔레트
 */
export const COLORS = {
  PRIMARY: '#3b82f6',
  PRIMARY_HOVER: '#2563eb',
  SECONDARY: '#6b7280',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
  
  // 그레이 스케일
  GRAY_50: '#f9fafb',
  GRAY_100: '#f3f4f6',
  GRAY_200: '#e5e7eb',
  GRAY_300: '#d1d5db',
  GRAY_400: '#9ca3af',
  GRAY_500: '#6b7280',
  GRAY_600: '#4b5563',
  GRAY_700: '#374151',
  GRAY_800: '#1f2937',
  GRAY_900: '#111827'
};

/**
 * 상태 아이콘
 */
export const STATUS_ICONS = {
  [PROCESS_STATUS.CONNECTED]: '🟢',
  [PROCESS_STATUS.DISCONNECTED]: '🔴',
  [PROCESS_STATUS.RECONNECTED]: '🟡',
  MINIMIZED: '🔽',
  HIDDEN: '👁️‍🗨️',
  UNKNOWN: '⚪'
};

/**
 * 상태 텍스트
 */
export const STATUS_TEXT = {
  [PROCESS_STATUS.CONNECTED]: '연결됨',
  [PROCESS_STATUS.DISCONNECTED]: '연결 끊김',
  [PROCESS_STATUS.RECONNECTED]: '재연결됨'
};

/**
 * 에러 메시지
 */
export const ERROR_MESSAGES = {
  PROCESS_DETECTION_FAILED: '프로세스 감지에 실패했습니다.',
  WINDOW_FOCUS_FAILED: '창 포커스에 실패했습니다.',
  COPY_FAILED: '클립보드 복사에 실패했습니다.',
  GROUP_CREATE_FAILED: '그룹 생성에 실패했습니다.',
  GROUP_DELETE_FAILED: '그룹 삭제에 실패했습니다.',
  INVALID_GROUP_NAME: '유효하지 않은 그룹명입니다.',
  DUPLICATE_GROUP_NAME: '이미 존재하는 그룹명입니다.',
  PROCESS_NOT_FOUND: '프로세스를 찾을 수 없습니다.',
  GROUP_NOT_FOUND: '그룹을 찾을 수 없습니다.',
  SETTINGS_LOAD_FAILED: '설정 로드에 실패했습니다.',
  SETTINGS_SAVE_FAILED: '설정 저장에 실패했습니다.'
};

/**
 * 성공 메시지
 */
export const SUCCESS_MESSAGES = {
  PROCESS_FOCUSED: '창이 포커스되었습니다.',
  PROCESS_COPIED: '프로세스 정보가 복사되었습니다.',
  GROUP_CREATED: '그룹이 생성되었습니다.',
  GROUP_UPDATED: '그룹이 수정되었습니다.',
  GROUP_DELETED: '그룹이 삭제되었습니다.',
  PROCESS_ASSIGNED: '프로세스가 그룹에 할당되었습니다.',
  LABEL_UPDATED: '라벨이 변경되었습니다.',
  CATEGORY_UPDATED: '카테고리가 변경되었습니다.',
  SETTINGS_SAVED: '설정이 저장되었습니다.'
};

/**
 * 개발 환경 체크
 */
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * 플랫폼 체크
 */
export const IS_WINDOWS = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';
export const IS_LINUX = process.platform === 'linux';

/**
 * 기본 내보내기를 위한 상수 컬렉션
 */
export default {
  PROCESS_TYPES,
  PROCESS_STATUS,
  CATEGORIES,
  CATEGORY_LIST,
  SORT_OPTIONS,
  FILTER_OPTIONS,
  NOTIFICATION_TYPES,
  NOTIFICATION_POSITIONS,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  IPC_CHANNELS,
  REGEX_PATTERNS,
  KEYBOARD_SHORTCUTS,
  ANIMATION_DURATION,
  BREAKPOINTS,
  COLORS,
  STATUS_ICONS,
  STATUS_TEXT,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  IS_DEVELOPMENT,
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX
};