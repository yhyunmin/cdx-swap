use crate::domain::{TrayActionPayload, TrayMenuState, TrayProfile};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Position,
};

const TRAY_ID: &str = "main-tray";

#[derive(Clone, Default)]
pub struct TrayStore {
    state: Arc<Mutex<TrayMenuState>>,
    last_position: Arc<Mutex<Option<PhysicalPosition<f64>>>>,
}

#[tauri::command]
pub fn set_tray_tooltip(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
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
    *store
        .state
        .lock()
        .map_err(|_| "Tray state lock failed.".to_string())? = menu_state;
    Ok(())
}

fn quota_label(value: Option<u8>) -> String {
    value.map_or_else(|| "--%".to_string(), |value| format!("{value}%"))
}

fn active_profile<'a>(state: &'a TrayMenuState) -> Option<&'a TrayProfile> {
    state
        .active_profile_id
        .as_ref()
        .and_then(|id| {
            state
                .profiles
                .iter()
                .find(|profile| &profile.profile_id == id)
        })
        .or_else(|| state.profiles.first())
}

fn emit_action(app: &AppHandle, action: &str, profile_id: Option<String>) {
    let _ = app.emit(
        "tray-action",
        TrayActionPayload {
            action: action.to_string(),
            profile_id,
        },
    );
}

fn show_panel(app: &AppHandle, settings: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Some(store) = app.try_state::<TrayStore>() {
        if let Ok(position) = store.last_position.lock() {
            if let Some(position) = *position {
                let mut x = position.x as i32 - 420;
                let mut y = position.y as i32 - 560;

                if let Ok(Some(monitor)) = window.current_monitor() {
                    let area = monitor.work_area();
                    let max_x = area.position.x + area.size.width as i32 - 420;
                    let max_y = area.position.y + area.size.height as i32 - 560;
                    x = x.clamp(area.position.x, max_x.max(area.position.x));
                    y = y.clamp(area.position.y, max_y.max(area.position.y));
                } else {
                    x = x.max(0);
                    y = y.max(0);
                }

                let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
            }
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
    emit_action(app, if settings { "settings" } else { "open" }, None);
}

fn build_context_menu(app: &AppHandle, state: &TrayMenuState) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    let active = active_profile(state);
    let active_id = active
        .map(|profile| profile.profile_id.as_str())
        .unwrap_or("none");
    let five_hour = active.and_then(|profile| profile.five_hour_left);
    let weekly = active.and_then(|profile| profile.weekly_left);
    let status = MenuItem::with_id(
        app,
        "tray:status",
        format!(
            "상태: {active_id} 5H {} / Week {}",
            quota_label(five_hour),
            quota_label(weekly)
        ),
        false,
        None::<&str>,
    )?;
    let open = MenuItem::with_id(app, "tray:open", "열기", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "tray:refresh", "새로고침", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "tray:settings", "설정", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray:quit", "종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    menu.append(&status)?;
    menu.append(&open)?;

    if !state.profiles.is_empty() {
        let switch_menu = Submenu::with_id(app, "tray:switch", "변경", true)?;
        for profile in &state.profiles {
            let is_active = Some(&profile.profile_id) == state.active_profile_id.as_ref();
            let item = MenuItem::with_id(
                app,
                format!("tray:switch:{}", profile.profile_id),
                if is_active {
                    format!("{} ✓", profile.profile_id)
                } else {
                    profile.profile_id.clone()
                },
                !is_active,
                None::<&str>,
            )?;
            switch_menu.append(&item)?;
        }
        menu.append(&switch_menu)?;
    }

    menu.append(&refresh)?;
    menu.append(&settings)?;
    menu.append(&separator)?;
    menu.append(&quit)?;
    Ok(menu)
}

fn popup_context_menu(app: &AppHandle, position: PhysicalPosition<f64>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Some(store) = app.try_state::<TrayStore>() {
        if let Ok(mut last_position) = store.last_position.lock() {
            *last_position = Some(position);
        }
        let state = store
            .state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default();
        if let Ok(menu) = build_context_menu(app, &state) {
            let _ = window.popup_menu(&menu);
        }
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        match id {
            "tray:open" => show_panel(app, false),
            "tray:settings" => show_panel(app, true),
            "tray:refresh" => emit_action(app, "refresh", None),
            "tray:quit" => app.exit(0),
            _ if id.starts_with("tray:switch:") => {
                emit_action(
                    app,
                    "switchProfile",
                    Some(id["tray:switch:".len()..].to_string()),
                );
            }
            _ => {}
        }
    });

    TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("cdx-swap --%")
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                position,
                button,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if matches!(button, MouseButton::Left | MouseButton::Right) {
                    popup_context_menu(&app_handle, position);
                }
            }
        })
        .build(app)?;
    Ok(())
}
