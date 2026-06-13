# Rust/Tauri 백엔드 기준

`src-tauri/`는 프로필 파일, Codex CLI 실행, Codex Desktop 재시작, SSH 복사와 검증, tray 메뉴 생성을 맡는다. 사용자에게 보여줄 최종 배치는 React가 맡지만, 실패 단계와 안전 검증은 Rust에서 구조화해서 반환한다.

프로필 파일 경계는 가장 중요한 불변 조건이다. 선택한 프로필의 `auth.json`은 Windows 기본 Codex home으로 복사할 수 있지만, 전환 중 다른 프로필 home을 수정하면 안 된다. 삭제는 `delete_profile`의 허용 경로 검사를 통과한 경우에만 수행한다.

Windows 전환 성공은 `sync_profile_auth_to_default_home`이 복사 후 검증까지 끝낸 상태다. 파일 내용이 같거나 account id/email identity가 맞아야 한다. 단순 `fs::copy` 성공은 전환 성공이 아니다.

SSH 동기화는 token 원문을 출력하지 않는다. 로컬 auth bytes의 sha256과 원격 파일 hash를 비교하거나, 계정 identity 검증을 사용한다. 원격 명령 stderr는 실패 이유로 쓸 수 있지만 token이 섞이지 않는 명령만 사용한다.

Desktop 실행 파일 탐색은 CLI 경로를 거부해야 한다. `bin\codex.exe`나 WindowsApps CLI shim이 발견되면 Desktop 실행 파일로 쓰지 않는다.

Windows 전용 기능은 Windows target 검사로 확인한다. Linux 일반 cargo check가 GTK 개발 패키지 부족으로 실패할 수 있으므로, 제품 판단에는 Windows target check 또는 GitHub Windows build를 사용한다.

