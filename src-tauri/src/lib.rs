mod actions;
mod claude;
mod config;
mod desktop;
mod domain;
mod profiles;
mod tray;
mod upstream;
mod usage;

use actions::{get_action_session, send_action_input, start_action_session, ActionStore};
use claude::{finish_claude_login, get_claude_usage, logout_claude, start_claude_login};
use config::{get_app_config, save_app_config};
use desktop::restart_codex_desktop;
use domain::{
    AppConfig, DesktopRestartResult, SshSyncResult, SshSyncStage, SwitchResult, WindowsSwitchResult,
};
use profiles::{
    ensure_profile, get_current_account_status, list_profile_usage, resolve_profile,
    sync_default_auth_to_ssh, sync_profile_auth_to_default_home,
};
use tray::{set_tray_tooltip, setup_tray, update_tray_menu_state, TrayStore};
use upstream::check_cdx_upstream;

#[tauri::command]
fn switch_profile(profile_id: String, config: AppConfig) -> Result<SwitchResult, String> {
    let profile =
        resolve_profile(&profile_id)?.ok_or_else(|| format!("Unknown profile: {profile_id}"))?;
    sync_profile_auth_to_default_home(&profile)?;
    let windows = WindowsSwitchResult {
        ok: true,
        message: format!("Windows Codex 토큰을 {profile_id}(으)로 변경했습니다."),
    };
    let desktop = if config.restart_desktop_on_switch {
        match restart_codex_desktop(&config.codex_desktop_path, &profile.home_path) {
            Ok(()) => DesktopRestartResult {
                requested: true,
                ok: Some(true),
                restarted: true,
                message: Some("Codex Desktop을 재시작했습니다.".to_string()),
            },
            Err(error) => DesktopRestartResult {
                requested: true,
                ok: Some(false),
                restarted: false,
                message: Some(error),
            },
        }
    } else {
        DesktopRestartResult {
            requested: false,
            ok: None,
            restarted: false,
            message: None,
        }
    };
    let ssh = if config.ssh_codex_sync_enabled {
        sync_default_auth_to_ssh(&config.ssh_codex_host)
    } else {
        SshSyncResult {
            enabled: false,
            ok: None,
            stage: SshSyncStage::Disabled,
            message: None,
        }
    };
    let mut message =
        format!("활성 프로필과 Windows Codex 토큰을 {profile_id}(으)로 변경했습니다.");
    if desktop.ok == Some(false) {
        message.push_str(" Codex Desktop 재시작은 실패했습니다.");
    }
    if ssh.ok == Some(false) {
        message.push_str(" SSH Codex 동기화는 실패했습니다.");
    }
    Ok(SwitchResult {
        active_profile_id: profile_id.clone(),
        desktop_restarted: desktop.restarted,
        windows,
        desktop,
        ssh,
        message,
    })
}

#[tauri::command]
fn retry_ssh_codex_sync(config: AppConfig) -> Result<SshSyncResult, String> {
    if !config.ssh_codex_sync_enabled {
        return Ok(SshSyncResult {
            enabled: false,
            ok: None,
            stage: SshSyncStage::Disabled,
            message: None,
        });
    }
    Ok(sync_default_auth_to_ssh(&config.ssh_codex_host))
}

pub fn run() {
    let result = tauri::Builder::default()
        .manage(ActionStore::default())
        .manage(TrayStore::default())
        .setup(|app| {
            setup_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            save_app_config,
            list_profile_usage,
            ensure_profile,
            get_current_account_status,
            start_action_session,
            send_action_input,
            get_action_session,
            start_claude_login,
            finish_claude_login,
            logout_claude,
            get_claude_usage,
            switch_profile,
            retry_ssh_codex_sync,
            set_tray_tooltip,
            update_tray_menu_state,
            check_cdx_upstream
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("error while running cdx-swap: {error}");
    }
}
