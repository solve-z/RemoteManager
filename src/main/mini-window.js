/**
 * MiniWindow - 최상위 고정 미니창 관리 모듈
 * AlwaysOnTop, 투명도, 트리 구조 리스트를 위한 별도 창
 */

import { BrowserWindow, Menu } from 'electron';
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
      width: 350,
      height: 500,
      minWidth: 280,
      minHeight: 200,
      
      // 최상위 고정 및 프레임리스 설정
      alwaysOnTop: true,
      frame: false,
      resizable: true,
      skipTaskbar: true, // 작업표시줄에서 숨김
      
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

    return this.miniWindow;
  }

  /**
   * 미니창 표시
   */
  showMiniWindow() {
    if (this.miniWindow) {
      this.miniWindow.show();
      this.miniWindow.focus();
      this.isVisible = true;
    }
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
}

// 싱글톤 인스턴스 내보내기
export const miniWindowManager = new MiniWindowManager();