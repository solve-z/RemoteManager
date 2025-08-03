/**
 * GroupService - 그룹 관련 비즈니스 로직
 * 그룹 생성, 수정, 삭제 및 프로세스 할당 관리
 */

export class GroupService {
  constructor(groupStore, processStore, notificationService) {
    this.groupStore = groupStore;
    this.processStore = processStore;
    this.notificationService = notificationService;
  }

  /**
   * 그룹 생성
   * @param {string} name - 그룹명
   * @returns {Object|null} 생성된 그룹 객체
   */
  createGroup(name) {
    try {
      if (!name || !name.trim()) {
        throw new Error('그룹명을 입력해주세요.');
      }

      const trimmedName = name.trim();
      
      if (trimmedName.length > 50) {
        throw new Error('그룹명은 50자 이하로 입력해주세요.');
      }

      const group = this.groupStore.createGroup(trimmedName);
      
      this.notificationService?.showSuccess(`그룹 '${group.name}'이 생성되었습니다.`);
      
      return group;
    } catch (error) {
      console.error('그룹 생성 실패:', error);
      this.notificationService?.showError('그룹 생성 실패', error.message);
      return null;
    }
  }

  /**
   * 그룹 수정
   * @param {string} groupId - 그룹 ID
   * @param {Object} updates - 수정할 정보
   * @returns {boolean} 성공 여부
   */
  updateGroup(groupId, updates) {
    try {
      const group = this.groupStore.getGroup(groupId);
      if (!group) {
        throw new Error('그룹을 찾을 수 없습니다.');
      }

      // 이름 유효성 검사
      if (updates.name !== undefined) {
        if (!updates.name || !updates.name.trim()) {
          throw new Error('그룹명을 입력해주세요.');
        }
        
        if (updates.name.trim().length > 50) {
          throw new Error('그룹명은 50자 이하로 입력해주세요.');
        }
      }

      const oldName = group.name;
      const success = this.groupStore.updateGroup(groupId, updates);
      
      if (success) {
        const newName = updates.name ? updates.name.trim() : oldName;
        this.notificationService?.showSuccess(
          `그룹 '${oldName}'이 '${newName}'으로 수정되었습니다.`
        );
      }

      return success;
    } catch (error) {
      console.error('그룹 수정 실패:', error);
      this.notificationService?.showError('그룹 수정 실패', error.message);
      return false;
    }
  }

