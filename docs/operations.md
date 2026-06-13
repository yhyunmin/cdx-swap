# 운영 절차

개발 전 의존성은 Node 22, Rust stable, Tauri 2 CLI, Windows 빌드 대상이다. Windows 릴리즈 검증은 Windows runner가 기준이며, installer 빌드는 .NET 8 SDK와 Windows App SDK NuGet restore가 필요하다.

기본 확인 명령은 다음 순서로 실행한다.

```bash
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
PATH=/tmp/cdx-swap-llvm/root/usr/lib/llvm-18/bin:$PATH LD_LIBRARY_PATH=/tmp/cdx-swap-llvm/root/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

Linux에서 일반 `cargo check --manifest-path src-tauri/Cargo.toml`는 GTK 개발 패키지와 `pkg-config`가 없으면 제품 코드 검사 전에 실패한다. 이 경우 실패를 무시하지 말고 Windows target 검사 또는 GitHub Actions Windows 빌드 결과를 기록한다.

릴리즈는 버전을 먼저 맞춘 뒤 태그를 만든다. `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`의 버전이 어긋나면 같은 태그에서 서로 다른 artifact 이름이나 앱 메타데이터가 생긴다.

GitHub 릴리즈는 `v*` 태그 push가 Windows artifact 빌드를 트리거한다. 공개 artifact는 custom setup exe와 portable zip이며, update/debug 용도로 MSI도 함께 업로드한다. 각 release asset 이름에는 태그에서 `v`를 뺀 버전이 들어간다.

Windows 패키징은 `scripts/package-windows.ps1`가 단일 출처다. 이 스크립트는 Tauri가 만든 MSI를 찾아 `installer/CdxSwap.Setup`에 `PayloadMsiPath`로 넘기고, WinUI 3 setup exe를 publish한 뒤 `cdx-swap_<version>_x64-setup.exe`로 복사한다. `src-tauri/tauri.conf.json`의 bundle target은 MSI만 유지하므로 기본 NSIS wizard가 release asset으로 섞이면 안 된다.

설치 프로그램 수동 검수는 Windows에서 수행한다. setup exe가 기본 wizard가 아니라 custom WinUI 창으로 열리는지, 네트워크를 끊은 뒤에도 설치되는지, 실패를 강제로 만들었을 때 exit code와 log path가 표시되는지, 성공 후 Launch가 `cdx-swap.exe`를 실행하는지 확인한다.

계정 전환 수동 검수는 Windows에서 수행한다. 서로 다른 두 프로필로 Login한 뒤 패널 전환, tray 전환, Run 전환을 각각 시도하고, 전환 후 각 프로필 행이 자기 email을 유지하는지 확인한다. SSH 옵션이 켜져 있으면 `ssh <host>` 안의 `~/.codex/auth.json`이 Windows 기본 auth와 맞는지 확인한다.
