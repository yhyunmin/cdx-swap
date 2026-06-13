# Lightweight WPF installer

## 상황

WinUI 3 self-contained single-file installer는 Windows App SDK runtime까지 포함하면서 setup exe가 160MB 이상으로 커졌고, 일부 환경에서 클릭해도 설치 창이 뜨지 않는 문제가 있었다. 설치 프로그램은 사용자가 처음 만나는 신뢰 표면이므로 작고 즉시 실행돼야 한다.

## 결정

custom installer는 .NET Framework 4.8 기반 WPF bootstrapper로 유지한다. Tauri MSI는 계속 `PayloadMsiPath` MSBuild property로 전달하고 `CdxSwap.Setup.Payload.cdx-swap.msi` embedded resource로 포함한다.

## 결과

setup exe는 WinUI self-contained runtime payload를 포함하지 않아 훨씬 작아진다. 설치 UI는 기본 NSIS/Wix wizard가 아니라 cdx-swap 전용 창으로 열리고, MSI silent install, 로그 경로, exit code 표시 흐름은 유지된다.
