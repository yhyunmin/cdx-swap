use super::window;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

pub(super) const TRAY_ID: &str = "main-tray";
const DEFAULT_TOOLTIP: &str = "cdx-swap --%";

pub(super) fn setup_tray_icon(app: &AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(DEFAULT_TOOLTIP)
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                position,
                button,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if matches!(button, MouseButton::Left | MouseButton::Right) {
                    window::popup_context_menu(&app_handle, position);
                }
            }
        })
        .build(app)?;
    Ok(())
}
