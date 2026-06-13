# 엔지니어링 노트

증상: 계정 1에서 계정 2로 바꾼 뒤 두 프로필이 같은 계정처럼 보일 수 있다. 원인: 사용량 행이나 현재 상태를 Windows 기본 Codex home에서만 읽으면 방금 전환된 토큰이 모든 행에 섞인다. 대응: 프로필 행은 항상 해당 프로필 home의 auth 파일에서 email, plan, token을 읽고, Windows 기본 home은 현재 계정 판별에만 쓴다.

증상: Windows 계정 전환은 됐는데 SSH Codex에서 revoked refresh token이 계속 나온다. 원인: 원격 `codex app-server`나 proxy가 이전 토큰을 들고 오래 살아 있거나, 원격 `~/.codex/auth.json` 복사가 실패했다. 대응: 복사, 원격 런타임 종료, hash 검증을 분리해서 어느 단계가 실패했는지 표시하고, 재시도는 프로필 전환을 다시 하지 않고 SSH 동기화만 수행한다.

증상: Run 또는 전환 후 Codex Desktop 대신 Codex CLI가 뜬다. 원인: Desktop 실행 파일 경로 탐색에서 `bin\codex.exe` 또는 WindowsApps CLI shim을 Desktop으로 착각할 수 있다. 대응: Desktop launch 경로는 CLI 패턴을 거부하고, 실패 메시지에 configured path, running process, known install path, Start menu fallback 상태를 포함한다.

증상: Linux 환경에서 `cargo check`가 pango/gdk/glib `pkg-config` 오류로 실패한다. 원인: Linux Tauri 빌드가 GTK 개발 패키지를 요구하는데 현재 WSL 환경에 해당 도구가 없다. 대응: 제품 배포 대상인 Windows 검사에는 `cargo check --target x86_64-pc-windows-msvc`를 사용하고, GitHub Actions의 `windows-latest` 빌드를 최종 기준으로 삼는다.

증상: tray icon 주변에 검은 줄이 보일 수 있다. 원인: app/window icon을 tray에 그대로 쓰면 작은 크기에서 투명 픽셀이나 ICO scaling이 깨질 수 있다. 대응: tray에는 작은 크기 전용 RGBA 이미지를 사용하고, app/installer icon과 독립적으로 확인한다.