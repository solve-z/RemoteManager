/**
 * NotificationService - 알림 관리 서비스
 * 사용자에게 다양한 형태의 알림을 표시하고 관리
 */

export class NotificationService {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.settings = {
      position: 'top-right',
      autoHideDelay: 3000,
      maxNotifications: 5,
      showTimestamp: true,
    };
    this.initialize();
  }

  /**
   * 알림 서비스 초기화
   */
  initialize() {
    this.createContainer();
    this.setupStyles();
  }

  /**
   * 알림 컨테이너 생성
   */
  createContainer() {
    this.container = document.getElementById('notifications');
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notifications';
      this.container.className = 'notifications-container';
      document.body.appendChild(this.container);
    }

    this.container.className = `notifications-container ${this.settings.position}`;
  }

  /**
   * 기본 스타일 설정
   */
  setupStyles() {
    if (document.getElementById('notification-styles')) {
      return; // 이미 스타일이 있으면 건너뜀
    }

    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notifications-container {
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        max-width: 400px;
      }

      .notifications-container.top-right {
        top: 20px;
        right: 20px;
      }

      .notifications-container.top-left {
        top: 20px;
        left: 20px;
      }

      .notifications-container.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .notifications-container.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .notification {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        margin-bottom: 10px;
        padding: 16px;
        pointer-events: auto;
        transform: translateX(100%);
        transition: all 0.3s ease;
        border-left: 4px solid #3b82f6;
        max-width: 100%;
        word-wrap: break-word;
      }

      .notification.show {
        transform: translateX(0);
      }

      .notification.hide {
        transform: translateX(100%);
        opacity: 0;
      }

      .notification.success {
        border-left-color: #10b981;
      }

      .notification.error {
        border-left-color: #ef4444;
      }

      .notification.warning {
        border-left-color: #f59e0b;
      }

      .notification.info {
        border-left-color: #3b82f6;
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .notification-title {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
        margin: 0;
      }

      .notification-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
      }

      .notification-close:hover {
        color: #374151;
      }

      .notification-message {
        font-size: 13px;
        color: #4b5563;
        margin: 0;
        line-height: 1.4;
      }

      .notification-timestamp {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 8px;
        text-align: right;
      }

      .notification-icon {
        margin-right: 8px;
        font-size: 16px;
      }

      .notification.success .notification-icon {
        color: #10b981;
      }

      .notification.error .notification-icon {
        color: #ef4444;
      }

      .notification.warning .notification-icon {
        color: #f59e0b;
      }

      .notification.info .notification-icon {
        color: #3b82f6;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 성공 알림 표시
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   */
  showSuccess(message, options = {}) {
    return this.show('success', '성공', message, {
      icon: '✅',
      ...options,
    });
  }

  /**
   * 에러 알림 표시
   * @param {string} title - 제목
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   */
  showError(title, message = '', options = {}) {
    return this.show('error', title, message, {
      icon: '❌',
      autoHide: false, // 에러는 수동으로 닫기
      ...options,
    });
  }

  /**
   * 경고 알림 표시
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   */
  showWarning(message, options = {}) {
    return this.show('warning', '경고', message, {
      icon: '⚠️',
      ...options,
    });
  }

  /**
   * 정보 알림 표시
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   */
  showInfo(message, options = {}) {
    return this.show('info', '알림', message, {
      icon: 'ℹ️',
      ...options,
    });
  }

  /**
   * 알림 표시 (범용)
   * @param {string} type - 알림 타입
   * @param {string} title - 제목
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   * @returns {string} 알림 ID
   */
  show(type, title, message, options = {}) {
    const id = this.generateId();
    const notification = this.createNotification(id, type, title, message, options);
    
    // 최대 알림 수 제한
    this.limitNotifications();
    
    // DOM에 추가
    this.container.appendChild(notification);
    
    // 애니메이션을 위해 약간 지연 후 show 클래스 추가
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // 자동 숨김 설정
    if (options.autoHide !== false) {
      const delay = options.autoHideDelay || this.settings.autoHideDelay;
      setTimeout(() => {
        this.hide(id);
      }, delay);
    }

    // 알림 맵에 저장
    this.notifications.set(id, {
      element: notification,
      type,
      title,
      message,
      createdAt: new Date(),
      options,
    });

    return id;
  }

  /**
   * 알림 숨김
   * @param {string} id - 알림 ID
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return;
    }

    const element = notification.element;
    element.classList.add('hide');

    // 애니메이션 완료 후 DOM에서 제거
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * 모든 알림 숨김
   */
  hideAll() {
    for (const id of this.notifications.keys()) {
      this.hide(id);
    }
  }

  /**
   * 특정 타입의 알림들 숨김
   * @param {string} type - 알림 타입
   */
  hideByType(type) {
    for (const [id, notification] of this.notifications) {
      if (notification.type === type) {
        this.hide(id);
      }
    }
  }

  /**
   * 알림 요소 생성
   * @param {string} id - 알림 ID
   * @param {string} type - 알림 타입
   * @param {string} title - 제목
   * @param {string} message - 메시지
   * @param {Object} options - 옵션
   * @returns {HTMLElement} 알림 요소
   */
  createNotification(id, type, title, message, options) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    const header = document.createElement('div');
    header.className = 'notification-header';

    const titleElement = document.createElement('div');
    titleElement.className = 'notification-title';
    
    if (options.icon) {
      const icon = document.createElement('span');
      icon.className = 'notification-icon';
      icon.textContent = options.icon;
      titleElement.appendChild(icon);
    }
    
    titleElement.appendChild(document.createTextNode(title));

    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => this.hide(id));

    header.appendChild(titleElement);
    header.appendChild(closeButton);

    notification.appendChild(header);

    if (message) {
      const messageElement = document.createElement('div');
      messageElement.className = 'notification-message';
      messageElement.textContent = message;
      notification.appendChild(messageElement);
    }

    if (this.settings.showTimestamp) {
      const timestamp = document.createElement('div');
      timestamp.className = 'notification-timestamp';
      timestamp.textContent = new Date().toLocaleTimeString();
      notification.appendChild(timestamp);
    }

    // 클릭으로 닫기 (에러가 아닌 경우)
    if (type !== 'error') {
      notification.style.cursor = 'pointer';
      notification.addEventListener('click', (e) => {
        if (e.target === closeButton) return;
        this.hide(id);
      });
    }

    return notification;
  }

  /**
   * 최대 알림 수 제한
   */
  limitNotifications() {
    const existingNotifications = this.container.children;
    const maxNotifications = this.settings.maxNotifications;

    if (existingNotifications.length >= maxNotifications) {
      // 가장 오래된 알림부터 제거
      const oldestNotifications = Array.from(existingNotifications)
        .slice(0, existingNotifications.length - maxNotifications + 1);

      oldestNotifications.forEach(element => {
        const id = element.dataset.id;
        if (id) {
          this.hide(id);
        }
      });
    }
  }

  /**
   * 고유 ID 생성
   * @returns {string} 고유 ID
   */
  generateId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // 컨테이너 위치 업데이트
    if (newSettings.position) {
      this.container.className = `notifications-container ${newSettings.position}`;
    }
  }

  /**
   * 활성 알림 수 가져오기
   * @returns {number} 활성 알림 수
   */
  getActiveCount() {
    return this.notifications.size;
  }

  /**
   * 특정 타입의 활성 알림 수 가져오기
   * @param {string} type - 알림 타입
   * @returns {number} 해당 타입의 활성 알림 수
   */
  getActiveCountByType(type) {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (notification.type === type) {
        count++;
      }
    }
    return count;
  }

  /**
   * 알림 이력 가져오기 (최근 50개)
   * @returns {Array} 알림 이력
   */
  getHistory() {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map(notification => ({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      }));
  }

  /**
   * 서비스 정리
   */
  cleanup() {
    this.hideAll();
    
    // 스타일 제거
    const styleElement = document.getElementById('notification-styles');
    if (styleElement) {
      styleElement.remove();
    }

    // 컨테이너 제거
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.notifications.clear();
  }
}