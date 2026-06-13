# cdx-swap

`cdx-swap`은 Windows에서 여러 Codex 계정을 번갈아 쓰는 고급 사용자를 위한 tray 앱이다. Windows Codex Desktop의 현재 계정, 프로필별 토큰 스냅샷, 사용량, 선택적 SSH/WSL Codex 런타임을 한 화면에서 맞추는 도구다.

## 프로젝트 구조

```text
.
├── AGENTS.md -> Codex 작업 기준
├── CLAUDE.md -> Claude 작업 기준
├── docs/
│   ├── architecture.md -> 앱 구성과 계정 전환 흐름
│   ├── business-rules.md -> 프로필, 전환, 사용량의 제품 규칙
│   ├── security.md -> 토큰 파일과 원격 복사 보안 기준
│   ├── standards.md -> 변경 전후 반드시 지킬 개발 기준
│   ├── engineering-notes.md -> 구현 중 놓치기 쉬운 함정
│   ├── operations.md -> 개발, 검증, 릴리즈 절차
│   ├── contracts.md -> Tauri 명령과 tray 이벤트 계약
│   └── tracking/
│       ├── status.md -> 현재 완료 범위와 남은 일
│       ├── findings.md -> 아직 닫히지 않은 문제
│       └── decisions/
│           ├── index.md -> 결정 기록 목록
│           ├── 0001-windows-tauri-tray.md -> Windows-first Tauri 앱 결정
│           ├── 0002-switch-partial-success.md -> 전환과 SSH 동기화 분리 결정
│           └── 0003-custom-installer-bootstrapper.md -> 커스텀 설치 앱 결정
├── src/
│   └── AGENTS.md -> React 패널과 프론트 상태 경계
└── src-tauri/
    └── AGENTS.md -> Rust/Tauri 백엔드와 OS 작업 경계
```

## 절대 기준

- 프로필은 계정 토큰의 저장 스냅샷이고, 계정 전환은 선택한 스냅샷을 Windows 기본 Codex home으로 복사하는 작업이다. 전환 중 다른 프로필의 토큰 파일을 덮어쓰면 안 된다.
- Windows 계정 전환 성공, Codex Desktop 재시작, SSH Codex 동기화는 각각 별도 결과로 다룬다. 재시작이나 SSH가 실패해도 이미 검증된 Windows 토큰 전환을 실패로 되돌려 쓰면 안 된다.
- 토큰 내용, access token, refresh token, auth 파일 원문은 UI, 로그, 테스트 출력, 릴리즈 노트에 노출하지 않는다.
- 실제 릴리즈 전에는 `npm test`, `npm run build`, Rust 포맷 검사, Windows 대상 Rust 검사 또는 GitHub Windows 빌드가 통과해야 한다.

## 작업 전 확인

- 계정 전환이나 사용량을 건드리기 전에는 `docs/business-rules.md`의 프로필 스냅샷 규칙과 `src-tauri/AGENTS.md`의 파일 경계 규칙을 먼저 확인한다.
- SSH/WSL 동기화를 건드리기 전에는 `docs/security.md`의 원격 복사 기준과 `docs/engineering-notes.md`의 SSH 검증 함정을 확인한다.
- React 패널을 바꾸기 전에는 `src/AGENTS.md`의 상태 소유권과 표시 규칙을 확인한다.
- 릴리즈를 만들기 전에는 `docs/operations.md`의 버전, 태그, 검증 순서를 따른다.

## 즉시 사용자 확인이 필요한 상황

- 어떤 코드 경로가 프로필 auth 파일을 삭제하거나 다른 프로필 auth 파일로 덮어쓸 가능성이 있으면 멈춘다.
- 현재 Windows 기본 계정과 저장 프로필 중 무엇을 진실로 삼아야 하는지 충돌하면 멈춘다.
- SSH 원격에서 토큰이 복사됐는지 검증할 방법이 없는데 성공으로 표시해야 하는 상황이면 멈춘다.
- 설치/릴리즈 방식이 기존 공개 artifact 이름이나 자동 업데이트 경로를 바꾸면 릴리즈 전에 확인한다.