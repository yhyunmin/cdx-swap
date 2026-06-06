use std::{process::Command, thread, time::Duration};

#[cfg(target_os = "windows")]
pub fn restart_codex_desktop(codex_desktop_path: &str) -> Result<(), String> {
    if codex_desktop_path.trim().is_empty() {
        return Err("Codex Desktop 실행 파일 경로를 설정해야 합니다.".to_string());
    }

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
        .spawn()
        .map_err(|error| format!("Failed to launch Codex Desktop: {error}"))?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn restart_codex_desktop(_codex_desktop_path: &str) -> Result<(), String> {
    Err("Codex Desktop restart is implemented for Windows first.".to_string())
}
