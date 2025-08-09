/**
 * ProcessStore - 프로세스 상태 관리 스토어
 * 단일 진실의 원천으로 모든 프로세스 데이터를 중앙 집중 관리
 */

import { KeyManager } from '../services/KeyManager.js';
import { ConflictDialog } from '../components/ConflictDialog.js';

/**
 * 프로세스 스토어 클래스
 */
export class ProcessStore {
  constructor() {
    this.processes = new Map(); // id -> RemoteProcess
    this.processHistory = new Map(); // matchingKey -> HistoryEntry
    this.stableKeyMap = new Map(); // stableKey -> processId (충돌 해결용)
    this.userPreferences = new Map(); // stableKey -> preference ('same', 'different', 'always_new')
    this.listeners = new Set();
    this.groupStore = null;
    this.conflictDialog = new ConflictDialog();

    // 세션 기반 중복 방지 시스템
    this.conflictDialogShown = new Set(); // 이 세션에서 이미 확인한 충돌들 (stableKey_WindowHandle 형태)
    this.sessionStartTime = Date.now(); // 세션 시작 시간 (프로그램 재시작 감지용)
  }

  /**
   * 그룹 스토어 설정
   * @param {GroupStore} groupStore - 그룹 스토어 인스턴스
   */
  setGroupStore(groupStore) {
    this.groupStore = groupStore;
  }

  /**
   * 프로세스 추가/업데이트 (충돌 감지 포함)
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object|Promise<Object>} 추가/업데이트된 프로세스 (충돌 시 Promise)
   */
  async updateProcess(processInfo) {
    const stableKey = KeyManager.getStableIdentifier(processInfo);
    const matchingKey = KeyManager.getMatchingKey(processInfo);

    // 1. 충돌 감지 및 처리 (재연결보다 우선)
    const conflictResult = await this.handlePotentialConflict(stableKey, processInfo);
    if (conflictResult) {
      return conflictResult;
    }

    // 2. 기존 프로세스 재연결 확인
    const existingHistory = this.processHistory.get(matchingKey);
    if (existingHistory) {
      console.log('🔄 기존 프로세스 재연결 경로 (충돌 감지 후):', {
        matchingKey: matchingKey,
        stableKey: stableKey,
        computerName: processInfo.computerName,
        existingProcessId: existingHistory.processId,
        existingStatus: existingHistory.status
      });
      return this.handleReconnection(existingHistory, processInfo);
    }

    // 3. 새 프로세스 추가
    console.log('🆕 새 프로세스 생성:', {
      stableKey: stableKey,
      matchingKey: matchingKey,
      computerName: processInfo.computerName,
      hasHistory: !!existingHistory,
      hasStableKeyConflict: this.stableKeyMap.has(stableKey)
    });
    // ★★★ 여기가 핵심 ★★★
    const newProcess = this.addNewProcess(processInfo); // 먼저 순수하게 프로세스만 생성
    this.stableKeyMap.set(stableKey, newProcess.id);  // 그 다음, 직접 stableKey를 매핑!

    return newProcess;
  }

