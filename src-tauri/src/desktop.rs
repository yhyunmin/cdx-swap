use std::{fs, path::Path, process::Command, thread, time::Duration};

fn ensure_codex_home_layout(codex_home: &str) -> Result<(), String> {
    let home = Path::new(codex_home);
    if !home.exists() {
        return Err(format!("Codex profile home does not exist: {codex_home}"));
    }
    if !home.is_dir() {
        return Err(format!("Codex profile home is not a directory: {codex_home}"));
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
pub fn restart_codex_desktop(codex_desktop_path: &str, codex_home: &str) -> Result<(), String> {
    if codex_desktop_path.trim().is_empty() {
        return Err("Codex Desktop 실행 파일 경로를 설정해야 합니다.".to_string());
    }
    if codex_home.trim().is_empty() {
        return Err("Codex profile home could not be resolved.".to_string());
    }
    ensure_codex_home_layout(codex_home)?;

    Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Process Codex -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }; Start-Sleep -Milliseconds 1500; Get-Process Codex -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
        ])
        .status()
        .map_err(|error| format!("Failed to request Codex Desktop shutdown: {error}"))?;

    thread::sleep(Duration::from_millis(1200));
    Command::new(codex_desktop_path)
        .env("CODEX_HOME", codex_home)
        .env_remove("WSL_DISTRO_NAME")
        .env_remove("WSL_INTEROP")
        .spawn()
        .map_err(|error| format!("Failed to launch Codex Desktop: {error}"))?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn restart_codex_desktop(_codex_desktop_path: &str, _codex_home: &str) -> Result<(), String> {
    Err("Codex Desktop restart is implemented for Windows first.".to_string())
}
