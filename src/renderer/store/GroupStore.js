/**
 * GroupStore - 그룹 데이터 관리 스토어
 * 프로세스 그룹화를 위한 중앙 집중식 데이터 관리
 */

export class GroupStore {
  constructor() {
    this.groups = new Map(); // id -> ProcessGroup
    this.listeners = new Set();
    this.load();
  }

  /**
   * 그룹 생성
   * @param {string} name - 그룹명
   * @returns {Object} 생성된 그룹 객체
   */
  createGroup(name) {
    // 중복 이름 확인
    if (this.isGroupNameExists(name)) {
      throw new Error(`그룹명 '${name}'이 이미 존재합니다.`);
    }

    const group = {
      id: this.generateGroupId(),
      name: name.trim(),
      processIds: [],
      createdAt: new Date(),
      color: this.getRandomColor(),
    };

    this.groups.set(group.id, group);
    this.save();
    this.notifyListeners();
    
    return group;
  }

  /**
   * 그룹 수정
   * @param {string} groupId - 그룹 ID
   * @param {Object} updates - 업데이트할 정보
   * @returns {boolean} 성공 여부
   */
  updateGroup(groupId, updates) {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    // 이름 변경 시 중복 확인
    if (updates.name && updates.name !== group.name) {
      if (this.isGroupNameExists(updates.name)) {
        throw new Error(`그룹명 '${updates.name}'이 이미 존재합니다.`);
      }
      group.name = updates.name.trim();
    }

    // 색상 변경
    if (updates.color) {
      group.color = updates.color;
    }

    this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * 그룹 삭제
   * @param {string} groupId - 그룹 ID
   * @returns {boolean} 성공 여부
   */
  deleteGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    this.groups.delete(groupId);
    this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * 프로세스를 그룹에 할당
   * @param {string} processId - 프로세스 ID
   * @param {string|null} groupId - 그룹 ID (null이면 그룹 해제)
   * @returns {boolean} 성공 여부
   */
  assignProcessToGroup(processId, groupId) {
    // 모든 그룹에서 해당 프로세스 제거
    for (const group of this.groups.values()) {
      const index = group.processIds.indexOf(processId);
      if (index > -1) {
        group.processIds.splice(index, 1);
      }
    }

    // 새 그룹에 추가 (null이면 그룹 해제)
    if (groupId && this.groups.has(groupId)) {
      const group = this.groups.get(groupId);
      if (!group.processIds.includes(processId)) {
        group.processIds.push(processId);
      }
    }

    this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * 프로세스의 그룹 할당 해제
   * @param {string} processId - 프로세스 ID
   * @returns {boolean} 성공 여부
   */
  unassignProcessFromGroup(processId) {
    return this.assignProcessToGroup(processId, null);
  }

  /**
   * 그룹 내 프로세스 순서 변경
   * @param {string} groupId - 그룹 ID
   * @param {string} processId - 프로세스 ID
   * @param {number} newIndex - 새 인덱스
   * @returns {boolean} 성공 여부
   */
  reorderProcessInGroup(groupId, processId, newIndex) {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    const currentIndex = group.processIds.indexOf(processId);
    if (currentIndex === -1) {
      return false;
    }

    // 배열에서 제거하고 새 위치에 삽입
    group.processIds.splice(currentIndex, 1);
    group.processIds.splice(newIndex, 0, processId);

    this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * 특정 그룹 가져오기
   * @param {string} groupId - 그룹 ID
   * @returns {Object|null} 그룹 객체
   */
  getGroup(groupId) {
    return this.groups.get(groupId) || null;
  }

  /**
   * 모든 그룹 가져오기
   * @returns {Array} 그룹 배열
   */
  getAllGroups() {
    return Array.from(this.groups.values())
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 프로세스가 속한 그룹 찾기
   * @param {string} processId - 프로세스 ID
   * @returns {Object|null} 그룹 객체
   */
  getGroupByProcessId(processId) {
    for (const group of this.groups.values()) {
      if (group.processIds.includes(processId)) {
        return group;
      }
    }
    return null;
  }

  /**
   * 그룹명 중복 확인
   * @param {string} name - 그룹명
   * @returns {boolean} 중복 여부
   */
  isGroupNameExists(name) {
    const trimmedName = name.trim().toLowerCase();
    for (const group of this.groups.values()) {
      if (group.name.toLowerCase() === trimmedName) {
        return true;
      }
    }
    return false;
  }

  /**
   * 그룹 통계 정보
   * @returns {Object} 통계 객체
   */
  getStatistics() {
    const groups = this.getAllGroups();
    return {
      totalGroups: groups.length,
      totalProcessesInGroups: groups.reduce((sum, group) => sum + group.processIds.length, 0),
      averageProcessesPerGroup: groups.length > 0 
        ? Math.round(groups.reduce((sum, group) => sum + group.processIds.length, 0) / groups.length * 10) / 10
        : 0,
      largestGroup: groups.reduce((max, group) => 
        group.processIds.length > (max?.processIds?.length || 0) ? group : max, null),
    };
  }

  /**
   * 그룹 ID 생성
   * @returns {string} 고유한 그룹 ID
   */
  generateGroupId() {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 랜덤 색상 생성
   * @returns {string} 색상 코드
   */
  getRandomColor() {
    const colors = [
      '#3b82f6', // 파란색
      '#10b981', // 녹색
      '#f59e0b', // 주황색
      '#ef4444', // 빨간색
      '#8b5cf6', // 보라색
      '#06b6d4', // 청록색
      '#84cc16', // 라임
      '#f97316', // 오렌지
      '#ec4899', // 핑크
      '#6366f1', // 인디고
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * localStorage에서 데이터 로드
   */
  load() {
    try {
      const data = localStorage.getItem('remotemanager_groups_v4');
      if (data) {
        const groupsArray = JSON.parse(data);
        this.groups = new Map(groupsArray.map(group => {
          // Date 객체 복원
          group.createdAt = new Date(group.createdAt);
          return [group.id, group];
        }));
      }
    } catch (error) {
      console.error('그룹 데이터 로드 실패:', error);
      this.groups = new Map();
    }
  }

  /**
   * localStorage에 데이터 저장
   */
  save() {
    try {
      const groupsArray = Array.from(this.groups.values());
      localStorage.setItem('remotemanager_groups_v4', JSON.stringify(groupsArray));
    } catch (error) {
      console.error('그룹 데이터 저장 실패:', error);
    }
  }

  /**
   * 데이터 내보내기
   * @returns {Object} 내보낼 데이터
   */
  exportData() {
    return {
      version: '4.0',
      timestamp: new Date().toISOString(),
      groups: Array.from(this.groups.values()),
    };
  }

  /**
   * 데이터 가져오기
   * @param {Object} data - 가져올 데이터
   * @returns {boolean} 성공 여부
   */
  importData(data) {
    try {
      if (!data.groups || !Array.isArray(data.groups)) {
        throw new Error('잘못된 데이터 형식입니다.');
      }

      this.groups.clear();

      for (const groupData of data.groups) {
        const group = {
          id: groupData.id || this.generateGroupId(),
          name: groupData.name,
          processIds: groupData.processIds || [],
          createdAt: new Date(groupData.createdAt),
          color: groupData.color || this.getRandomColor(),
        };
        this.groups.set(group.id, group);
      }

      this.save();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('그룹 데이터 가져오기 실패:', error);
      return false;
    }
  }

  /**
   * 리스너 등록
   * @param {Function} listener - 상태 변경 리스너
   * @returns {Function} 언구독 함수
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 모든 리스너에게 변경 알림
   */
  notifyListeners() {
    const groups = this.getAllGroups();
    this.listeners.forEach(listener => {
      try {
        listener(groups);
      } catch (error) {
        console.error('그룹 스토어 리스너 에러:', error);
      }
    });
  }

  /**
   * 스토어 초기화
   */
  clear() {
    this.groups.clear();
    this.save();
    this.notifyListeners();
  }

  /**
   * 스토어 정리
   */
  cleanup() {
    this.listeners.clear();
  }
}