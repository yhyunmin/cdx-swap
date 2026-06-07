mod event;
mod icon;
mod menu;
mod state;
mod window;

pub use state::TrayStore;

use crate::domain::TrayMenuState;
use tauri::AppHandle;

#[tauri::command]
pub fn set_tray_tooltip(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(icon::TRAY_ID) {
        tray.set_tooltip(Some(&label))
            .map_err(|error| format!("Failed to set tray tooltip: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn update_tray_menu_state(
    store: tauri::State<TrayStore>,
    menu_state: TrayMenuState,
) -> Result<(), String> {
    store.set_menu_state(menu_state)
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    register_menu_events(app);
    icon::setup_tray_icon(app)
}

fn register_menu_events(app: &AppHandle) {
    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        match id {
            menu::OPEN_ID => window::show_panel(app, false),
            menu::SETTINGS_ID => window::show_panel(app, true),
            menu::REFRESH_ID => event::emit_action(app, "refresh", None),
            menu::QUIT_ID => app.exit(0),
            _ => {
                if let Some(profile_id) = menu::profile_id_from_switch_item(id) {
                    event::emit_action(app, "switchProfile", Some(profile_id));
                }
            }
        }
    });
}
