use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::Duration,
};

fn ensure_codex_home_layout(codex_home: &str) -> Result<(), String> {
    let home = Path::new(codex_home);
    if !home.exists() {
        return Err(format!("Codex profile home does not exist: {codex_home}"));
    }
    if !home.is_dir() {
        return Err(format!(
            "Codex profile home is not a directory: {codex_home}"
        ));
    }

    let sessions = home.join("sessions");
    if !sessions.exists() {
        fs::create_dir_all(&sessions)
            .map_err(|error| format!("Failed to create Codex sessions directory: {error}"))?;
    } else if !sessions.is_dir() {
        return Err(format!(
            "Codex sessions path is not a directory: {}",
            sessions.display()
        ));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn running_codex_path() -> Option<PathBuf> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-Process Codex -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -First 1 -ExpandProperty Path)",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        None
    } else {
        Some(PathBuf::from(raw))
    }
}

#[cfg(target_os = "windows")]
fn desktop_path_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates.extend([
            PathBuf::from(&local_app_data)
                .join("Programs")
                .join("OpenAI")
                .join("Codex")
                .join("Codex.exe"),
            PathBuf::from(&local_app_data)
                .join("Programs")
                .join("OpenAI Codex")
                .join("Codex.exe"),
            PathBuf::from(&local_app_data)
                .join("Programs")
                .join("Codex")
                .join("Codex.exe"),
            PathBuf::from(&local_app_data)
                .join("OpenAI")
                .join("Codex")
                .join("Codex.exe"),
        ]);
    }
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        candidates.push(
            PathBuf::from(user_profile)
                .join("AppData")
                .join("Local")
                .join("Programs")
                .join("OpenAI")
                .join("Codex")
                .join("Codex.exe"),
        );
    }
    for var in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(program_files) = std::env::var(var) {
            candidates.extend([
                PathBuf::from(&program_files)
                    .join("OpenAI")
                    .join("Codex")
                    .join("Codex.exe"),
                PathBuf::from(&program_files)
                    .join("Codex")
                    .join("Codex.exe"),
            ]);
        }
    }
    candidates
}

#[cfg(target_os = "windows")]
fn looks_like_codex_cli(path: &Path) -> bool {
    let normalized = path
        .to_string_lossy()
        .replace('/', "\\")
        .to_ascii_lowercase();
    normalized.contains("\\bin\\codex.exe") || normalized.contains("\\windowsapps\\codex.exe")
}

#[cfg(target_os = "windows")]
fn resolve_codex_desktop_path(codex_desktop_path: &str) -> Option<PathBuf> {
    let configured = codex_desktop_path.trim();
    if !configured.is_empty() {
        let path = PathBuf::from(configured);
        if path.exists() && !looks_like_codex_cli(&path) {
            return Some(path);
        }
    }
    if let Some(path) =
        running_codex_path().filter(|path| path.exists() && !looks_like_codex_cli(path))
    {
        return Some(path);
    }
    desktop_path_candidates()
        .into_iter()
        .find(|candidate| candidate.exists() && !looks_like_codex_cli(candidate))
}

#[cfg(target_os = "windows")]
fn shutdown_codex_desktop() -> Result<(), String> {
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Process Codex -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }; Start-Sleep -Milliseconds 1500; Get-Process Codex -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
        ])
        .status()
        .map_err(|error| format!("Failed to request Codex Desktop shutdown: {error}"))?;
    thread::sleep(Duration::from_millis(1200));
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_codex_start_menu_app() -> Result<(), String> {
    let script = r#"
$app = Get-StartApps | Where-Object {
  $_.AppID -and ($_.Name -eq 'Codex' -or $_.Name -eq 'OpenAI Codex' -or $_.Name -eq 'Codex Desktop' -or $_.Name -like '*Codex*')
} | Select-Object -First 1
if (-not $app) { exit 2 }
Start-Process ("shell:AppsFolder\" + $app.AppID)
"#;
    let status = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .env_remove("WSL_DISTRO_NAME")
        .env_remove("WSL_INTEROP")
        .status()
        .map_err(|error| format!("Failed to launch Codex Desktop from Start menu: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(
            "Codex Desktop 실행 파일 또는 시작 메뉴 앱을 자동으로 찾지 못했습니다. Codex Desktop 실행 파일 경로를 설정하세요."
                .to_string(),
        )
    }
}

#[cfg(target_os = "windows")]
pub fn restart_codex_desktop(codex_desktop_path: &str, codex_home: &str) -> Result<(), String> {
    if codex_home.trim().is_empty() {
        return Err("Codex profile home could not be resolved.".to_string());
    }
    ensure_codex_home_layout(codex_home)?;

    let desktop_path = resolve_codex_desktop_path(codex_desktop_path);
    shutdown_codex_desktop()?;

    if let Some(desktop_path) = desktop_path {
        Command::new(&desktop_path)
            .env_remove("WSL_DISTRO_NAME")
            .env_remove("WSL_INTEROP")
            .spawn()
            .map_err(|error| format!("Failed to launch Codex Desktop: {error}"))?;
        return Ok(());
    }

    launch_codex_start_menu_app()
}

#[cfg(not(target_os = "windows"))]
pub fn restart_codex_desktop(_codex_desktop_path: &str, _codex_home: &str) -> Result<(), String> {
    Err("Codex Desktop restart is implemented for Windows first.".to_string())
}
