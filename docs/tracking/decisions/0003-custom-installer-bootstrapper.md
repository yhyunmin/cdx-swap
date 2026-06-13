# 커스텀 설치 앱과 embedded MSI

## 상황

기본 Tauri installer UI는 오래된 wizard 느낌이 강하고, 사용자는 macOS식으로 더 정돈된 설치 경험을 원한다. 동시에 기존 Windows 설치/업데이트 artifact와 GitHub release 흐름은 유지해야 한다.

## 결정

설치 경험은 C# WinUI 3 bootstrapper로 만든다. Tauri가 만든 MSI는 내부 payload로 넣고, 사용자는 하나의 setup exe를 다운로드해 오프라인으로 설치한다. 메인 앱은 Tauri/Rust로 유지한다.

## 대안

Tauri NSIS/Wix template만 꾸미는 방법은 구현 비용이 낮지만 원하는 수준의 현대적인 단일 창 경험을 만들기 어렵다.

Rust에서 WinUI 3를 직접 호출하는 방법은 가능성이 있지만, 공식적으로 널리 쓰이는 WinUI 3 개발 경로가 C#과 C++라서 설치 앱 유지보수에는 불리하다.

## 결과

릴리즈 pipeline은 MSI를 내부 payload로 빌드한 뒤 custom setup exe를 공개 artifact로 올려야 한다. portable zip은 계속 공개한다.