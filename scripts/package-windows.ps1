Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DesktopOut = Join-Path ([Environment]::GetFolderPath("Desktop")) "cdx-swap"

Push-Location $Root
try {
  npm ci
  npm run test
  npm run tauri:build

  New-Item -ItemType Directory -Force -Path $DesktopOut | Out-Null
  Get-ChildItem -Path "src-tauri\target\release\bundle\nsis", "src-tauri\target\release\bundle\msi" -Recurse -Include *.exe, *.msi |
    Copy-Item -Destination $DesktopOut -Force
  Write-Host "Windows installer artifacts copied to $DesktopOut"
}
finally {
  Pop-Location
}
