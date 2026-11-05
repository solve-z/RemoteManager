/**
 * MiniWindow - 최상위 고정 미니창 관리 모듈
 * AlwaysOnTop, 투명도, 트리 구조 리스트를 위한 별도 창
 */

import { BrowserWindow, Menu, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 미니창 관리 클래스
 */
export class MiniWindowManager {
  constructor() {
    this.miniWindow = null;
    this.isVisible = false;
    this.isCollapsed = false;
    this.originalBounds = null;
    this.titleBarHeight = 39; // 타이틀바 높이 (시스템 최소 높이에 맞춤)
    this.lastCollapsedPosition = null; // 마지막으로 접었을 때의 위치
    this.currentUserPosition = null; // 접힌 상태에서 사용자가 이동한 위치
  }

  /**
   * 미니창 생성
   */
  createMiniWindow() {
    if (this.miniWindow) {
      this.showMiniWindow();
      return this.miniWindow;
    }

    this.miniWindow = new BrowserWindow({
      width: 336,
      height: 500,
      minWidth: 280, // 원래 최소 너비로 복원
      minHeight: 39, // 최소 높이를 39px로 설정
      
      // 최상위 고정 및 프레임리스 설정
      alwaysOnTop: true,
      frame: false,
      resizable: true,
      skipTaskbar: true, // 작업표시줄에서 숨김
      maximizable: false, // 최대화 비활성화 (더블클릭 충돌 방지)
      minimizable: false, // 최소화도 비활성화
      
      // 투명도 설정 (기본 90%)
      opacity: 0.9,
      
      // 보안 설정
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../renderer/preload.js'),
      },
      
      show: false,
      title: 'RemoteManager Mini',
      
      // 부모 창 설정하지 않음 (독립적인 창)
    });

    // Windows에서 최상단 레이어 확실히 고정 ('screen-saver' 레벨 및 모든 워크스페이스)
    this.miniWindow.setAlwaysOnTop(true, 'screen-saver');
    try {
      this.miniWindow.setVisibleOnAllWorkspaces(true);
    } catch (e) {
      // 무시
    }

    // 포커스를 잃더라도 최상단 고정 유지 보정
    this.miniWindow.on('blur', () => {
      if (this.miniWindow && !this.miniWindow.isDestroyed()) {
        this.miniWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    });

    // 미니창 HTML 로드
    const miniHtmlPath = join(__dirname, '../renderer/mini/index.html');
    this.miniWindow.loadFile(miniHtmlPath);

    // 창이 준비되면 표시
    this.miniWindow.once('ready-to-show', () => {
      this.miniWindow.show();
      this.isVisible = true;
    });

    // 미니창에서도 기본 메뉴와 단축키 비활성화
    this.miniWindow.setMenu(null);

    // 창이 닫히면 정리
    this.miniWindow.on('closed', () => {
      this.miniWindow = null;
      this.isVisible = false;
    });

    // 개발 모드에서 DevTools 열기
    if (process.argv.includes('--dev')) {
      this.miniWindow.webContents.openDevTools();
    }

    // F12 키로 DevTools 토글 (항상 사용 가능)
    this.miniWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        if (this.miniWindow.webContents.isDevToolsOpened()) {
          this.miniWindow.webContents.closeDevTools();
        } else {
          this.miniWindow.webContents.openDevTools();
        }
      }
    });

    return this.miniWindow;
  }

  /**
   * 미니창 표시
   */
  showMiniWindow() {
    if (this.miniWindow) {
      this.miniWindow.show();
      this.miniWindow.focus();
      this.miniWindow.setAlwaysOnTop(true, 'screen-saver');
      this.isVisible = true;
    }
  }

  /**
   * 미니창 위치 및 크기 초기화 (주 모니터 기준 우측 상단, 너비 336px)
   */
  resetPosition() {
    if (!this.miniWindow) return { success: false, error: '미니창이 없습니다.' };
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { workArea } = primaryDisplay;
      const width = 336;
      const height = 500;
      const x = Math.round(workArea.x + workArea.width - width - 20);
      const y = Math.round(workArea.y + 40);

      this.miniWindow.setBounds({ x, y, width, height });
      this.miniWindow.setAlwaysOnTop(true, 'screen-saver');
      return { success: true, bounds: { x, y, width, height } };
    } catch (error) {
      console.error('미니창 위치 초기화 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 미니창 위치/크기 설정 (프리셋 불러오기용)
   */
  setBounds(bounds) {
    if (!this.miniWindow || !bounds) return { success: false, error: '설정할 위치 정보가 없습니다.' };
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { workArea } = primaryDisplay;
      
      let width = bounds.width || 336;
      let height = bounds.height || 500;
      let x = typeof bounds.x === 'number' ? bounds.x : Math.round(workArea.x + workArea.width - width - 20);
      let y = typeof bounds.y === 'number' ? bounds.y : Math.round(workArea.y + 40);

      // 주 모니터 영역 내에 안전하게 배치
      if (x < workArea.x) x = workArea.x;
      if (x + width > workArea.x + workArea.width) x = workArea.x + workArea.width - width;
      if (y < workArea.y) y = workArea.y;
      if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;

      this.miniWindow.setBounds({ x, y, width, height });
      this.miniWindow.setAlwaysOnTop(true, 'screen-saver');
      return { success: true, bounds: { x, y, width, height } };
    } catch (error) {
      console.error('미니창 위치 설정 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 현재 미니창 위치/크기 반환 (프리셋 저장용)
   */
  getBounds() {
    if (!this.miniWindow) return null;
    return this.miniWindow.getBounds();
  }

  /**
   * 미니창 숨김
   */
  hideMiniWindow() {
    if (this.miniWindow) {
      this.miniWindow.hide();
      this.isVisible = false;
    }
  }

  /**
   * 미니창 토글
   */
  toggleMiniWindow() {
    if (this.miniWindow && this.isVisible) {
      this.hideMiniWindow();
    } else {
      if (this.miniWindow) {
        this.showMiniWindow();
      } else {
        this.createMiniWindow();
      }
    }
  }

  /**
   * 미니창 닫기
   */
  closeMiniWindow() {
    if (this.miniWindow) {
      this.miniWindow.close();
      this.miniWindow = null;
      this.isVisible = false;
    }
  }

  /**
   * 투명도 설정
   * @param {number} opacity - 0.1 ~ 1.0 사이의 값
   */
  setOpacity(opacity) {
    if (this.miniWindow) {
      const validOpacity = Math.max(0.1, Math.min(1.0, opacity));
      this.miniWindow.setOpacity(validOpacity);
    }
  }

  /**
   * 현재 상태 반환
   */
  getStatus() {
    return {
      exists: !!this.miniWindow,
      visible: this.isVisible,
      opacity: this.miniWindow ? this.miniWindow.getOpacity() : 0.9
    };
  }

  /**
   * 미니창 위치 및 크기 저장
   */
  saveWindowBounds() {
    if (this.miniWindow) {
      return this.miniWindow.getBounds();
    }
    return null;
  }

  /**
   * 미니창 위치 및 크기 복원
   * @param {Object} bounds - {x, y, width, height}
   */
  restoreWindowBounds(bounds) {
    if (this.miniWindow && bounds) {
      this.miniWindow.setBounds(bounds);
    }
  }

  /**
   * 미니창 접기/펼치기 토글
   */
  toggleCollapse() {
    if (!this.miniWindow) return;

    if (this.isCollapsed) {
      this.expandWindow();
    } else {
      this.collapseWindow();
    }
  }

  /**
   * 미니창 접기 (타이틀바만 남김)
   */
  collapseWindow() {
    if (!this.miniWindow || this.isCollapsed) return;

    // 접기 전에 현재 위치를 lastCollapsedPosition에 저장
    this.lastCollapsedPosition = this.miniWindow.getBounds();

    // 현재 크기 저장 (기존 로직)
    this.originalBounds = this.miniWindow.getBounds();

    // DPI 스케일링 고려한 정확한 높이 계산
    const scaleFactor = this.miniWindow.webContents.getZoomFactor();
    const adjustedHeight = Math.ceil(this.titleBarHeight / scaleFactor);

    // currentUserPosition이 있으면 그 위치로 이동 후 접기
    if (this.currentUserPosition) {
      const collapsedBounds = {
        x: this.currentUserPosition.x,
        y: this.currentUserPosition.y,
        width: this.originalBounds.width,
        height: adjustedHeight
      };
      this.miniWindow.setBounds(collapsedBounds);
    } else {
      // 현재 위치에서 접기
      const collapsedBounds = {
        x: this.originalBounds.x,
        y: this.originalBounds.y,
        width: this.originalBounds.width,
        height: adjustedHeight
      };
      this.miniWindow.setBounds(collapsedBounds);
    }

    this.isCollapsed = true;

  }

  /**
   * 미니창 펼치기 (원래 크기로 복원)
   */
  expandWindow() {
    if (!this.miniWindow || !this.isCollapsed) return;

    // 펼치기 전에 현재 위치 저장 (사용자가 드래그한 B 위치)
    const currentPosition = this.miniWindow.getBounds();
    this.currentUserPosition = { ...currentPosition };

    // 최소 크기 제한 복원 (39px로 수정)
    this.miniWindow.setMinimumSize(280, 39);

    // 원래 접었던 위치(A)에서 펼치기
    if (this.lastCollapsedPosition) {
      const expandedBounds = {
        x: this.lastCollapsedPosition.x,
        y: this.lastCollapsedPosition.y,
        width: this.originalBounds ? this.originalBounds.width : 350,
        height: this.originalBounds ? this.originalBounds.height : 500
      };
      this.miniWindow.setBounds(expandedBounds);
    } else if (this.originalBounds) {
      this.miniWindow.setBounds(this.originalBounds);
    } else {
      // 기본 크기로 복원
      this.miniWindow.setBounds({
        x: currentPosition.x,
        y: currentPosition.y,
        width: 350,
        height: 500
      });
    }

    this.isCollapsed = false;
  }

  /**
   * 현재 접기/펼치기 상태 반환
   */
  getCollapseStatus() {
    return {
      isCollapsed: this.isCollapsed,
      originalBounds: this.originalBounds
    };
  }
}

// 싱글톤 인스턴스 내보내기
export const miniWindowManager = new MiniWindowManager();