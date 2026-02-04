/// Tauri commands for hot exit
///
/// These commands provide session capture, restore, and management for the hot exit feature.
/// They are used both in production (update restart flow) and for developer testing.

use tauri::AppHandle;
use super::session::{SessionData, WindowState};
use super::storage::{read_session, delete_session, write_session_atomic};
use super::coordinator::{
    capture_session,
    restore_session,
    restore_session_multi_window,
    get_window_restore_state,
    mark_window_restore_complete,
    clear_pending_restore,
    RestoreMultiWindowResult,
};

/// Capture session from all windows and persist to disk atomically
#[tauri::command]
pub async fn hot_exit_capture(app: AppHandle) -> Result<SessionData, String> {
    let session = capture_session(&app).await?;
    write_session_atomic(&app, &session).await?;
    Ok(session)
}

/// Restore session to current window from provided session data
#[tauri::command]
pub async fn hot_exit_restore(app: AppHandle, session: SessionData) -> Result<(), String> {
    restore_session(&app, session).await
}

/// Inspect the saved session file (returns None if no session exists)
#[tauri::command]
pub async fn hot_exit_inspect_session(app: AppHandle) -> Result<Option<SessionData>, String> {
    read_session(&app).await
}

/// Delete the saved session file
#[tauri::command]
pub async fn hot_exit_clear_session(app: AppHandle) -> Result<(), String> {
    // Also clear pending restore state
    clear_pending_restore().await;
    delete_session(&app).await
}

/// Initialize multi-window restore
///
/// Creates secondary windows and stores session state for pull-based restoration.
/// Returns list of created window labels.
#[tauri::command]
pub async fn hot_exit_restore_multi_window(
    app: AppHandle,
    session: SessionData,
) -> Result<RestoreMultiWindowResult, String> {
    restore_session_multi_window(&app, session).await
}

/// Get pending window state for restoration
///
/// Called by windows on startup to get their pending restore state.
/// Returns None if no state is pending for the given window.
#[tauri::command]
pub async fn hot_exit_get_window_state(window_label: String) -> Option<WindowState> {
    get_window_restore_state(&window_label).await
}

/// Mark a window as having completed restoration
///
/// Returns true if all expected windows have completed.
#[tauri::command]
pub async fn hot_exit_window_restore_complete(window_label: String) -> bool {
    mark_window_restore_complete(&window_label).await
}
