# Security

cdx-swap is a local tray app that reads Codex profile auth metadata and calls Codex usage endpoints.
Treat profile data and logs as private user data.

## Do Not Commit

Never commit or attach these files to issues, releases, screenshots, or support logs:

- `auth.json`
- `credentials.json`
- `~/.cdx/profiles/**`
- `~/.codex/**`
- app config files
- session logs
- backup folders
- SQLite state
- crash dumps that may include process output

## Token Handling

- Auth tokens are read by the Rust backend only.
- `access_token` is marked with `serde(skip_serializing)` and must not be returned to the frontend.
- Tauri responses, app config, and `localStorage` must not store auth tokens.
- UI should show masked account identifiers by default.

## Desktop State

cdx-swap does not modify Codex Desktop internal auth or state files.
Profile switching changes the app's active profile and can optionally restart Codex Desktop, but Desktop login
state may still require manual confirmation by the user.

## Network Assumptions

Codex usage endpoints are unofficial and may change without notice.
If an endpoint changes, prefer showing a recoverable error in the UI over logging sensitive request details.

## Reporting

If you find a security issue, open a private report or contact the maintainer directly.
Do not include raw auth files, tokens, or full logs in a public issue.
