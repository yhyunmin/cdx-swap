use super::{event, menu, TrayStore};
use tauri::{AppHandle, Manager, PhysicalPosition, Position};

const PANEL_WIDTH: i32 = 420;
const PANEL_HEIGHT: i32 = 560;

pub(super) fn show_panel(app: &AppHandle, settings: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Some(store) = app.try_state::<TrayStore>() {
        if let Some(position) = store.last_position() {
            let (x, y) = panel_position(&window, position);
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }
    }

    let _ = window.show();
    let _ = window.set_focus();
    event::emit_action(app, if settings { "settings" } else { "open" }, None);
}

pub(super) fn popup_context_menu(app: &AppHandle, position: PhysicalPosition<f64>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(store) = app.try_state::<TrayStore>() else {
        return;
    };

    store.set_last_position(position);
    let state = store.menu_state();
    if let Ok(menu) = menu::build_context_menu(app, &state) {
        let _ = window.popup_menu(&menu);
    }
}

fn panel_position(window: &tauri::WebviewWindow, position: PhysicalPosition<f64>) -> (i32, i32) {
    let mut x = position.x as i32 - PANEL_WIDTH;
    let mut y = position.y as i32 - PANEL_HEIGHT;

    if let Ok(Some(monitor)) = window.current_monitor() {
        let area = monitor.work_area();
        let max_x = area.position.x + area.size.width as i32 - PANEL_WIDTH;
        let max_y = area.position.y + area.size.height as i32 - PANEL_HEIGHT;
        x = x.clamp(area.position.x, max_x.max(area.position.x));
        y = y.clamp(area.position.y, max_y.max(area.position.y));
    } else {
        x = x.max(0);
        y = y.max(0);
    }

    (x, y)
}
