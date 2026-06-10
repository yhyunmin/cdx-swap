# cdx-swap

Codex 프로필별 5H / Week 남은 사용량을 Windows 트레이에서 확인하고,
프로필별 Login / Run / Logout 세션을 GUI에서 실행하는 **Windows 우선** 로컬 도구입니다.

macOS 메뉴바 앱은 같은 구조로 확장할 수 있게 열어두었지만, 현재 production 대상은 Windows입니다.

## 빠르게 시작하기

릴리즈는 `v*` 태그를 push하면 GitHub Actions가 생성합니다.

- `cdx-swap_<version>_x64-setup.exe`
- `cdx-swap_<version>_x64-update.msi`
- `cdx-swap_<version>_x64-portable.zip`

릴리즈 파일을 쓰지 않고 소스에서 실행하려면 Windows에서 아래처럼 실행합니다.

```powershell
git clone https://github.com/yhyunmin/cdx-swap.git
cd cdx-swap
npm ci
npm run tauri:dev
```

로컬 설치 파일을 만들 때:

```powershell
npm run windows:package
```

Linux / WSL에서 Windows용 개발 portable exe만 만들 때:

```bash
./scripts/package-windows-cross.sh
```

cross-build 결과는 개발 확인용이며 공식 배포물은 GitHub Release의 NSIS installer, MSI update installer,
portable zip입니다.

## 하는 일

- Windows 트레이 아이콘 클릭 시 native context menu를 보여줍니다.
- `열기`를 누르면 dashboard React panel을 커서 근처에 엽니다.
- `설정`을 누르면 settings panel을 엽니다.
- `변경` submenu에서 active profile을 선택합니다.
- active profile의 Codex 5H / Week 남은 사용량을 tray status에 표시합니다.
- Profile별 Login / Logout은 Codex CLI로 실행합니다. Run은 profile을 선택하고
  해당 profile의 auth token을 Windows Codex home에 동기화한 뒤 그 profile의
  `CODEX_HOME`으로 Codex Desktop을 재시작합니다.
- Desktop 경로가 비어 있으면 실행 중인 Codex process path, 일반 Windows 설치
  경로, `Codex` app alias 순서로 자동 탐색합니다.
- 선택 옵션으로 Windows `.codex/auth.json`을 설정한 SSH host의
  `~/.codex/auth.json`으로 함께 복사할 수 있습니다.
- Windows에서는 `CREATE_NO_WINDOW`로 외부 터미널 창을 숨기고 stdout / stderr를 앱에서 수집합니다.
- 이메일 마스킹, profile 숨김, session log 보기, refresh interval을 설정할 수 있습니다.

현재 Claude provider는 설정 슬롯만 있습니다. v1에서는 Claude usage 조회를 실행하지 않습니다.

## Windows 설치와 업데이트

- 릴리즈는 NSIS `setup.exe`와 MSI `update.msi`를 함께 배포합니다.
- 버전업데이트는 MSI artifact를 기준으로 사용합니다. MSI `upgradeCode`를
  `tauri.conf.json`에 고정해서 다음 버전도 같은 앱의 업그레이드로 인식하게 했습니다.
- Windows bundler 설정에서 downgrade 설치는 차단합니다.
- 브라우저 다운로드 후 SmartScreen 차단을 없애려면 신뢰된 Windows code signing
  평판이 필요합니다. GitHub Actions는 `WINDOWS_CERTIFICATE`,
  `WINDOWS_CERTIFICATE_PASSWORD`, `WINDOWS_CERTIFICATE_THUMBPRINT` secret이 있으면
  자동으로 인증서를 import해 서명하고, 없으면 unsigned artifact로 빌드합니다.

## 지원 환경

- Windows 10 / 11
- WebView2 runtime
- Node.js 20+
- Rust stable toolchain
- Codex CLI

Codex CLI는 아래 순서로 찾습니다.

