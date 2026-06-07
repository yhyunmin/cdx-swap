# cdx-swap

Windows-first tray helper for checking Codex profile usage and running profile
login / run / logout sessions without leaving a terminal window open.

## Quick Start

Release builds are produced from `v*` tags. Download one of these artifacts from
the GitHub Release page:

- `cdx-swap_<version>_x64-setup.exe`
- `cdx-swap_<version>_x64-portable.zip`

From source on Windows:

```powershell
git clone https://github.com/yhyunmin/cdx-swap.git
cd cdx-swap
npm ci
npm run tauri:dev
```

- [English README](README.en.md)
- [한국어 README](README.ko.md)
- [SECURITY.md](SECURITY.md)

## Tray Behavior

- Click the tray icon to open the native context menu.
- Use `열기` for the dashboard panel and `설정` for configuration.
- Use `변경` to select the active profile used for tray status.
- The tray status shows the active profile's Codex 5H / Week remaining quota.
- Login and Logout run through the configured Codex CLI path. Run selects the
  profile and restarts Codex Desktop with that profile's `CODEX_HOME`.

## Security First

- Do not commit `auth.json`, profile folders, logs, sessions, backups, or local
  app config.
- Auth tokens are consumed only in the Rust backend and are not serialized to the
  frontend or settings file.
- Codex usage endpoints are unofficial and may change without notice.
- Review [SECURITY.md](SECURITY.md) before publishing a fork or attaching logs.

## Credits

The profile model is inspired by [ezpzai/cdx](https://github.com/ezpzai/cdx)
(Apache-2.0). This project is an independent Windows-first Tauri tray app, not a
fork.
