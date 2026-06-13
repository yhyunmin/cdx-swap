# 외부 계약

React 패널은 Tauri 명령을 통해 Rust 백엔드와 통신한다. 명령 이름과 camelCase 응답 필드는 외부 계약으로 취급한다.

`switch_profile` 입력은 `profileId`와 전체 앱 설정이다. 성공 응답은 `activeProfileId`, `desktopRestarted`, `windows`, `desktop`, `ssh`, `message`를 포함한다. `windows.ok`가 true이면 Windows 기본 Codex auth가 선택 프로필과 맞게 바뀐 상태다. `desktop.ok`와 `ssh.ok`는 후속 작업 결과이며 false일 수 있다. 선택 프로필이 없거나 auth가 없거나 Windows auth 검증이 실패하면 명령 자체가 실패한다.

`retry_ssh_codex_sync` 입력은 전체 앱 설정이다. 이 명령은 프로필을 다시 선택하지 않고 현재 Windows 기본 auth를 설정된 SSH host로 다시 복사한다. 응답은 `enabled`, `ok`, `stage`, `message`를 포함한다. `stage`는 `disabled`, `missingHost`, `connectFailed`, `copyFailed`, `verifyFailed`, `restartFailed`, `matched` 중 하나다.

`list_profile_usage` 출력은 프로필별 사용량 행 배열이다. 각 행은 `profileId`, `account`, `plan`, `fiveHourLeft`, `fiveHourReset`, `weeklyLeft`, `weeklyReset`, `error`를 가진다. 사용량 조회가 실패한 프로필도 행은 유지하고 `error`에 실패 이유를 둔다.

`get_current_account_status` 출력은 현재 Windows 기본 auth가 저장 프로필과 맞는지 알려준다. `registered`가 false이면 현재 계정은 저장 프로필에 없는 계정이다.

tray 이벤트는 `tray-action`으로 전달된다. payload는 `action`과 선택적 `profileId`를 가진다. `switchProfile` action은 React 패널 클릭과 같은 전환 경로를 사용해야 하며, 확인 모달 때문에 막히면 안 된다.