  /**
   * 충돌 다이얼로그 표시 여부 판단 (스마트한 감지)
   * @param {string} stableKey - 안정적 식별자
   * @param {Object} existingProcess - 기존 프로세스
   * @param {Object} newProcessInfo - 새 프로세스 정보
   * @returns {boolean} 다이얼로그 표시 여부
   */
  shouldShowConflictDialog(stableKey, existingProcess, newProcessInfo) {
    console.log('🔍 충돌 다이얼로그 표시 판단:', {
      stableKey: stableKey,
      computerName: newProcessInfo.computerName,
      processType: newProcessInfo.type,
      existingStatus: existingProcess.status,
      existingPid: existingProcess.pid,
      existingWindowHandle: existingProcess.windowHandle,
      newPid: newProcessInfo.pid,
      newWindowHandle: newProcessInfo.windowHandle,
      sessionTime: Date.now() - this.sessionStartTime
    });

    // 같은 WindowHandle인 경우만 스킵 (정말 동일한 프로세스)
    const conflictKey = `${stableKey}_${newProcessInfo.windowHandle}`;
    if (this.conflictDialogShown.has(conflictKey)) {
      console.log('❌ 다이얼로그 스킵: 동일한 WindowHandle로 이미 확인함');
      return false;
    }

    // 프로그램 시작 후 5초 이내는 스킵 (재시작/새로고침 감지) - 10초→5초로 단축
    if (Date.now() - this.sessionStartTime < 5000) {
      console.log('❌ 다이얼로그 스킵: 프로그램 시작 5초 이내');
      return false;
    }

    // 새 프로세스가 실제 연결 상태가 아니면 스킵
    if (!newProcessInfo.windowHandle && !newProcessInfo.pid) {
      console.log('❌ 다이얼로그 스킵: 새 프로세스 정보 부족');
      return false;
    }

    // 기존 프로세스와 새 프로세스가 **완전히 동일한 정보**인 경우만 스킵 (정상적인 업데이트)
    // TeamViewer는 세션 방식이므로 WindowHandle이 가장 중요한 구분자
    const isSameExactProcess = existingProcess.status === 'connected' &&
      existingProcess.windowHandle === newProcessInfo.windowHandle &&
      existingProcess.windowTitle === newProcessInfo.windowTitle;
    // PID는 TeamViewer에서 동일할 수 있으므로 제외

    if (isSameExactProcess) {
      console.log('❌ 다이얼로그 스킵: 완전히 동일한 프로세스 (정상 업데이트)');
      return false;
    }

    // 식별 정보 비교 - TeamViewer의 경우 동일 컴퓨터명이면 항상 다이얼로그 표시
    const comparison = KeyManager.compareProcessInfo(existingProcess, newProcessInfo);
    const isTeamViewerSameName = newProcessInfo.type === 'teamviewer' &&
      comparison.sameComputer &&
      (existingProcess.windowHandle !== newProcessInfo.windowHandle ||
        existingProcess.pid !== newProcessInfo.pid);

    const hasEzHelpDifferences = comparison.ipChanged || comparison.counselorChanged;
    const hasWindowTitleDifferences = existingProcess.windowTitle !== newProcessInfo.windowTitle;

    const shouldShow = isTeamViewerSameName || hasEzHelpDifferences || hasWindowTitleDifferences;

    console.log('🎯 충돌 다이얼로그 판단 결과:', {
      isTeamViewerSameName: isTeamViewerSameName,
      hasEzHelpDifferences: hasEzHelpDifferences,
      hasWindowTitleDifferences: hasWindowTitleDifferences,
      shouldShow: shouldShow,
      sameComputer: comparison.sameComputer,
      ipChanged: comparison.ipChanged,
      counselorChanged: comparison.counselorChanged
    });

    return shouldShow;
  }

