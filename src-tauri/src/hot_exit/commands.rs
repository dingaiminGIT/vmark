/// Tauri commands for hot exit dev tools

use tauri::AppHandle;
use super::session::SessionData;
use super::storage::{read_session, delete_session, write_session_atomic};
use super::coordinator::{capture_session, restore_session};

#[tauri::command]
pub async fn hot_exit_test_capture(app: AppHandle) -> Result<SessionData, String> {
    capture_session(&app).await
}

#[tauri::command]
pub async fn hot_exit_test_restore(app: AppHandle, session: SessionData) -> Result<(), String> {
    restore_session(&app, session).await
}

#[tauri::command]
pub async fn hot_exit_inspect_session(app: AppHandle) -> Result<Option<SessionData>, String> {
    read_session(&app).await
}

#[tauri::command]
pub async fn hot_exit_clear_session(app: AppHandle) -> Result<(), String> {
    delete_session(&app).await
}
