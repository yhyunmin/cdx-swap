use crate::domain::TrayActionPayload;
use tauri::{AppHandle, Emitter};

pub(super) fn emit_action(app: &AppHandle, action: &str, profile_id: Option<String>) {
    let _ = app.emit(
        "tray-action",
        TrayActionPayload {
            action: action.to_string(),
            profile_id,
        },
    );
}
