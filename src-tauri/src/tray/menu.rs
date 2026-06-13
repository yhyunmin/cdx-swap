use crate::domain::{TrayMenuState, TrayProfile};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle,
};

pub(super) const OPEN_ID: &str = "tray:open";
pub(super) const SETTINGS_ID: &str = "tray:settings";
pub(super) const REFRESH_ID: &str = "tray:refresh";
pub(super) const QUIT_ID: &str = "tray:quit";
pub(super) const STATUS_ID: &str = "tray:status";
pub(super) const SWITCH_MENU_ID: &str = "tray:switch";
const LAST_ERROR_ID: &str = "tray:last-error";
const SWITCH_PREFIX: &str = "tray:switch:";

pub(super) fn build_context_menu(
    app: &AppHandle,
    state: &TrayMenuState,
) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    let active = active_profile(state);
    let active_id = active
        .map(|profile| profile.profile_id.as_str())
        .unwrap_or("none");
    let active_account = active
        .map(|profile| profile.account.as_str())
        .unwrap_or("unknown");
    let five_hour = active.and_then(|profile| profile.five_hour_left);
    let weekly = active.and_then(|profile| profile.weekly_left);

    let status = MenuItem::with_id(
        app,
        STATUS_ID,
        format!(
            "상태: {active_id} ({active_account}) 5H {} / Week {}",
            quota_label(five_hour),
            quota_label(weekly)
        ),
        false,
        None::<&str>,
    )?;
    let open = MenuItem::with_id(app, OPEN_ID, "열기", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, REFRESH_ID, "새로고침", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, SETTINGS_ID, "설정", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    menu.append(&status)?;
    if let Some(error) = state
        .last_switch_error
        .as_ref()
        .filter(|error| !error.trim().is_empty())
    {
        let short_error = truncate_label(error, 86);
        let item = MenuItem::with_id(
            app,
            LAST_ERROR_ID,
            format!("최근 경고: {short_error}"),
            false,
            None::<&str>,
        )?;
        menu.append(&item)?;
    }
    menu.append(&open)?;

    if !state.profiles.is_empty() {
        let switch_menu = Submenu::with_id(app, SWITCH_MENU_ID, "변경", true)?;
        for profile in &state.profiles {
            let is_active = Some(&profile.profile_id) == state.active_profile_id.as_ref();
            let item = MenuItem::with_id(
                app,
                switch_item_id(&profile.profile_id),
                if let Some(error) = profile
                    .error
                    .as_ref()
                    .filter(|error| !error.trim().is_empty())
                {
                    format!(
                        "{}{}  5H {} / Week {}  오류: {}",
                        profile.profile_id,
                        if is_active { " ✓" } else { "" },
                        quota_label(profile.five_hour_left),
                        quota_label(profile.weekly_left),
                        truncate_label(error, 42)
                    )
                } else if is_active {
                    format!(
                        "{} ✓  5H {} / Week {}",
                        profile.profile_id,
                        quota_label(profile.five_hour_left),
                        quota_label(profile.weekly_left)
                    )
                } else {
                    format!(
                        "{}  5H {} / Week {}",
                        profile.profile_id,
                        quota_label(profile.five_hour_left),
                        quota_label(profile.weekly_left)
                    )
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

pub(super) fn profile_id_from_switch_item(id: &str) -> Option<String> {
    id.strip_prefix(SWITCH_PREFIX)
        .filter(|profile_id| !profile_id.is_empty())
        .map(ToString::to_string)
}

fn switch_item_id(profile_id: &str) -> String {
    format!("{SWITCH_PREFIX}{profile_id}")
}

fn quota_label(value: Option<u8>) -> String {
    value.map_or_else(|| "--%".to_string(), |value| format!("{value}%"))
}

fn truncate_label(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
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