  /**
   * 그룹 삭제
   * @param {string} groupId - 그룹 ID
   * @param {boolean} force - 강제 삭제 여부 (프로세스가 있어도 삭제)
   * @returns {boolean} 성공 여부
   */
  deleteGroup(groupId, force = false) {
    try {
      const group = this.groupStore.getGroup(groupId);
      if (!group) {
        throw new Error('그룹을 찾을 수 없습니다.');
      }

      // 그룹에 프로세스가 있는지 확인
      if (!force && group.processIds.length > 0) {
        throw new Error(
          `그룹 '${group.name}'에 ${group.processIds.length}개의 프로세스가 있습니다. ` +
          '먼저 프로세스를 다른 그룹으로 이동하거나 그룹에서 제거해주세요.'
        );
      }

      // 그룹에 속한 프로세스들의 그룹 할당 해제
      for (const processId of group.processIds) {
        this.processStore.updateProcessSettings(processId, { groupId: null });
      }

      const success = this.groupStore.deleteGroup(groupId);
      
      if (success) {
        this.notificationService?.showSuccess(`그룹 '${group.name}'이 삭제되었습니다.`);
      }

      return success;
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
      this.notificationService?.showError('그룹 삭제 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스를 그룹에 할당
   * @param {string} processId - 프로세스 ID
   * @param {string|null} groupId - 그룹 ID (null이면 그룹 해제)
   * @returns {boolean} 성공 여부
   */
  assignProcessToGroup(processId, groupId) {
    try {
      const process = this.processStore.getProcess(processId);
      if (!process) {
        throw new Error('프로세스를 찾을 수 없습니다.');
      }

      let targetGroup = null;
      if (groupId) {
        targetGroup = this.groupStore.getGroup(groupId);
        if (!targetGroup) {
          throw new Error('대상 그룹을 찾을 수 없습니다.');
        }
      }

      // 현재 그룹에서 제거
      const currentGroup = this.groupStore.getGroupByProcessId(processId);
      
      // 그룹 스토어에서 할당 변경 (안정적 키 저장을 위해 processInfo 전달)
      const success = this.groupStore.assignProcessToGroup(processId, groupId, process);
      
      if (success) {
        // 프로세스 스토어에도 반영
        this.processStore.updateProcessSettings(processId, { groupId });

        // 알림 메시지
        const processName = process.customLabel || process.computerName || 'Unknown';
        
        if (groupId) {
          this.notificationService?.showSuccess(
            `'${processName}'이 그룹 '${targetGroup.name}'에 추가되었습니다.`
          );
        } else {
          const oldGroupName = currentGroup ? currentGroup.name : '알 수 없음';
          this.notificationService?.showSuccess(
            `'${processName}'이 그룹 '${oldGroupName}'에서 제거되었습니다.`
          );
        }
      }

      return success;
    } catch (error) {
      console.error('프로세스 그룹 할당 실패:', error);
      this.notificationService?.showError('그룹 할당 실패', error.message);
      return false;
    }
  }

  /**
   * 프로세스를 다른 그룹으로 이동
   * @param {string} processId - 프로세스 ID
   * @param {string} fromGroupId - 원본 그룹 ID
   * @param {string} toGroupId - 대상 그룹 ID
   * @returns {boolean} 성공 여부
   */
  moveProcessBetweenGroups(processId, fromGroupId, toGroupId) {
    try {
      const process = this.processStore.getProcess(processId);
      const fromGroup = this.groupStore.getGroup(fromGroupId);
      const toGroup = this.groupStore.getGroup(toGroupId);

      if (!process) {
        throw new Error('프로세스를 찾을 수 없습니다.');
      }

      if (!fromGroup) {
        throw new Error('원본 그룹을 찾을 수 없습니다.');
      }

      if (!toGroup) {
        throw new Error('대상 그룹을 찾을 수 없습니다.');
      }

      if (fromGroupId === toGroupId) {
        return true; // 같은 그룹으로는 이동할 필요 없음
      }

      const success = this.assignProcessToGroup(processId, toGroupId);
      
      if (success) {
        const processName = process.customLabel || process.computerName || 'Unknown';
        this.notificationService?.showSuccess(
          `'${processName}'이 그룹 '${fromGroup.name}'에서 '${toGroup.name}'으로 이동되었습니다.`
        );
      }

      return success;
    } catch (error) {
      console.error('프로세스 그룹 이동 실패:', error);
      this.notificationService?.showError('그룹 이동 실패', error.message);
      return false;
    }
  }

  /**
   * 그룹 내 프로세스 순서 변경
   * @param {string} groupId - 그룹 ID
   * @param {string} processId - 프로세스 ID
   * @param {number} newIndex - 새 인덱스
   * @returns {boolean} 성공 여부
   */
  reorderProcessInGroup(groupId, processId, newIndex) {
    try {
      const group = this.groupStore.getGroup(groupId);
      if (!group) {
        throw new Error('그룹을 찾을 수 없습니다.');
      }

      if (newIndex < 0 || newIndex >= group.processIds.length) {
        throw new Error('잘못된 인덱스입니다.');
      }

      const success = this.groupStore.reorderProcessInGroup(groupId, processId, newIndex);
      
      if (success) {
        this.notificationService?.showSuccess('프로세스 순서가 변경되었습니다.');
      }

      return success;
    } catch (error) {
      console.error('프로세스 순서 변경 실패:', error);
      this.notificationService?.showError('순서 변경 실패', error.message);
      return false;
    }
  }

  /**
   * 그룹별 프로세스 통계
   * @param {string} groupId - 그룹 ID
   * @returns {Object} 통계 정보
   */
  getGroupStatistics(groupId) {
    try {
      const group = this.groupStore.getGroup(groupId);
      if (!group) {
        return null;
      }

      const processes = group.processIds
        .map(id => this.processStore.getProcess(id))
        .filter(p => p !== null);

      return {
        totalProcesses: processes.length,
        connectedProcesses: processes.filter(p => p.status === 'connected').length,
        disconnectedProcesses: processes.filter(p => p.status === 'disconnected').length,
        ezhelpProcesses: processes.filter(p => p.type === 'ezhelp').length,
        teamviewerProcesses: processes.filter(p => p.type === 'teamviewer').length,
        processesWithLabels: processes.filter(p => p.customLabel).length,
        processesWithCategories: processes.filter(p => p.category).length,
      };
    } catch (error) {
      console.error('그룹 통계 조회 실패:', error);
      return null;
    }
  }

  /**
   * 그룹에 속하지 않은 프로세스들 가져오기
   * @returns {Array} 그룹 없는 프로세스 배열
   */
  getUngroupedProcesses() {
    return this.processStore.getAllProcesses().filter(p => !p.groupId);
  }

  /**
   * 활성 그룹만 가져오기 (프로세스가 있는 그룹)
   * @returns {Array} 활성 그룹 배열
   */
  getActiveGroups() {
    return this.groupStore.getAllGroups().filter(group => {
      const activeProcesses = group.processIds
        .map(id => this.processStore.getProcess(id))
        .filter(p => p !== null);
      return activeProcesses.length > 0;
    });
  }

  /**
   * 빈 그룹들 가져오기
   * @returns {Array} 빈 그룹 배열
   */
  getEmptyGroups() {
    return this.groupStore.getAllGroups().filter(group => {
      const activeProcesses = group.processIds
        .map(id => this.processStore.getProcess(id))
        .filter(p => p !== null);
      return activeProcesses.length === 0;
    });
  }

  /**
   * 빈 그룹들 정리
   * @returns {number} 삭제된 그룹 수
   */
  cleanupEmptyGroups() {
    try {
      const emptyGroups = this.getEmptyGroups();
      let deletedCount = 0;

      for (const group of emptyGroups) {
        if (this.groupStore.deleteGroup(group.id)) {
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        this.notificationService?.showSuccess(
          `${deletedCount}개의 빈 그룹이 정리되었습니다.`
        );
      }

      return deletedCount;
    } catch (error) {
      console.error('빈 그룹 정리 실패:', error);
      this.notificationService?.showError('그룹 정리 실패', error.message);
      return 0;
    }
  }

  /**
   * 그룹 데이터 내보내기
   * @returns {Object} 내보낼 그룹 데이터
   */
  exportGroups() {
    try {
      const data = this.groupStore.exportData();
      this.notificationService?.showSuccess('그룹 데이터가 내보내기되었습니다.');
      return data;
    } catch (error) {
      console.error('그룹 데이터 내보내기 실패:', error);
      this.notificationService?.showError('데이터 내보내기 실패', error.message);
      return null;
    }
  }

  /**
   * 그룹 데이터 가져오기
   * @param {Object} data - 가져올 그룹 데이터
   * @returns {boolean} 성공 여부
   */
  importGroups(data) {
    try {
      const success = this.groupStore.importData(data);
      
      if (success) {
        this.notificationService?.showSuccess('그룹 데이터가 가져오기되었습니다.');
      }

      return success;
    } catch (error) {
      console.error('그룹 데이터 가져오기 실패:', error);
      this.notificationService?.showError('데이터 가져오기 실패', error.message);
      return false;
    }
  }

  /**
   * 전체 그룹 통계
   * @returns {Object} 전체 통계 정보
   */
  getOverallStatistics() {
    const allGroups = this.groupStore.getAllGroups();
    const allProcesses = this.processStore.getAllProcesses();
    
    return {
      totalGroups: allGroups.length,
      activeGroups: this.getActiveGroups().length,
      emptyGroups: this.getEmptyGroups().length,
      totalProcesses: allProcesses.length,
      groupedProcesses: allProcesses.filter(p => p.groupId).length,
      ungroupedProcesses: allProcesses.filter(p => !p.groupId).length,
      averageProcessesPerGroup: allGroups.length > 0 
        ? Math.round(allProcesses.filter(p => p.groupId).length / allGroups.length * 10) / 10
        : 0,
    };
  }
}