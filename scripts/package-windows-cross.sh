#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT="$ROOT/Desktop/CodexUsageTray"

cd "$ROOT"
npm run build
PATH="$ROOT/scripts/cross-tools:$PATH" RUSTFLAGS="${RUSTFLAGS:-} -C target-feature=+crt-static" cargo xwin build --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --release

mkdir -p "$OUT"
cp src-tauri/target/x86_64-pc-windows-msvc/release/codex-usage-tray.exe "$OUT/"
cp packaging/windows/codex-usage-tray.exe.manifest packaging/windows/Install-CodexUsageTray.cmd packaging/windows/Install-CodexUsageTray.ps1 packaging/windows/README.txt "$OUT/"
printf 'Windows portable executable copied to %s\n' "$OUT"
