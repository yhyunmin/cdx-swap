use crate::domain::AppConfig;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const CONFIG_FILE: &str = "config.json";

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create config directory: {error}"))?;
    Ok(dir.join(CONFIG_FILE))
}

#[tauri::command]
pub fn get_app_config(app: AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let raw =
        fs::read_to_string(path).map_err(|error| format!("Failed to read config: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("Failed to parse config: {error}"))
}

#[tauri::command]
pub fn save_app_config(app: AppHandle, mut config: AppConfig) -> Result<AppConfig, String> {
    config.refresh_interval_seconds = config.refresh_interval_seconds.max(15);
    configure_autostart(&app, config.autostart)?;

    let path = config_path(&app)?;
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize config: {error}"))?;
    fs::write(path, format!("{raw}\n"))
        .map_err(|error| format!("Failed to save config: {error}"))?;
    Ok(config)
}

#[cfg(target_os = "windows")]
fn configure_autostart(_app: &AppHandle, enabled: bool) -> Result<(), String> {
    use std::process::Command;

    const AUTOSTART_NAME: &str = "CodexUsageTray";
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let mut command = Command::new("reg");
    if enabled {
        let exe = std::env::current_exe()
            .map_err(|error| format!("Failed to resolve executable path: {error}"))?;
        command.args([
            "add",
            key,
            "/v",
            AUTOSTART_NAME,
            "/t",
            "REG_SZ",
            "/d",
            &exe.to_string_lossy(),
            "/f",
        ]);
    } else {
        command.args(["delete", key, "/v", AUTOSTART_NAME, "/f"]);
    }

    let status = command
        .status()
        .map_err(|error| format!("Failed to update autostart: {error}"))?;
    if status.success() || !enabled {
        Ok(())
    } else {
        Err("Failed to enable Windows autostart.".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
fn configure_autostart(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    Ok(())
}
