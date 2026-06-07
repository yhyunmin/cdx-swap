# cdx-swap

**Windows-first** local tray helper for checking Codex profile 5H / Week remaining quota
and running per-profile Login / Run / Logout sessions from a GUI.

The architecture leaves room for a later macOS menu-bar build, but the current production target is Windows.

## Quick Start

Release artifacts are created by GitHub Actions when a `v*` tag is pushed:

- `cdx-swap_<version>_x64-setup.exe`
- `cdx-swap_<version>_x64-portable.zip`

Run from source on Windows:

```powershell
git clone https://github.com/yhyunmin/cdx-swap.git
cd cdx-swap
npm ci
npm run tauri:dev
```

Build a local Windows installer:

```powershell
npm run windows:package
```

Build a development-only Windows portable exe from Linux / WSL:

```bash
./scripts/package-windows-cross.sh
```

The cross-build output is for development checks. Official distribution uses the GitHub Release NSIS
installer and portable zip.

## What It Does

- Shows a native context menu when you click the Windows tray icon.
- Opens the dashboard React panel near the cursor with `열기`.
- Opens the settings panel with `설정`.
- Changes the active profile from the `변경` submenu.
- Shows the active profile's Codex 5H / Week remaining quota in tray status.
- Runs Codex CLI Login / Run / Logout for each profile.
- Hides external terminal windows on Windows with `CREATE_NO_WINDOW` and captures stdout / stderr in the app.
- Supports email masking, hidden profiles, optional session log rendering, and configurable refresh intervals.

The Claude provider is currently a settings slot only. v1 does not query Claude usage.

## Requirements

- Windows 10 / 11
- WebView2 runtime
- Node.js 20+
- Rust stable toolchain
- Codex CLI

The Codex CLI path is resolved in this order:

1. `Codex CLI 경로` in Settings
2. `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`
3. `C:\Users\Administrator\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`
4. `codex` from `PATH`

## Add Profiles and Sessions

Enter a new profile name in the dashboard and click `Login`.

Example names:

```text
main
work
personal
```

The app starts Codex CLI with a different `CODEX_HOME` per profile.

- `Login`: starts Codex login flow for the profile.
- `Run`: starts Codex CLI for the profile.
- `Logout`: runs `codex logout` for the profile.

Logout does not delete the profile folder. It only performs auth logout.

## Tray Menu

Click the tray icon to open the native context menu:

```text
상태: main 5H 35% / Week 61%
열기
변경
새로고침
설정
종료
```

Choosing a profile under `변경` updates the app's active profile and refreshes the tray status.

When `계정 선택 시 Codex Desktop 안전 재시작` is enabled in Settings, switching can ask for confirmation,
request Codex Desktop shutdown, force-kill after timeout, and relaunch the configured executable.

The app does not modify Codex Desktop internal auth / state files. Desktop login switching may still require
manual confirmation.

## Settings

Settings currently manages:

- Codex CLI path
- Codex Desktop executable path
- Refresh interval
- Safe Codex Desktop restart
- Confirmation before switch
- Windows autostart
- Email masking
- Session log visibility
- Claude usage settings slot

Session logs are hidden by default. Login success / failure and other completion results are shown as toasts.
Logs stay visible only when `세션 로그 보기` is enabled.

## Development

```bash
npm ci
npm run test
npm run build
npm run tauri:dev
```

Windows target check from WSL / Linux:

```bash
PATH="$PWD/scripts/cross-tools:$PATH" \
RUSTFLAGS="-C target-feature=+crt-static" \
cargo xwin check --manifest-path src-tauri/Cargo.toml \
  --target x86_64-pc-windows-msvc \
  --features tauri/custom-protocol
```

## Release

Push a `v*` tag to publish a GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Uploaded files:

- `cdx-swap_0.1.0_x64-setup.exe`
- `cdx-swap_0.1.0_x64-portable.zip`

`.cmd` / `.ps1` installer scripts are not distributed as release artifacts.

## Security

- Never commit `auth.json`, profile folders, sessions, logs, backups, or SQLite state.
- App config does not store auth tokens.
- Auth tokens are used only by the Rust backend for usage requests and are not serialized to the frontend.
- Codex usage endpoints are unofficial and may change.
- See [SECURITY.md](SECURITY.md).

## Credits

The profile model is inspired by [ezpzai/cdx](https://github.com/ezpzai/cdx) (Apache-2.0).
This project is an independent Windows-first Tauri tray implementation, not a fork.
