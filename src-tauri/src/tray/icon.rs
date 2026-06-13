use super::window;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

pub(super) const TRAY_ID: &str = "main-tray";
const DEFAULT_TOOLTIP: &str = "cdx-swap --%";

pub(super) fn setup_tray_icon(app: &AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(DEFAULT_TOOLTIP)
        .icon(tray_icon_image());

    builder
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

fn tray_icon_image() -> Image<'static> {
    const SIZE: u32 = 32;
    let mut rgba = vec![0_u8; (SIZE * SIZE * 4) as usize];
    let center = (SIZE as f32 - 1.0) / 2.0;
    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            let idx = ((y * SIZE + x) * 4) as usize;
            if distance > 15.2 {
                continue;
            }
            let alpha = if distance > 14.2 {
                ((15.2 - distance).clamp(0.0, 1.0) * 255.0) as u8
            } else {
                255
            };
            rgba[idx] = 234;
            rgba[idx + 1] = 60;
            rgba[idx + 2] = 89;
            rgba[idx + 3] = alpha;
        }
    }

    for y in 10..23 {
        for x in 8..25 {
            let left = x as i32 - 8;
            let right = 24_i32 - x as i32;
            let top = y as i32 - 10;
            let bottom = 22_i32 - y as i32;
            if left + top >= 6 && right + top >= 6 && left + bottom >= 6 && right + bottom >= 6 {
                let idx = ((y * SIZE + x) * 4) as usize;
                rgba[idx] = 255;
                rgba[idx + 1] = 255;
                rgba[idx + 2] = 255;
                rgba[idx + 3] = 255;
            }
        }
    }

    Image::new_owned(rgba, SIZE, SIZE)
}