  /**
   * 잠재적 충돌 처리 (스마트한 감지 시스템)
   * @param {string} stableKey - 안정적 식별자
   * @param {Object} processInfo - 새 프로세스 정보
   * @returns {Object|null} 기존 프로세스 또는 null
   */
  async handlePotentialConflict(stableKey, processInfo) {
    const existingProcessId = this.stableKeyMap.get(stableKey);
    if (!existingProcessId) {
      return null; // 충돌 없음
    }

    const existingProcess = this.processes.get(existingProcessId);
    if (!existingProcess) {
      // 맵에는 있지만 프로세스가 없음 (정리 필요)
      this.stableKeyMap.delete(stableKey);
      return null;
    }

    // 사용자 기본 설정 확인
    const userPref = this.userPreferences.get(stableKey);
    if (userPref === 'always_new') {
      return this.createNewProcessWithSuffix(processInfo, stableKey);
    }

    // 충돌 상황 분석
    const comparison = KeyManager.compareProcessInfo(existingProcess, processInfo);

    // 상담원 번호 변경은 자동 업데이트 (동일한 컴퓨터로 간주)
    if (comparison.counselorChanged && !comparison.ipChanged) {
      console.log('👥 상담원 번호 변경 - 자동 업데이트:', {
        computerName: comparison.computerName,
        oldCounselorId: comparison.oldCounselorId,
        newCounselorId: comparison.newCounselorId
      });
      return this.updateExistingProcess(existingProcess, processInfo);
    }

    // 스마트한 다이얼로그 표시 판단
    if (this.shouldShowConflictDialog(stableKey, existingProcess, processInfo)) {
      console.log('⚠️ 동일 컴퓨터명 충돌 감지 - 사용자 확인 필요:', {
        stableKey: stableKey,
        computerName: processInfo.computerName,
        existingStatus: existingProcess.status,
        ipChanged: comparison.ipChanged,
        counselorChanged: comparison.counselorChanged
      });

      // 충돌 확인 기록 (WindowHandle 기반)
      const conflictKey = `${stableKey}_${processInfo.windowHandle}`;
      this.conflictDialogShown.add(conflictKey);

      // 사용자 확인 다이얼로그
      const choice = await this.conflictDialog.showConflictDialog(comparison);
      return this.handleUserChoice(choice, existingProcess, processInfo, stableKey);
    }

    // 일반적인 경우 - 기존 프로세스 업데이트
    return this.updateExistingProcess(existingProcess, processInfo);
  }

