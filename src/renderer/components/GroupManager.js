/**
 * GroupManager - 그룹 관리 컴포넌트
 * 그룹 다이얼로그 및 고급 그룹 관리 기능
 */

export class GroupManager {
  constructor(groupStore, groupService) {
    this.groupStore = groupStore;
    this.groupService = groupService;
    this.dialog = null;
    this.initialize();
  }

  /**
   * 그룹 매니저 초기화
   */
  initialize() {
    this.findDialogElements();
  }

  /**
   * 다이얼로그 요소들 찾기
   */
  findDialogElements() {
    this.dialog = document.getElementById('group-dialog');
    this.titleElement = document.getElementById('group-dialog-title');
    this.inputElement = document.getElementById('group-name-input');
    this.saveButton = document.getElementById('group-dialog-save');
    this.cancelButton = document.getElementById('group-dialog-cancel');
    this.closeButton = document.getElementById('group-dialog-close');
  }

  /**
   * 그룹 추가 다이얼로그 표시
   */
  showAddDialog() {
    if (!this.dialog) return;

    this.titleElement.textContent = '그룹 추가';
    this.inputElement.value = '';
    this.inputElement.placeholder = '그룹명을 입력하세요';
    
    this.showDialog((groupName) => {
      if (groupName.trim()) {
        this.groupService.createGroup(groupName.trim());
      }
    });
  }

  /**
   * 그룹 수정 다이얼로그 표시
   * @param {Object} group - 수정할 그룹 객체
   */
  showEditDialog(group) {
    if (!this.dialog || !group) return;

    this.titleElement.textContent = '그룹 수정';
    this.inputElement.value = group.name;
    this.inputElement.placeholder = '그룹명을 입력하세요';
    
    this.showDialog((groupName) => {
      if (groupName.trim() && groupName.trim() !== group.name) {
        this.groupService.updateGroup(group.id, { name: groupName.trim() });
      }
    });
  }

  /**
   * 다이얼로그 표시 및 이벤트 처리
   * @param {Function} onSave - 저장 콜백 함수
   */
  showDialog(onSave) {
    if (!this.dialog) return;

    // 다이얼로그 표시
    this.dialog.style.display = 'flex';
    this.inputElement.focus();
    this.inputElement.select();

    // 기존 이벤트 리스너 제거 (클로닝으로)
    const newSaveButton = this.saveButton.cloneNode(true);
    const newCancelButton = this.cancelButton.cloneNode(true);
    const newCloseButton = this.closeButton.cloneNode(true);
    
    this.saveButton.parentNode.replaceChild(newSaveButton, this.saveButton);
    this.cancelButton.parentNode.replaceChild(newCancelButton, this.cancelButton);
    this.closeButton.parentNode.replaceChild(newCloseButton, this.closeButton);
    
    this.saveButton = newSaveButton;
    this.cancelButton = newCancelButton;
    this.closeButton = newCloseButton;

    // 정리 함수
    const cleanup = () => {
      this.dialog.style.display = 'none';
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('click', clickOutsideHandler);
    };

    // 저장 버튼
    this.saveButton.addEventListener('click', () => {
      onSave(this.inputElement.value);
      cleanup();
    });

    // 취소/닫기 버튼
    const cancelHandler = () => cleanup();
    this.cancelButton.addEventListener('click', cancelHandler);
    this.closeButton.addEventListener('click', cancelHandler);

    // 키보드 이벤트
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(this.inputElement.value);
        cleanup();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    };
    document.addEventListener('keydown', keyHandler);

