param(
  [string]$Version = "",
  [string]$OutputDir = "",
  [string]$Configuration = "Release",
  [switch]$SkipNodeInstall,
  [switch]$SkipTests,
  [switch]$SkipAppBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Resolve-FromRoot([string]$Path) {
  if ([IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $Root $Path
}

function Get-RequiredFile([string]$Directory, [string]$Filter) {
  $file = Get-ChildItem -Path $Directory -Filter $Filter -File -ErrorAction Stop |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if ($null -eq $file) {
    throw "No $Filter file found in $Directory"
  }

  return $file
}

function Get-SignToolPath {
  $roots = @(
    (Join-Path ([Environment]::GetFolderPath("ProgramFilesX86")) "Windows Kits\10\bin"),
    (Join-Path ([Environment]::GetFolderPath("ProgramFiles")) "Windows Kits\10\bin")
  )

  foreach ($root in $roots) {
    if (-not (Test-Path $root)) {
      continue
    }

    $candidate = Get-ChildItem -Path $root -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
      Sort-Object FullName -Descending |
      Select-Object -First 1

    if ($null -ne $candidate) {
      return $candidate.FullName
    }
  }

  return $null
}

function Sign-Artifact([string]$Path) {
  $thumbprint = $env:WINDOWS_CERTIFICATE_THUMBPRINT
  if ([string]::IsNullOrWhiteSpace($thumbprint)) {
    Write-Host "Windows signing secrets are not configured. Custom setup exe is unsigned."
    return
  }

  $signTool = Get-SignToolPath
  if ([string]::IsNullOrWhiteSpace($signTool)) {
    throw "signtool.exe was not found."
  }

  $timestampUrl = $env:WINDOWS_TIMESTAMP_URL
  if ([string]::IsNullOrWhiteSpace($timestampUrl)) {
    $timestampUrl = "http://timestamp.digicert.com"
  }

  & $signTool sign /sha1 $thumbprint /fd SHA256 /tr $timestampUrl /td SHA256 $Path
}

Push-Location $Root
try {
  if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = (Get-Content "package.json" -Raw | ConvertFrom-Json).version
  }

  if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path ([Environment]::GetFolderPath("Desktop")) "cdx-swap"
  } else {
    $OutputDir = Resolve-FromRoot $OutputDir
  }

  if (-not $SkipNodeInstall) {
    npm ci
  }

  if (-not $SkipTests) {
    npm run test
  }

  if (-not $SkipAppBuild) {
    npm run tauri -- build --features tauri/custom-protocol
  }

  $msi = Get-RequiredFile "src-tauri\target\release\bundle\msi" "*.msi"
  $appExe = Get-RequiredFile "src-tauri\target\release" "cdx-swap.exe"
  $setupProject = Join-Path $Root "installer\CdxSwap.Setup\CdxSwap.Setup.csproj"
  $buildDir = Join-Path $Root "installer\CdxSwap.Setup\bin\x64\$Configuration\net48"

  dotnet build $setupProject `
    -c $Configuration `
    -p:Platform=x64 `
    "/p:AppVersion=$Version" `
    "/p:PayloadMsiPath=$($msi.FullName)"

  $setupExe = Get-RequiredFile $buildDir "CdxSwap.Setup.exe"

  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $setupOut = Join-Path $OutputDir "cdx-swap_${Version}_x64-setup.exe"
  $msiOut = Join-Path $OutputDir "cdx-swap_${Version}_x64-update.msi"
  $portableOut = Join-Path $OutputDir "cdx-swap_${Version}_x64-portable.zip"

  Copy-Item $setupExe.FullName $setupOut -Force
  Sign-Artifact $setupOut

  Copy-Item $msi.FullName $msiOut -Force

  $portableRoot = Join-Path $Root "portable"
  $portableApp = Join-Path $portableRoot "cdx-swap"
  if (Test-Path $portableRoot) {
    Remove-Item $portableRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $portableApp | Out-Null
  Copy-Item $appExe.FullName (Join-Path $portableApp "cdx-swap.exe") -Force
  Compress-Archive -Path $portableApp -DestinationPath $portableOut -Force

  Write-Host "Windows release artifacts copied to $OutputDir"
}
finally {
  Pop-Location
}
