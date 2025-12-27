use tauri::{AppHandle, Emitter};

pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    let event_name = format!("menu:{id}");
    let _ = app.emit(&event_name, ());
}