  /**
   * 사용자 선택 처리
   * @param {string} choice - 사용자 선택
   * @param {Object} existingProcess - 기존 프로세스
   * @param {Object} newProcessInfo - 새 프로세스 정보
   * @param {string} stableKey - 안정적 식별자
   * @returns {Object} 처리된 프로세스
   */
  handleUserChoice(choice, existingProcess, newProcessInfo, stableKey) {
    switch (choice) {
      case 'same':
        // 같은 컴퓨터 - 기존 프로세스 업데이트
        console.log('✅ 사용자 선택: 같은 컴퓨터 - 기존 프로세스 업데이트');
        return this.updateExistingProcess(existingProcess, newProcessInfo);

      case 'different':
        // 다른 컴퓨터 - 기존 프로세스는 그대로 두고 새 프로세스에 suffix 추가
        console.log('✅ 사용자 선택: 다른 컴퓨터 - 새 프로세스에 번호 추가');

        const originalStableKey = KeyManager.getStableIdentifier(existingProcess);

        // 새 프로세스용 고유 키 생성 (suffix 추가)
        const newSuffix = this.findNextSuffix(originalStableKey);
        const newUniqueKey = `${originalStableKey}_${newSuffix}`;

        // 새 프로세스 생성 (suffix 정보 포함)
        const enhancedNewProcessInfo = {
          ...newProcessInfo,
          multipleId: newSuffix // 새 프로세스에 번호 표시
        };
        const newProcess = this.addNewProcess(enhancedNewProcessInfo);
        this.stableKeyMap.set(newUniqueKey, newProcess.id);

        // 기존 프로세스에 일시적 보호 플래그 설정 (충돌 직후 보호, 이후 정상 감지)
        existingProcess.conflictProtected = Date.now() + 15000; // 15초간 보호 (충돌 직후 안정화)
        existingProcess.lastSeen = new Date(); // lastSeen 업데이트로 최신 상태 유지

        console.log('✨ 새 프로세스에 suffix 할당:', {
          processId: newProcess.id,
          originalKey: originalStableKey,
          newKey: newUniqueKey,
          suffix: newSuffix,
          existingProcessId: existingProcess.id,
          existingCustomLabel: existingProcess.customLabel,
          existingProtectedUntil: new Date(existingProcess.conflictProtected),
          strategy: '기존 프로세스는 일시적 보호 후 정상 감지, 새 프로세스에만 번호 표시'
        });

        // 두 프로세스 모두 알림
        this.notifyListeners();
        return newProcess;

      case 'always_new':
        // 항상 새로 등록 - 설정 저장 후 새 프로세스 생성
        console.log('✅ 사용자 선택: 항상 새로 등록');
        this.userPreferences.set(stableKey, 'always_new');
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);

      default:
        return this.createNewProcessWithSuffix(newProcessInfo, stableKey);
    }
  }

  /**
   * 다음 사용 가능한 suffix 찾기
   * @param {string} baseStableKey - 기본 안정적 식별자
   * @returns {number} 다음 suffix 번호 (2부터 시작)
   */
  findNextSuffix(baseStableKey) {
    let suffix = 2; // 기존 프로세스는 suffix 없이, 새 프로세스는 #2부터 시작
    while (this.stableKeyMap.has(`${baseStableKey}_${suffix}`)) {
      suffix++;
    }
    return suffix;
  }

  /**
   * 기존 프로세스 업데이트 (IP 변경 등)
   * @param {Object} existingProcess - 기존 프로세스
   * @param {Object} newProcessInfo - 새 프로세스 정보
   * @returns {Object} 업데이트된 프로세스
   */
  updateExistingProcess(existingProcess, newProcessInfo) {
    // 기존 프로세스 정보 업데이트
    existingProcess.pid = newProcessInfo.pid;
    existingProcess.windowTitle = newProcessInfo.windowTitle;
    existingProcess.windowHandle = newProcessInfo.windowHandle;

    // IP 주소 강제 재추출 (새로운 windowTitle에서)
    const newIpAddress = KeyManager.extractIpAddress(newProcessInfo);
    const oldIpAddress = existingProcess.ipAddress;
    existingProcess.ipAddress = newIpAddress || newProcessInfo.ipAddress || existingProcess.ipAddress;

    // 상담원 ID도 재추출 (ezHelp의 경우)
    let oldCounselorId = null;
    if (existingProcess.type === 'ezhelp') {
      oldCounselorId = existingProcess.counselorId;
      const newCounselorId = KeyManager.extractCounselorId(newProcessInfo);
      existingProcess.counselorId = newCounselorId || newProcessInfo.counselorId || existingProcess.counselorId;
    }

    // IP 변경 감지 로그
    if (oldIpAddress !== existingProcess.ipAddress) {
      console.log('🔄 IP 주소 업데이트 감지:', {
        processId: existingProcess.id,
        computerName: existingProcess.computerName,
        oldIP: oldIpAddress,
        newIP: existingProcess.ipAddress,
        windowTitle: newProcessInfo.windowTitle,
        extractedIP: newIpAddress,
        providedIP: newProcessInfo.ipAddress
      });
    }

    // 상담원 번호 변경 감지 로그
    if (existingProcess.type === 'ezhelp' && oldCounselorId && oldCounselorId !== existingProcess.counselorId) {
      console.log('👥 상담원 번호 업데이트 감지:', {
        processId: existingProcess.id,
        computerName: existingProcess.computerName,
        oldCounselorId: oldCounselorId,
        newCounselorId: existingProcess.counselorId,
        windowTitle: newProcessInfo.windowTitle
      });
    }

    existingProcess.status = 'connected';
    existingProcess.isMinimized = newProcessInfo.isMinimized || false;
    existingProcess.isHidden = newProcessInfo.isHidden || false;
    existingProcess.lastSeen = new Date();
    existingProcess.disconnectedAt = null;

    // 히스토리 업데이트
    const matchingKey = KeyManager.getMatchingKey(newProcessInfo);
    const historyEntry = this.processHistory.get(matchingKey);
    if (historyEntry) {
      historyEntry.currentPid = newProcessInfo.pid;
      historyEntry.status = 'connected';
      historyEntry.lastSeen = new Date();
      historyEntry.disconnectedTime = null;
    }

    this.notifyListeners();
    return existingProcess;
  }

  /**
   * 접미사를 붙여 새 프로세스 생성
   * @param {Object} processInfo - 프로세스 정보
   * @param {string} baseStableKey - 기본 안정적 식별자
   * @returns {Object} 새로 생성된 프로세스
   */
  createNewProcessWithSuffix(processInfo, baseStableKey) {
    // 기본 키가 이미 사용중인지 확인
    const isBaseKeyUsed = this.stableKeyMap.has(baseStableKey);

    // 고유한 stableKey 생성
    let suffix = 1;
    let uniqueStableKey = baseStableKey;
    while (this.stableKeyMap.has(uniqueStableKey)) {
      uniqueStableKey = `${baseStableKey}_${suffix}`;
      suffix++;
    }

    // 새 프로세스 생성 (suffix 정보 포함)
    const enhancedProcessInfo = {
      ...processInfo,
      // 기본 키가 이미 사용중이고 suffix가 붙었을 때만 표시
      multipleId: isBaseKeyUsed && suffix > 1 ? suffix : null
    };
    const process = this.addNewProcess(enhancedProcessInfo);

    // 고유한 안정적 키로 맵핑
    this.stableKeyMap.set(uniqueStableKey, process.id);

    console.log('🔢 Suffix 추가된 프로세스 생성:', {
      processId: process.id,
      computerName: process.computerName,
      originalKey: baseStableKey,
      uniqueKey: uniqueStableKey,
      multipleId: process.multipleId
    });

    return process;
  }

  /**
   * 새 프로세스 추가
   * @param {Object} processInfo - 프로세스 정보
   * @returns {Object} 새로 추가된 프로세스
   */
  addNewProcess(processInfo) {
    const processId = KeyManager.generateProcessId();
    const matchingKey = KeyManager.getMatchingKey(processInfo);
    // const stableKey = KeyManager.getStableIdentifier(processInfo);

    // 프로세스 생성 **전에** 저장된 그룹/카테고리 정보 확인
    let savedGroupId = null;
    let savedCategory = null;

    if (this.groupStore) {
      const stableKeyForLog = KeyManager.getStableIdentifier(processInfo); // 로그용으로만 임시 생성
      savedGroupId = this.groupStore.getGroupByStableKey(processInfo);
      savedCategory = this.groupStore.getCategoryByStableKey(processInfo);

      console.log('🎯 프로세스 생성 시 그룹 정보 미리 확인:', {
        processId: processId,
        stableKey: stableKeyForLog,
        computerName: processInfo.computerName,
        savedGroupId: savedGroupId,
        savedCategory: savedCategory,
        groupExists: savedGroupId ? this.groupStore.groups.has(savedGroupId) : false
      });
    }

    const process = {
      id: processId,
      pid: processInfo.pid,
      processName: processInfo.processName,
      windowTitle: processInfo.windowTitle,
      windowHandle: processInfo.windowHandle,
      type: processInfo.type,
      computerName: processInfo.computerName,
      ipAddress: processInfo.ipAddress,
      counselorId: processInfo.counselorId,
      status: 'connected',
      isMinimized: processInfo.isMinimized || false,
      isHidden: processInfo.isHidden || false,
      createdAt: new Date(),
      lastSeen: new Date(),
      disconnectedAt: null,
      customLabel: null,
      category: savedCategory, // 생성 시점에 바로 설정
      groupId: savedGroupId && this.groupStore?.groups.has(savedGroupId) ? savedGroupId : null, // 생성 시점에 바로 설정
      multipleId: processInfo.multipleId || null, // suffix 정보 추가
    };

    // 프로세스 맵에 추가
    this.processes.set(processId, process);

    // ★★★ 여기가 핵심: stableKey 매핑을 이 함수에서 하지 않습니다.
    // this.stableKeyMap.set(stableKey, processId);

    // 그룹이 할당된 경우 그룹의 processIds 배열에도 추가
    if (savedGroupId && this.groupStore?.groups.has(savedGroupId)) {
      const group = this.groupStore.groups.get(savedGroupId);
      if (!group.processIds.includes(processId)) {
        group.processIds.push(processId);
        this.groupStore.save(); // 변경사항 저장
        console.log('✅ 프로세스 생성 시 그룹에 즉시 추가:', {
          groupName: group.name,
          processId: processId,
          groupProcessCount: group.processIds.length
        });
      }
    }

    // 히스토리에 추가
    this.processHistory.set(matchingKey, {
      processId: processId,
      currentPid: processInfo.pid,
      originalPid: processInfo.pid,
      status: 'connected',
      lastSeen: new Date(),
      disconnectedTime: null,
    });

    this.notifyListeners();
    return process;
  }

  /**
   * 기존 프로세스 재연결 처리
   * @param {Object} historyEntry - 히스토리 엔트리
   * @param {Object} processInfo - 새 프로세스 정보
   * @returns {Object} 업데이트된 프로세스
   */
  handleReconnection(historyEntry, processInfo) {
    const process = this.processes.get(historyEntry.processId);

    console.log('🔄 handleReconnection 시작:', {
      historyProcessId: historyEntry.processId,
      processExists: !!process,
      processGroupId: process?.groupId,
      computerName: processInfo.computerName,
      type: processInfo.type
    });

    if (process) {
      // 기존 프로세스 업데이트
      process.pid = processInfo.pid;
      process.windowTitle = processInfo.windowTitle;
      process.windowHandle = processInfo.windowHandle;

      // IP 주소 강제 재추출 (재연결 시에도)
      const newIpAddress = KeyManager.extractIpAddress(processInfo);
      const oldIpAddress = process.ipAddress;
      process.ipAddress = newIpAddress || processInfo.ipAddress || process.ipAddress;

      // 상담원 ID도 재추출 (ezHelp의 경우)
      let oldCounselorId = null;
      if (process.type === 'ezhelp') {
        oldCounselorId = process.counselorId;
        const newCounselorId = KeyManager.extractCounselorId(processInfo);
        process.counselorId = newCounselorId || processInfo.counselorId || process.counselorId;
      }

      // IP 변경 감지 로그 (재연결 시)
      if (oldIpAddress !== process.ipAddress) {
        console.log('🔄 재연결 시 IP 주소 업데이트 감지:', {
          processId: process.id,
          computerName: process.computerName,
          oldIP: oldIpAddress,
          newIP: process.ipAddress,
          windowTitle: processInfo.windowTitle,
          extractedIP: newIpAddress,
          providedIP: processInfo.ipAddress
        });
      }

      // 상담원 번호 변경 감지 로그 (재연결 시)
      if (process.type === 'ezhelp' && oldCounselorId && oldCounselorId !== process.counselorId) {
        console.log('👥 재연결 시 상담원 번호 업데이트 감지:', {
          processId: process.id,
          computerName: process.computerName,
          oldCounselorId: oldCounselorId,
          newCounselorId: process.counselorId,
          windowTitle: processInfo.windowTitle
        });
      }

      process.status = historyEntry.status === 'disconnected' ? 'reconnected' : 'connected';
      process.isMinimized = processInfo.isMinimized || false;
      process.isHidden = processInfo.isHidden || false;
      process.lastSeen = new Date();
      process.disconnectedAt = null;

      // 히스토리 업데이트
      historyEntry.currentPid = processInfo.pid;
      historyEntry.status = 'connected';
      historyEntry.lastSeen = new Date();
      historyEntry.disconnectedTime = null;

      // 재연결 시 그룹의 processIds 배열에도 추가 (그룹이 할당되어 있고 배열에 없는 경우)
      if (process.groupId && this.groupStore?.groups.has(process.groupId)) {
        const group = this.groupStore.groups.get(process.groupId);
        if (!group.processIds.includes(process.id)) {
          group.processIds.push(process.id);
          this.groupStore.save(); // 변경사항 저장
          console.log('✅ 재연결 시 그룹에 프로세스 추가:', {
            groupName: group.name,
            processId: process.id,
            groupProcessCount: group.processIds.length
          });
        }
      }

      this.notifyListeners();
      return process;
    }

    // 프로세스가 없으면 새로 생성
    console.log('🔄 재연결 중 프로세스 없음 → 새로 생성:', {
      historyProcessId: historyEntry.processId,
      computerName: processInfo.computerName,
      type: processInfo.type
    });
    return this.addNewProcess(processInfo);
  }

  /**
   * 프로세스를 연결 끊김 상태로 표시
   * @param {string} processId - 프로세스 ID
   */
  markAsDisconnected(processId) {
    const process = this.processes.get(processId);
    if (process && process.status !== 'disconnected') {
      process.status = 'disconnected';
      process.disconnectedAt = new Date();

      // 히스토리 업데이트
      const matchingKey = KeyManager.getMatchingKey(process);
      const historyEntry = this.processHistory.get(matchingKey);
      if (historyEntry) {
        historyEntry.status = 'disconnected';
        historyEntry.disconnectedTime = new Date();
      }

      this.notifyListeners();
    }
  }

  /**
   * 현재 프로세스 목록에 없는 프로세스들을 끊어진 상태로 표시
   * @param {Set} currentProcessIds - 현재 감지된 프로세스 ID 집합
   */
  markMissingAsDisconnected(currentProcessIds) {
    let hasChanges = false;
    const now = Date.now();

    // console.log('🔍 markMissingAsDisconnected 시작:', {
    //   totalProcesses: this.processes.size,
    //   currentProcessIds: Array.from(currentProcessIds),
    //   connectedProcesses: Array.from(this.processes.entries())
    //     .filter(([id, p]) => p.status === 'connected')
    //     .map(([id, p]) => ({
    //       id: id,
    //       computerName: p.computerName,
    //       windowHandle: p.windowHandle,
    //       multipleId: p.multipleId,
    //       conflictProtected: !!p.conflictProtected
    //     }))
    // });

    for (const [id, process] of this.processes) {
      if (!currentProcessIds.has(id) && process.status === 'connected') {
        // 충돌 직후 일시적 보호 (15초간)
        if (process.conflictProtected && now < process.conflictProtected) {
          console.log('🛡️ 충돌 직후 일시적 보호:', {
            processId: id,
            computerName: process.computerName,
            multipleId: process.multipleId,
            protectedUntil: new Date(process.conflictProtected),
            reason: '충돌 처리 직후 안정화 기간 - 이후 정상 감지 재개'
          });
          continue;
        }

        // 보호 기간이 만료된 경우 플래그 제거하고 정상 감지
        if (process.conflictProtected) {
          delete process.conflictProtected;
          console.log('⏰ 충돌 보호 해제:', {
            processId: id,
            computerName: process.computerName,
            reason: '보호 기간 만료 - 정상 감지로 전환'
          });
        }

        this.markAsDisconnected(id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  /**
   * 프로세스 제거
   * @param {string} processId - 프로세스 ID
   * @param {boolean} keepHistory - 히스토리 유지 여부 (기본: false)
   */
  removeProcess(processId, keepHistory = false) {
    const process = this.processes.get(processId);
    if (process) {
      // 그룹에서도 제거 (안정적 키 저장을 위해 processInfo 전달)
      if (process.groupId && this.groupStore) {
        this.groupStore.unassignProcessFromGroup(processId, process);
      }

      // 프로세스 제거
      this.processes.delete(processId);

      // stableKeyMap에서도 제거
      const stableKey = KeyManager.getStableIdentifier(process);
      this.stableKeyMap.delete(stableKey);

      // 히스토리 처리
      if (!keepHistory) {
        const matchingKey = KeyManager.getMatchingKey(process);
        this.processHistory.delete(matchingKey);
      } else {
        // 히스토리는 유지하되 상태를 disconnected로 변경
        const matchingKey = KeyManager.getMatchingKey(process);
        const historyEntry = this.processHistory.get(matchingKey);
        if (historyEntry) {
          historyEntry.status = 'disconnected';
          historyEntry.disconnectedTime = new Date();
        }
      }

      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * 오래된 끊어진 프로세스 자동 정리
   */
  cleanupOldProcesses() {
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    let hasChanges = false;

    for (const [id, process] of this.processes) {
      // 그룹에 속하지 않고, 30초 이상 끊어진 프로세스만 삭제
      if (!process.groupId &&
        process.status === 'disconnected' &&
        process.disconnectedAt &&
        process.disconnectedAt.getTime() < thirtySecondsAgo) {

        // 히스토리는 유지하면서 프로세스만 제거 (재연결 시 복원 가능)
        this.removeProcess(id, true);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  /**
   * 프로세스 설정 업데이트
   * @param {string} processId - 프로세스 ID
   * @param {Object} updates - 업데이트할 설정
   */
  updateProcessSettings(processId, updates) {
    const process = this.processes.get(processId);
    if (process) {
      Object.assign(process, updates);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * 특정 프로세스 가져오기
   * @param {string} processId - 프로세스 ID
   * @returns {Object|null} 프로세스 객체
   */
  getProcess(processId) {
    return this.processes.get(processId) || null;
  }

  /**
   * 모든 프로세스 가져오기
   * @returns {Array} 프로세스 배열
   */
  getAllProcesses() {
    return Array.from(this.processes.values());
  }

  /**
   * 연결된 프로세스만 가져오기
   * @returns {Array} 연결된 프로세스 배열
   */
  getConnectedProcesses() {
    return this.getAllProcesses().filter(p => p.status === 'connected');
  }

  /**
   * 끊어진 프로세스만 가져오기
   * @returns {Array} 끊어진 프로세스 배열
   */
  getDisconnectedProcesses() {
    return this.getAllProcesses().filter(p => p.status === 'disconnected');
  }

  /**
   * 특정 그룹의 프로세스들 가져오기
   * @param {string} groupId - 그룹 ID
   * @returns {Array} 해당 그룹의 프로세스 배열
   */
  getProcessesByGroup(groupId) {
    return this.getAllProcesses().filter(p => p.groupId === groupId);
  }

  /**
   * 특정 카테고리의 프로세스들 가져오기
   * @param {string} category - 카테고리
   * @returns {Array} 해당 카테고리의 프로세스 배열
   */
  getProcessesByCategory(category) {
    return this.getAllProcesses().filter(p => p.category === category);
  }

  /**
   * 통계 정보 가져오기
   * @returns {Object} 통계 객체
   */
  getStatistics() {
    const processes = this.getAllProcesses();
    return {
      total: processes.length,
      connected: processes.filter(p => p.status === 'connected').length,
      disconnected: processes.filter(p => p.status === 'disconnected').length,
      ezhelp: processes.filter(p => p.type === 'ezhelp').length,
      teamviewer: processes.filter(p => p.type === 'teamviewer').length,
      grouped: processes.filter(p => p.groupId).length,
      ungrouped: processes.filter(p => !p.groupId).length,
    };
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
    const processes = this.getAllProcesses();
    this.listeners.forEach(listener => {
      try {
        listener(processes);
      } catch (error) {
        console.error('프로세스 스토어 리스너 에러:', error);
      }
    });
  }

  /**
   * 스토어 초기화
   */
  clear() {
    this.processes.clear();
    this.processHistory.clear();
    this.notifyListeners();
  }

  /**
   * 스토어 정리
   */
  cleanup() {
    this.listeners.clear();
    this.processes.clear();
    this.processHistory.clear();
  }
}