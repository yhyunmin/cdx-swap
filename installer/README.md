# cdx-swap custom installer

The public Windows setup artifact is built from `installer/CdxSwap.Setup`.

The project is a lightweight WPF bootstrapper targeting the Windows built-in
.NET Framework runtime. It embeds the Tauri-generated MSI as an assembly
resource, so the downloaded installer works offline after download without the
large WinUI self-contained runtime payload.

Local Windows build:

```powershell
npm ci
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --features tauri/custom-protocol
.\scripts\package-windows.ps1 -SkipNodeInstall -SkipTests -SkipAppBuild
```