1. Settings의 `Codex CLI 경로`
2. `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`
3. `C:\Users\Administrator\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`
4. `PATH`의 `codex`

## 프로필 추가와 세션

Dashboard의 새 profile 입력칸에 이름을 넣고 `Login`을 누릅니다.

예시:

```text
main
work
personal
```

앱은 profile별로 `CODEX_HOME`을 다르게 지정합니다.

- `Login`: 해당 profile의 Codex login flow를 시작합니다.
- `Run`: 해당 profile을 선택하고 `auth.json`을 Windows 기본 Codex home에
  동기화한 뒤 그 profile의 `CODEX_HOME`으로 Codex Desktop을 재시작합니다.
- `Logout`: 해당 profile에서 `codex logout`을 실행합니다.

현재 Windows Codex 로그인 계정이 저장된 profile 어디에도 매칭되지 않으면 panel에
프로필에 등록되지 않은 계정으로 표시합니다.

Logout은 profile 폴더 삭제가 아닙니다. 인증 로그아웃만 수행합니다.

## 트레이 메뉴

트레이 아이콘을 클릭하면 native context menu가 뜹니다.

```text
상태: main 5H 35% / Week 61%
열기
변경
새로고침
설정
종료
```

`변경`에서 profile을 선택하면 앱 내부 active profile이 바뀌고 tray status가 갱신됩니다.

Settings에서 `계정 선택 시 Codex Desktop 안전 재시작`을 켜면, 전환 시 확인 후 Codex Desktop 종료 요청,
timeout 후 강제 종료, 설정된 실행 파일 재실행 순서로 처리합니다.

Codex Desktop의 내부 auth / state 파일은 수정하지 않습니다. Desktop 로그인 전환은 수동 확인이 필요할 수 있습니다.

## 설정

Settings에서 관리하는 값:

- Codex CLI 경로
- Codex Desktop 실행 파일 경로
- 갱신 주기
- Codex Desktop 안전 재시작
- 전환 전 확인
- Windows 시작 시 실행
- 이메일 마스킹
- 세션 로그 보기
- Claude usage 설정 슬롯

세션 로그는 기본으로 숨깁니다. Login 성공 / 실패 등 완료 결과는 toast로 표시합니다.
`세션 로그 보기`를 켠 경우에만 로그 panel을 유지합니다.

## 개발

```bash
npm ci
npm run test
npm run build
npm run tauri:dev
```

Windows target check를 WSL / Linux에서 확인할 때:

```bash
PATH="$PWD/scripts/cross-tools:$PATH" \
RUSTFLAGS="-C target-feature=+crt-static" \
cargo xwin check --manifest-path src-tauri/Cargo.toml \
  --target x86_64-pc-windows-msvc \
  --features tauri/custom-protocol
```

## 릴리즈

`v*` 태그를 push하면 GitHub Actions가 Windows runner에서 정식 Tauri build를 실행합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

업로드되는 파일:

- `cdx-swap_0.1.0_x64-setup.exe`
- `cdx-swap_0.1.0_x64-update.msi`
- `cdx-swap_0.1.0_x64-portable.zip`

`.cmd` / `.ps1` 설치 스크립트는 release artifact로 배포하지 않습니다.

## 보안

- `auth.json`, profile 폴더, session, log, backup, SQLite state를 커밋하지 마세요.
- 앱 config에는 token을 저장하지 않습니다.
- auth token은 Rust backend에서 usage request에만 사용하고 frontend로 직렬화하지 않습니다.
- Codex 사용량 endpoint는 비공식이며 언제든 바뀔 수 있습니다.
- 자세한 내용은 [SECURITY.md](SECURITY.md)를 참고하세요.

## Credits

프로필 단위 관리 방식은 [ezpzai/cdx](https://github.com/ezpzai/cdx) (Apache-2.0)에서 영감을 받았습니다.
이 프로젝트는 cdx의 fork가 아니라 Windows-first Tauri tray 독립 구현입니다.
