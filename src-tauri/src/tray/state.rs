use crate::domain::TrayMenuState;
use std::sync::{Arc, Mutex};
use tauri::PhysicalPosition;

#[derive(Clone, Default)]
pub struct TrayStore {
    state: Arc<Mutex<TrayMenuState>>,
    last_position: Arc<Mutex<Option<PhysicalPosition<f64>>>>,
}

impl TrayStore {
    pub fn set_menu_state(&self, menu_state: TrayMenuState) -> Result<(), String> {
        *self
            .state
            .lock()
            .map_err(|_| "Tray state lock failed.".to_string())? = menu_state;
        Ok(())
    }

    pub fn menu_state(&self) -> TrayMenuState {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }

    pub fn set_last_position(&self, position: PhysicalPosition<f64>) {
        if let Ok(mut last_position) = self.last_position.lock() {
            *last_position = Some(position);
        }
    }

    pub fn last_position(&self) -> Option<PhysicalPosition<f64>> {
        self.last_position
            .lock()
            .ok()
            .and_then(|position| *position)
    }
}
