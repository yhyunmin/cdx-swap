# cdx-swap

Windows-first Tauri tray app for Codex profile usage, profile login/run/logout sessions, and optional Codex Desktop safe restart.

## Features

- Native Windows tray context menu with active profile 5H/Week status.
- React dashboard panel opened from tray menu near the cursor.
- Codex profile login, run, and logout sessions without opening an external terminal window on Windows.
- Profile usage table with email masking and per-profile hide controls.
- Settings for Codex CLI path override, Codex Desktop path, refresh interval, autostart, session logs, and a v1 Claude provider config slot.

## Requirements

- Node.js 20+
- Rust toolchain for Tauri builds
- Windows for production packaging
- Codex CLI installed. The app auto-detects the default OpenAI Codex install path on Windows and falls back to `PATH`; Settings can override the path.

## Development

```bash
npm install
npm run dev
npm run test
npm run tauri:dev
```

## Windows packaging

Official release artifacts are produced by GitHub Actions on `v*` tags:

- `cdx-swap_<version>_x64-setup.exe`
- `cdx-swap_<version>_x64-portable.zip`

Local Windows build:

```powershell
npm run windows:package
```

Linux cross-build is dev-only and copies a portable executable to `Desktop/cdx-swap`:

```bash
./scripts/package-windows-cross.sh
```

## Scope

- Codex usage/profile discovery is owned by the Rust core in this app.
- Codex Desktop auth/state files are never modified.
- Auth tokens are used only inside the Rust backend and are not serialized to the frontend, config, or localStorage.
- Claude and other providers are extension slots only in v0.1.
