mod actions;
mod config;
mod desktop;
mod domain;
mod profiles;
mod tray;
mod upstream;
mod usage;

use actions::{get_action_session, send_action_input, start_action_session, ActionStore};
use config::{get_app_config, save_app_config};
use desktop::restart_codex_desktop;
use domain::{AppConfig, SwitchResult};
use profiles::{ensure_profile, list_profile_usage};
use tray::{set_tray_tooltip, setup_tray, update_tray_menu_state, TrayStore};
use upstream::check_cdx_upstream;

#[tauri::command]
fn switch_profile(profile_id: String, config: AppConfig) -> Result<SwitchResult, String> {
    if !config.restart_desktop_on_switch {
        return Ok(SwitchResult {
            active_profile_id: profile_id.clone(),
            desktop_restarted: false,
            message: format!("활성 프로필을 {profile_id}(으)로 변경했습니다."),
        });
    }

    restart_codex_desktop(&config.codex_desktop_path)?;
    Ok(SwitchResult {
        active_profile_id: profile_id.clone(),
        desktop_restarted: true,
        message: format!(
            "{profile_id} 선택 후 Codex Desktop을 재시작했습니다. Desktop 로그인 전환은 수동 확인이 필요할 수 있습니다."
        ),
    })
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
            start_action_session,
            send_action_input,
            get_action_session,
            switch_profile,
            set_tray_tooltip,
            update_tray_menu_state,
            check_cdx_upstream
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("error while running cdx-swap: {error}");
    }
}
