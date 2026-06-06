Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SourceExe = Join-Path $PSScriptRoot "codex-usage-tray.exe"
$SourceManifest = Join-Path $PSScriptRoot "codex-usage-tray.exe.manifest"
if (-not (Test-Path $SourceExe)) {
  throw "codex-usage-tray.exe was not found next to this installer script."
}

$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\CodexUsageTray"
$ShortcutDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$ShortcutPath = Join-Path $ShortcutDir "Codex Usage Tray.lnk"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path $SourceExe -Destination (Join-Path $InstallDir "codex-usage-tray.exe") -Force
if (Test-Path $SourceManifest) {
  Copy-Item -Path $SourceManifest -Destination (Join-Path $InstallDir "codex-usage-tray.exe.manifest") -Force
}

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $InstallDir "codex-usage-tray.exe"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "Codex Usage Tray"
$Shortcut.Save()

Start-Process -FilePath (Join-Path $InstallDir "codex-usage-tray.exe")
Write-Host "Installed Codex Usage Tray to $InstallDir"
