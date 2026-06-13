# 아키텍처

`cdx-swap`은 Tauri 2 기반 Windows tray 앱이다. React 패널은 표시 상태와 사용자 입력을 맡고, Rust 백엔드는 프로필 파일, Codex CLI 실행, Codex Desktop 재시작, SSH 복사, tray 메뉴 갱신을 맡는다.

대표 흐름은 계정 전환이다. 사용자가 React 패널이나 tray 메뉴에서 프로필을 선택하면 프론트는 `switch_profile` 명령을 호출한다. Rust 백엔드는 선택한 프로필의 `auth.json`을 Windows 기본 Codex home으로 복사하고 즉시 일치 여부를 확인한다. 그 다음 Codex Desktop 재시작과 SSH 동기화를 각각 수행하고, 세 결과를 하나의 구조화된 응답으로 돌려준다. 프론트는 Windows 전환 성공 여부와 재시작/SSH 경고를 분리해서 표시한다.

프로필 사용량 조회는 저장된 각 프로필 home을 기준으로 실행된다. `src-tauri/src/profiles.rs`가 프로필 목록과 auth 요약을 만들고, `src-tauri/src/usage.rs`가 각 프로필의 access token과 account id로 사용량 API를 호출한다. 한 프로필의 사용량 행이 Windows 기본 Codex home을 읽으면 두 프로필이 같은 계정처럼 보이는 문제가 생긴다.

tray 메뉴는 React 상태가 만든 `TrayMenuState`를 Rust로 전달해서 재구성한다. 메뉴 클릭은 `tray-action` 이벤트로 다시 React에 들어오고, React는 패널 클릭과 같은 계정 전환 경로를 사용한다. tray 메뉴 자체는 풍부한 tooltip을 안정적으로 제공하지 못하므로 최근 실패 이유는 비활성 메뉴 항목이나 패널 notice로 노출한다.

외부 경계는 네 가지다. Windows 파일시스템의 Codex home, Codex CLI 프로세스, Codex Desktop 실행 파일 또는 시작 메뉴 앱, SSH 대상 host다. 이 경계들은 모두 실패할 수 있고, 실패 이유는 사용자에게 숨기지 않는다.

