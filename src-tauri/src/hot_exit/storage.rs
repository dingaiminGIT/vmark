/// Atomic storage operations for hot exit sessions
///
/// Uses tmp + rename pattern to ensure atomic writes and data durability.

use std::fs::{File, rename};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;
use tempfile::NamedTempFile;
use super::session::SessionData;

/// Get the hot exit session file path in app data directory
pub fn get_session_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure directory exists
    std::fs::create_dir_all(&app_data)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(app_data.join("session.json"))
}

/// Get the backup session path
pub fn get_backup_session_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data.join("session.prev.json"))
}

/// Write session atomically with tmp + rename pattern
pub async fn write_session_atomic(
    app: &tauri::AppHandle,
    session: &SessionData,
) -> Result<(), String> {
    let session_path = get_session_path(app)?;
    let backup_path = get_backup_session_path(app)?;

    // Serialize to JSON
    let json = serde_json::to_string_pretty(session)
        .map_err(|e| format!("JSON serialization failed: {}", e))?;

    // Write to temporary file in same directory (ensures same filesystem)
    let tmp_dir = session_path
        .parent()
        .ok_or("Session path has no parent")?;
    let mut tmp_file = NamedTempFile::new_in(tmp_dir)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    tmp_file
        .write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    // Flush to disk (critical for durability)
    tmp_file
        .flush()
        .map_err(|e| format!("Failed to flush temp file: {}", e))?;

    tmp_file
        .as_file()
        .sync_all()
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;

    // Backup existing session if it exists
    if session_path.exists() {
        std::fs::copy(&session_path, &backup_path)
            .map_err(|e| format!("Failed to backup session: {}", e))?;
    }

    // Atomic rename (overwrites existing session.json)
    tmp_file
        .persist(&session_path)
        .map_err(|e| format!("Failed to persist session: {}", e))?;

    Ok(())
}

/// Read session from disk
pub async fn read_session(
    app: &tauri::AppHandle,
) -> Result<Option<SessionData>, String> {
    let session_path = get_session_path(app)?;

    if !session_path.exists() {
        return Ok(None);
    }

    let contents = tokio::fs::read_to_string(&session_path)
        .await
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let session: SessionData = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse session JSON: {}", e))?;

    Ok(Some(session))
}

/// Delete session file after successful restore
pub async fn delete_session(app: &tauri::AppHandle) -> Result<(), String> {
    let session_path = get_session_path(app)?;

    if session_path.exists() {
        tokio::fs::remove_file(&session_path)
            .await
            .map_err(|e| format!("Failed to delete session: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    // Note: These tests would require mocking AppHandle
    // For now, we test the logic with manual integration tests
}
