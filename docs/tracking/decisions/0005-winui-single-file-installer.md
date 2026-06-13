# WinUI 3 single-file installer

## 상황

커스텀 설치 UI는 WinUI 3로 만들기로 결정했지만, 사용자가 다운로드하는 setup exe는 오프라인에서 바로 실행돼야 한다. framework-dependent WinUI 앱은 대상 PC에 Windows App SDK runtime이 없으면 별도 설치가 필요해지고, 이는 설치 프로그램 자체가 설치 전 의존성을 요구하는 문제가 된다.

## 결정

installer 프로젝트는 unpackaged, self-contained, single-file WinUI 3 앱으로 publish한다. 필요한 MSBuild 설정은 `WindowsPackageType=None`, `WindowsAppSDKSelfContained=true`, `SelfContained=true`, `EnableMsixTooling=true`, `IncludeAllContentForSelfExtract=true`, `PublishSingleFile=true`다.

Tauri MSI는 `PayloadMsiPath` MSBuild property로 전달하고 `CdxSwap.Setup.Payload.cdx-swap.msi` embedded resource로 포함한다. release asset의 primary setup exe는 이 custom bootstrapper 결과물이다.

## 결과

설치 프로그램 exe 크기는 커지지만, Windows App SDK runtime을 설치 시점에 다운로드하지 않아도 된다. 실패 처리는 bootstrapper UI가 담당하고, MSI 로그는 `%TEMP%\cdx-swap-install-<timestamp>.log`에 남긴다.
