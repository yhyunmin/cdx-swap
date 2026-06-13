# Windows-first Tauri tray 앱 유지

## 상황

이 앱은 Windows Codex Desktop과 Windows 사용자 home의 Codex auth 파일을 직접 다룬다. React 패널은 빠르게 바꿔야 하고, Rust 백엔드는 파일, 프로세스, tray 메뉴, SSH 명령을 다뤄야 한다.

## 결정

메인 앱은 Tauri 2, Rust, React 구조를 유지한다. Windows 동작이 우선이며, Linux 실행은 개발 검사의 보조 경로로만 본다.

## 대안

Electron으로 바꾸면 Node 생태계에서 UI/프로세스 제어를 단순화할 수 있지만, 이미 Tauri release pipeline과 Rust 백엔드 명령이 있고 설치 크기와 tray 앱 성격에 맞지 않는다.

순수 C# 앱으로 바꾸면 Windows API 접근은 자연스럽지만, 기존 React 패널과 Rust 로직을 버려야 해서 계정 전환 안정화보다 재작성 위험이 커진다.

## 결과

OS 경계는 Rust에서 다루고, 사용자가 보는 상태와 상호작용은 React에서 다룬다. Windows-specific 검증은 GitHub Windows runner나 Windows 실기에서 확인해야 한다.