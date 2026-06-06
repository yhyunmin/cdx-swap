#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT="$ROOT/Desktop/cdx-swap"

cd "$ROOT"
npm run build
PATH="$ROOT/scripts/cross-tools:$PATH" RUSTFLAGS="${RUSTFLAGS:-} -C target-feature=+crt-static" cargo xwin build --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --release --features tauri/custom-protocol

mkdir -p "$OUT"
cp src-tauri/target/x86_64-pc-windows-msvc/release/cdx-swap.exe "$OUT/"
cp packaging/windows/cdx-swap.exe.manifest "$OUT/"
printf 'Windows dev portable executable copied to %s\n' "$OUT"
