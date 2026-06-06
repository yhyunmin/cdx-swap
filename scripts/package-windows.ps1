Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DesktopOut = Join-Path ([Environment]::GetFolderPath("Desktop")) "CodexUsageTray"

Push-Location $Root
try {
  npm ci
  npm run test
  npm run tauri:build

  New-Item -ItemType Directory -Force -Path $DesktopOut | Out-Null
  Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Include *.msi,*.exe |
    Copy-Item -Destination $DesktopOut -Force
  Copy-Item -Path "packaging\windows\Install-CodexUsageTray.cmd", "packaging\windows\Install-CodexUsageTray.ps1", "packaging\windows\README.txt" -Destination $DesktopOut -Force

  Write-Host "Windows installers copied to $DesktopOut"
}
finally {
  Pop-Location
}
