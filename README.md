# Codex Usage Tray

Windows-first tray app for Codex profile usage, profile login/run/logout sessions, and safe Codex Desktop restarts.

## Requirements

- Node.js 20+
- Rust toolchain for Tauri builds
- OpenAI `codex` CLI installed and available in `PATH` for profile login/run/logout actions
- Windows for the first production target

## Development

```bash
npm install
npm run dev
npm run test
npm run tauri:dev
```

## Windows packaging

```bash
npm run build
npm run tauri:build
```

On Windows, this command builds and copies the installers to the Desktop:

```powershell
npm run windows:package
```

From this Linux workspace, a Windows x64 GUI executable plus installer helper scripts can be generated with:

```bash
./scripts/package-windows-cross.sh
```

The cross package is written to `Desktop/CodexUsageTray`. To install on Windows, copy that folder to a Windows machine and double-click `Install-CodexUsageTray.cmd`. The installer copies the executable to `%LOCALAPPDATA%\Programs\CodexUsageTray`, creates a Start Menu shortcut, and launches the app.

The first packaged release should generate platform icons from `src-tauri/icons/icon.svg` with Tauri's icon tooling before publishing installers.

Linux cross-checking Windows Tauri builds requires the Windows resource compiler (`x86_64-w64-mingw32-windres`) and the usual Tauri Linux prerequisites. The repository CI runs the native Windows check on `windows-latest`.

## Scope

- Codex usage/profile discovery is owned by the Rust core in this app.
- The app does not require the `cdx` CLI binary at runtime.
- `ezpzai/cdx` upstream is tracked in `vendor/cdx-upstream.json` and synced manually after review.
- Codex Desktop auth/state files are never modified.
- Claude and other providers are extension slots only in v0.1.