    // 다이얼로그 외부 클릭
    const clickOutsideHandler = (e) => {
      if (e.target === this.dialog) {
        cleanup();
      }
    };
    document.addEventListener('click', clickOutsideHandler);
  }

  /**
   * 그룹 삭제 확인 다이얼로그
   * @param {Object} group - 삭제할 그룹 객체
   */
  confirmDelete(group) {
    if (!group) return;

    const processCount = group.processIds.length;
    let message = `그룹 '${group.name}'을 삭제하시겠습니까?`;
    
    if (processCount > 0) {
      message += `\n\n⚠️ 이 그룹에는 ${processCount}개의 프로세스가 있습니다.\n삭제하면 프로세스들이 그룹에서 제거됩니다.`;
    }

    if (confirm(message)) {
      const force = processCount > 0;
      this.groupService.deleteGroup(group.id, force);
    }
  }

  /**
   * 그룹 색상 변경 다이얼로그
   * @param {Object} group - 색상을 변경할 그룹 객체
   */
  showColorDialog(group) {
    if (!group) return;

    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];

    // 간단한 색상 선택 프롬프트 (향후 더 나은 UI로 교체 가능)
    const colorOptions = colors.map((color, index) => 
      `${index + 1}. ${color}`
    ).join('\n');

    const choice = prompt(
      `그룹 '${group.name}'의 색상을 선택하세요:\n\n${colorOptions}\n\n번호를 입력하세요 (1-${colors.length}):`
    );

    const colorIndex = parseInt(choice) - 1;
    if (colorIndex >= 0 && colorIndex < colors.length) {
      this.groupService.updateGroup(group.id, { color: colors[colorIndex] });
    }
  }

  /**
   * 그룹 통계 표시
   * @param {string} groupId - 그룹 ID
   */
  showGroupStatistics(groupId) {
    const stats = this.groupService.getGroupStatistics(groupId);
    const group = this.groupStore.getGroup(groupId);
    
    if (!stats || !group) return;

    const message = `
그룹 '${group.name}' 통계:

📊 전체 프로세스: ${stats.totalProcesses}개
🟢 연결됨: ${stats.connectedProcesses}개
🔴 끊어짐: ${stats.disconnectedProcesses}개

💻 ezHelp: ${stats.ezhelpProcesses}개
🖥️ TeamViewer: ${stats.teamviewerProcesses}개

🏷️ 라벨 있음: ${stats.processesWithLabels}개
🎯 카테고리 있음: ${stats.processesWithCategories}개
    `.trim();

    alert(message);
  }

  /**
   * 빈 그룹들 정리
   */
  cleanupEmptyGroups() {
    const emptyGroups = this.groupService.getEmptyGroups();
    
    if (emptyGroups.length === 0) {
      alert('정리할 빈 그룹이 없습니다.');
      return;
    }

    const groupNames = emptyGroups.map(g => g.name).join(', ');
    const message = `다음 빈 그룹들을 삭제하시겠습니까?\n\n${groupNames}`;

    if (confirm(message)) {
      const deletedCount = this.groupService.cleanupEmptyGroups();
      if (deletedCount > 0) {
        alert(`${deletedCount}개의 빈 그룹이 정리되었습니다.`);
      }
    }
  }

  /**
   * 전체 그룹 통계 표시
   */
  showOverallStatistics() {
    const stats = this.groupService.getOverallStatistics();
    
    const message = `
전체 그룹 통계:

📁 전체 그룹: ${stats.totalGroups}개
✅ 활성 그룹: ${stats.activeGroups}개
❌ 빈 그룹: ${stats.emptyGroups}개

💻 전체 프로세스: ${stats.totalProcesses}개
📁 그룹 소속: ${stats.groupedProcesses}개
🆓 그룹 없음: ${stats.ungroupedProcesses}개

📊 그룹당 평균: ${stats.averageProcessesPerGroup}개
    `.trim();

    alert(message);
  }

  /**
   * 그룹 데이터 내보내기
   */
  exportGroups() {
    const data = this.groupService.exportGroups();
    if (!data) return;

    // JSON 데이터를 다운로드 가능한 형태로 변환
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `remotemanager-groups-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 그룹 데이터 가져오기
   */
  importGroups() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const success = this.groupService.importGroups(data);
          
          if (success) {
            alert('그룹 데이터를 성공적으로 가져왔습니다.');
          } else {
            alert('그룹 데이터 가져오기에 실패했습니다.');
          }
        } catch (error) {
          alert('잘못된 파일 형식입니다.');
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }
}