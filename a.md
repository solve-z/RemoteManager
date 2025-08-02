원격지원 ezHelp, TeamViewer 사용중인데 
원격지들을 관리할수있는 프로그램

필요기능
1. 전체 프로세스 보여줌 
2. 원격지들의 리스트들을 보여줌
3. 원격지들의 정보들을 보여주면서 정보추출 기능 
4. 원격지 리스틀을 그룹으로 관리할수있는 기능 
5. 프로세스들을 필터링 해서 볼수있는 기능 (최신순, 이름순, PID순..)
6. 원격 연결 및 종료 로그
#### 전체 프로세스 보여줌
프로세스 리스트들의 MainWindowTitle를 보여줌
이건 테스트를 위한 기능이고 추후 삭제될가능성이 높음 (프로세스가 원격으로 인식이 안되는경우 일단 프로세스 리스트에는 추가가 되는지 확인하기 위한 목적)  
#### 원격지들의 리스트들을 보여줌 
- 원격지들만 볼수있는 탭 
- 원격이 만약 끊겼다면 끊김을 알수있고 다시 연결됐을때 MainWindowTitle에 있는 컴퓨터 이름을 기반으로 다시 활성화 ex) 원격지에 간혹 끊기는 경우가 있는데 원격 프로세스가 많을때 어디 원격이 끊겼는지 확인이 힘들때가 있음 (이거는 선택적으로 작동하는 기능으로 구현해줘, 기본값은 원격 프로세스가 종료 시 목록 제거)  
  IP를고정하면서 원격지의 네트워크가 잠깐 끊기면서 원격이 다시 들어올때가 있음
- 프로세스 종료 기능  
- 목록만 제거 기능 
- 특정 버튼 클릭 시 해당 원격 윈도우 창이 포커스 되서 팝업 (즉, 클릭한번으로 해당 원격 창이 어딨는지 바로 확인 가능)
- 해당 원격 리스트를 클릭하면 클릭된 원격지의 정보창 팝업 

#### 원격지들의 정보들을 보여주면서 정보추출 기능 
실제로 PowerShell에서 아래와 같은 정보들을 추출할수있음 
결국 중요한 정보들은 원격지 IP와 상담원(46) , 컴퓨터이름 ex) desktop-6bcogpv
```
    powerShell 스크립트 
            Get-Process | 
        Where-Object {$_.MainWindowTitle -ne ""} | 
        Select-Object ProcessName, MainWindowTitle | 
        ConvertTo-Json
    
    -- 아래 결과
    
    {
        "ProcessName":  "ezHelpManager",
        "MainWindowTitle":  "ezHelpManager Ver. 2.0.6.0"
    },

   {
        "ProcessName":  "ezHelpViewer",
        "MainWindowTitle":  "ezHelp - desktop-6bcogpv(Relay) - 원격지 IP : 192.168.0.18(121.164.168.194) - 원격제어 경과시간 : 00:00:04 - 상담원(46)"
    },


    {
        "ProcessName":  "TeamViewer",
        "MainWindowTitle":  "YSCENTER1_01 - TeamViewer"
    },
    {
        "ProcessName":  "TeamViewer",
        "MainWindowTitle":  "TeamViewer"
    },

```

보통 업무에서 192.168.0.18[desktop-6cogpv] 같은 정보들을 정리해놔야하는데, 
IP랑 컴퓨터이름 복사 시 이처럼 복사가 자동으로 되거나 컴퓨터 이름만 있는 TeamViewer 경우에는 [YSCENTER1_01] 처럼 복사가 되었으면 해 


#### 원격지 리스틀을 그룹으로 관리할수있는 기능  
원격지 리스트들을 그룹으로 관리
라벨 추가 및 수정 기능 
원격지 리스트에서 그룹으로 드래그앤 드롭으로 옮기기 가능 
그룹끼리도 드래그앤 드롭 가능 
ex) 
A치과
- A치과_엑스레이서버 : ezHelp - desktop-6bcogpv(Relay) - 원격지 IP : 192.168.0.18(121.164.168.194) - 원격제어 경과시간 : 00:00:04 - 상담원(46)
- A치과_덴트웹서버 : ezHelp - desktop-6bcogpv(Relay) - 원격지 IP : 192.168.0.18(121.164.168.194) - 원격제어 경과시간 : 00:00:04 - 상담원(46)"





#### 추가 고려 사항
IP고정 시 프로세스 ID 변하는지? 
- 다른 사람의 원격을 공유해서 IP고정 시 연결이 끊기면서 기존 원격 공유자한테 넘어가기때문에 프로세스 ID가 변경이됨 
