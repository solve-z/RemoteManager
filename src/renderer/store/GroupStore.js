/**
 * GroupStore - 그룹 데이터 관리 스토어
 * 프로세스 그룹화를 위한 중앙 집중식 데이터 관리
 */

import { KeyManager } from '../services/KeyManager.js';

export class GroupStore {
  constructor() {
    this.groups = new Map(); // id -> ProcessGroup
    this.stableKeyGroupMap = new Map(); // stableKey -> groupId (안정적 그룹 할당)
    this.stableKeyCategoryMap = new Map(); // stableKey -> category (안정적 카테고리 할당)
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

    const maxOrder = Math.max(-1, ...Array.from(this.groups.values()).map(g => g.order ?? 0));
    const group = {
      id: this.generateGroupId(),
      name: name.trim(),
      processIds: [],
      createdAt: new Date(),
      color: this.getRandomColor(),
      order: maxOrder + 1,
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

    // 삭제될 그룹과 연결된 안정적 키 매핑들을 찾아서 제거
    const keysToDelete = [];
    for (const [stableKey, mappedGroupId] of this.stableKeyGroupMap.entries()) {
      if (mappedGroupId === groupId) {
        keysToDelete.push(stableKey);
      }
    }

    // 안정적 키 매핑에서 제거
    for (const key of keysToDelete) {
      this.stableKeyGroupMap.delete(key);
    }

    console.log('🗑️ 그룹 삭제 시 안정적 키 매핑 정리:', {
      deletedGroupId: groupId,
      groupName: group.name,
      deletedStableKeys: keysToDelete,
      remainingMappings: this.stableKeyGroupMap.size,
    });

    // 그룹 삭제
    this.groups.delete(groupId);
    this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * 프로세스를 그룹에 할당 (안정적 키 기반)
   * @param {string} processId - 프로세스 ID
   * @param {string|null} groupId - 그룹 ID (null이면 그룹 해제)
   * @param {Object} processInfo - 프로세스 정보 (안정적 키 생성용)
   * @returns {boolean} 성공 여부
   */
  assignProcessToGroup(processId, groupId, processInfo = null) {
    // 모든 그룹에서 해당 프로세스 제거
    for (const group of this.groups.values()) {
      const index = group.processIds.indexOf(processId);
      if (index > -1) {
        group.processIds.splice(index, 1);
      }
    }

    // 안정적 키 기반 그룹 할당 저장
    if (processInfo) {
      const stableKey = KeyManager.getStableIdentifier(processInfo);
      console.log('💾 그룹 할당 저장:', {
        processId: processId,
        groupId: groupId,
        stableKey: stableKey,
        computerName:
          processInfo.computerName ||
          KeyManager.extractComputerName(processInfo),
        type: processInfo.type || KeyManager.detectProcessType(processInfo),
      });

      if (groupId) {
        this.stableKeyGroupMap.set(stableKey, groupId);
        console.log('✅ 안정적 키 맵에 저장됨:', {
          stableKey: stableKey,
          groupId: groupId,
          totalMappings: this.stableKeyGroupMap.size,
        });
      } else {
        this.stableKeyGroupMap.delete(stableKey);
        console.log('🗑️ 안정적 키 맵에서 제거됨:', stableKey);
      }
    } else {
      console.warn('⚠️ processInfo가 없어서 안정적 키 저장 불가');
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
   * @param {Object} processInfo - 프로세스 정보 (안정적 키 생성용)
   * @returns {boolean} 성공 여부
   */
  unassignProcessFromGroup(processId, processInfo = null) {
    return this.assignProcessToGroup(processId, null, processInfo);
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
   * 모든 그룹 가져오기 (order 기준 정렬, 없으면 createdAt 기준)
   * @returns {Array} 그룹 배열
   */
  getAllGroups() {
    return Array.from(this.groups.values()).sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }

  /**
   * 그룹 순서 변경 (위/아래 이동)
   * @param {string} groupId - 이동할 그룹 ID
   * @param {'up'|'down'} direction - 이동 방향
   * @returns {boolean} 성공 여부
   */
  moveGroup(groupId, direction) {
    const groups = this.getAllGroups();
    const currentIndex = groups.findIndex(g => g.id === groupId);
    if (currentIndex === -1) return false;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return false;

    // 배열 내에서 위치 이동
    const [movedGroup] = groups.splice(currentIndex, 1);
    groups.splice(targetIndex, 0, movedGroup);

    // 새 순서로 order 0부터 재할당
    groups.forEach((g, idx) => {
      g.order = idx;
    });

    // Map 자체도 정렬된 순서대로 재구성
    this.groups.clear();
    groups.forEach(g => {
      this.groups.set(g.id, g);
    });

    this.save();
    this.notifyListeners();
    return true;
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
   * 안정적 키로 그룹 ID 조회
   * @param {Object} processInfo - 프로세스 정보
   * @returns {string|null} 그룹 ID
   */
  getGroupByStableKey(processInfo) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    return this.stableKeyGroupMap.get(stableKey) || null;
  }

  /**
   * 안정적 키로 카테고리 조회
   * @param {Object} processInfo - 프로세스 정보
   * @returns {string|null} 카테고리
   */
  getCategoryByStableKey(processInfo) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    return this.stableKeyCategoryMap.get(stableKey) || null;
  }

  /**
   * 안정적 키로 카테고리 설정
   * @param {Object} processInfo - 프로세스 정보
   * @param {string|null} category - 카테고리
   */
  setCategoryByStableKey(processInfo, category) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    if (category) {
      this.stableKeyCategoryMap.set(stableKey, category);
    } else {
      this.stableKeyCategoryMap.delete(stableKey);
    }
    this.save();
  }

  /**
   * 프로세스에 저장된 그룹/카테고리 정보 복원
   * @param {Object} process - 프로세스 객체
   */
  restoreProcessGroupInfo(process) {
    const stableKey = KeyManager.getStableIdentifier(process);
    const savedGroupId = this.getGroupByStableKey(process);
    const savedCategory = this.getCategoryByStableKey(process);

    console.log('🔍 그룹 정보 복원 시도:', {
      processId: process.id,
      computerName: process.computerName,
      stableKey: stableKey,
      savedGroupId: savedGroupId,
      savedCategory: savedCategory,
      groupExists: savedGroupId ? this.groups.has(savedGroupId) : false,
      totalStableKeys: this.stableKeyGroupMap.size,
      allStableKeys: Array.from(this.stableKeyGroupMap.keys()),
    });

    // 그룹 정보 복원
    if (savedGroupId && this.groups.has(savedGroupId)) {
      process.groupId = savedGroupId;
      // 그룹의 processIds에도 추가 (중복 방지)
      const group = this.groups.get(savedGroupId);
      if (!group.processIds.includes(process.id)) {
        group.processIds.push(process.id);
        console.log('✅ 그룹에 프로세스 추가됨:', {
          groupName: group.name,
          processId: process.id,
          groupProcessCount: group.processIds.length,
        });
      }
    } else if (savedGroupId) {
      console.warn('⚠️ 저장된 그룹 ID가 존재하지 않음:', {
        savedGroupId: savedGroupId,
        availableGroups: Array.from(this.groups.keys()),
      });
    }

    // 카테고리 정보 복원
    if (savedCategory) {
      process.category = savedCategory;
      console.log('✅ 카테고리 복원됨:', savedCategory);
    }

    return { groupId: savedGroupId, category: savedCategory };
  }

  /**
   * 존재하지 않는 그룹 ID와 연결된 고아 매핑 정리
   * @returns {number} 정리된 매핑 수
   */
  cleanupOrphanedMappings() {
    let cleanupCount = 0;
    const keysToDelete = [];

    // 존재하지 않는 그룹 ID와 연결된 매핑 찾기
    for (const [stableKey, groupId] of this.stableKeyGroupMap.entries()) {
      if (!this.groups.has(groupId)) {
        keysToDelete.push(stableKey);
        cleanupCount++;
      }
    }

    // 고아 매핑 삭제
    for (const key of keysToDelete) {
      this.stableKeyGroupMap.delete(key);
    }

    if (cleanupCount > 0) {
      console.log('🧹 고아 매핑 정리:', {
        cleanupCount: cleanupCount,
        deletedKeys: keysToDelete,
        remainingMappings: this.stableKeyGroupMap.size,
      });
      this.save();
    }

    return cleanupCount;
  }

  /**
   * 그룹 통계 정보
   * @returns {Object} 통계 객체
   */
  getStatistics() {
    const groups = this.getAllGroups();
    const orphanedMappings = this.cleanupOrphanedMappings(); // 통계 조회 시 자동 정리

    return {
      totalGroups: groups.length,
      totalProcessesInGroups: groups.reduce(
        (sum, group) => sum + group.processIds.length,
        0
      ),
      averageProcessesPerGroup:
        groups.length > 0
          ? Math.round(
              (groups.reduce((sum, group) => sum + group.processIds.length, 0) /
                groups.length) *
                10
            ) / 10
          : 0,
      largestGroup: groups.reduce(
        (max, group) =>
          group.processIds.length > (max?.processIds?.length || 0)
            ? group
            : max,
        null
      ),
      totalStableKeys: this.stableKeyGroupMap.size,
      totalCategories: this.stableKeyCategoryMap.size,
      orphanedMappingsCleanedUp: orphanedMappings,
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
      console.log('📂 GroupStore 로드 시작:', { hasData: !!data });

      if (data) {
        const parsed = JSON.parse(data);
        console.log('📂 파싱된 데이터:', {
          isArray: Array.isArray(parsed),
          version: parsed.version,
          hasGroups: !!parsed.groups,
          hasStableKeyGroupMap: !!parsed.stableKeyGroupMap,
          hasStableKeyCategoryMap: !!parsed.stableKeyCategoryMap,
        });

        // 기존 형식 (배열)과 새 형식 (객체) 모두 지원
        if (Array.isArray(parsed)) {
          // 기존 그룹 데이터만 로드 (호환성)
          console.log('📂 기존 형식 (배열) 로드');
          this.groups = new Map(
            parsed.map(group => {
              group.createdAt = new Date(group.createdAt);
              return [group.id, group];
            })
          );
        } else {
          // 새 형식: 그룹 + 안정적 키 맵 데이터
          console.log('📂 새 형식 (객체) 로드');
          this.groups = new Map(
            (parsed.groups || []).map(group => {
              group.createdAt = new Date(group.createdAt);
              return [group.id, group];
            })
          );

          // 안정적 키 맵 복원
          if (parsed.stableKeyGroupMap) {
            this.stableKeyGroupMap = new Map(parsed.stableKeyGroupMap);
            console.log('✅ 안정적 키 그룹 맵 로드됨:', {
              count: this.stableKeyGroupMap.size,
              entries: Array.from(this.stableKeyGroupMap.entries()),
            });
          }
          if (parsed.stableKeyCategoryMap) {
            this.stableKeyCategoryMap = new Map(parsed.stableKeyCategoryMap);
            console.log(
              '✅ 안정적 키 카테고리 맵 로드됨:',
              this.stableKeyCategoryMap.size
            );
          }
        }

        console.log('📂 GroupStore 로드 완료:', {
          groupCount: this.groups.size,
          stableKeyGroupMappings: this.stableKeyGroupMap.size,
          stableKeyCategoryMappings: this.stableKeyCategoryMap.size,
        });
      }
    } catch (error) {
      console.error('그룹 데이터 로드 실패:', error);
      this.groups = new Map();
      this.stableKeyGroupMap = new Map();
      this.stableKeyCategoryMap = new Map();
    }
  }

  /**
   * localStorage에 데이터 저장
   */
  save() {
    try {
      const data = {
        version: '2.3.0',
        groups: Array.from(this.groups.values()),
        stableKeyGroupMap: Array.from(this.stableKeyGroupMap.entries()),
        stableKeyCategoryMap: Array.from(this.stableKeyCategoryMap.entries()),
        timestamp: new Date().toISOString(),
      };

      console.log('💾 GroupStore 저장:', {
        groupCount: data.groups.length,
        stableKeyMappings: data.stableKeyGroupMap.length,
        categoryMappings: data.stableKeyCategoryMap.length,
        stableKeys: data.stableKeyGroupMap.map(([key, groupId]) => ({
          key,
          groupId,
        })),
      });

      localStorage.setItem('remotemanager_groups_v4', JSON.stringify(data));
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
      version: '2.3.0',
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
