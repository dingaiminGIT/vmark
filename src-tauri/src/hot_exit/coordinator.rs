//! Coordinator for hot exit capture and restore
//!
//! Orchestrates multi-window capture with timeout and restore logic.
//! Supports multi-window restoration with pull-based state retrieval.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use tauri::{AppHandle, Emitter, Listener, Manager};
use serde::{Deserialize, Serialize};
use super::session::{SessionData, WindowState, SCHEMA_VERSION, MAX_SESSION_AGE_DAYS};
use super::migration::{can_migrate, migrate_session, needs_migration};
use super::{EVENT_CAPTURE_REQUEST, EVENT_CAPTURE_RESPONSE, EVENT_CAPTURE_TIMEOUT, EVENT_RESTORE_START};

/// Pending restore state for multi-window restoration
/// Windows pull their state from here on startup
#[derive(Debug, Default)]
pub struct PendingRestoreState {
    /// Window states indexed by window label
    pub window_states: HashMap<String, WindowState>,
    /// Labels of windows that have completed restoration
    pub completed_windows: HashSet<String>,
    /// Total number of windows expected
    pub expected_count: usize,
}

/// Global pending restore state
static PENDING_RESTORE: OnceLock<Arc<Mutex<PendingRestoreState>>> = OnceLock::new();

/// Get the pending restore state (for testing or internal use)
pub fn get_pending_restore_state() -> Arc<Mutex<PendingRestoreState>> {
    Arc::clone(
        PENDING_RESTORE.get_or_init(|| Arc::new(Mutex::new(PendingRestoreState::default())))
    )
}

/// Clear pending restore state
pub async fn clear_pending_restore() {
    let pending = get_pending_restore_state();
    let mut state = pending.lock().await;
    state.window_states.clear();
    state.completed_windows.clear();
    state.expected_count = 0;
}

const CAPTURE_TIMEOUT_SECS: u64 = 5;

/// Capture response from a window
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CaptureResponse {
    pub window_label: String,
    pub state: WindowState,
}

/// Coordinator state for collecting window responses
struct CaptureState {
    expected_windows: HashSet<String>,
    responses: HashMap<String, WindowState>,
}

/// Capture session from all windows
pub async fn capture_session(app: &AppHandle) -> Result<SessionData, String> {
    // Get all document windows
    let windows: Vec<String> = app
        .webview_windows()
        .into_iter()
        .filter_map(|(label, _)| {
            if label == "main" || label.starts_with("doc-") {
                Some(label)
            } else {
                None
            }
        })
        .collect();

    if windows.is_empty() {
        return Err("No document windows to capture".to_string());
    }

    let state = Arc::new(Mutex::new(CaptureState {
        expected_windows: windows.iter().cloned().collect(),
        responses: HashMap::new(),
    }));

    // Listen for responses
    let state_clone = state.clone();
    let unlisten = app.listen(EVENT_CAPTURE_RESPONSE, move |event| {
        match serde_json::from_str::<CaptureResponse>(event.payload()) {
            Ok(response) => {
                let mut state = state_clone.blocking_lock();

                // Only accept responses from expected windows
                if !state.expected_windows.contains(&response.window_label) {
                    eprintln!(
                        "[HotExit] Ignoring response from unexpected window: {}",
                        response.window_label
                    );
                    return;
                }

                // Ignore duplicate responses from the same window
                if state.responses.contains_key(&response.window_label) {
                    eprintln!(
                        "[HotExit] Ignoring duplicate response from window: {}",
                        response.window_label
                    );
                    return;
                }

                // Verify window_label matches state.window_label
                if response.window_label != response.state.window_label {
                    eprintln!(
                        "[HotExit] Warning: response.window_label ({}) != state.window_label ({})",
                        response.window_label,
                        response.state.window_label
                    );
                }

                state.responses.insert(response.window_label.clone(), response.state);
            }
            Err(e) => {
                eprintln!(
                    "[HotExit] Failed to parse capture response ({}): {}",
                    event.payload().len(),
                    e
                );
            }
        }
    });

    // Broadcast capture request
    app.emit(EVENT_CAPTURE_REQUEST, ())
        .map_err(|e| format!("Failed to emit capture request: {}", e))?;

    // Wait for responses with timeout
    let result = timeout(
        Duration::from_secs(CAPTURE_TIMEOUT_SECS),
        wait_for_all_responses(state.clone(), windows.len()),
    )
    .await;

    // Unlisten
    app.unlisten(unlisten);

    let final_state = state.lock().await;

    // Build session from collected responses
    let windows_vec: Vec<WindowState> = final_state.responses.values().cloned().collect();

    let session = SessionData {
        version: SCHEMA_VERSION,
        timestamp: chrono::Utc::now().timestamp(),
        vmark_version: env!("CARGO_PKG_VERSION").to_string(),
        windows: windows_vec,
        workspace: None, // Workspace capture not yet implemented
    };

    match result {
        Ok(_) => {
            // All windows responded
            Ok(session)
        }
        Err(_) => {
            // Timeout - proceed with partial state
            eprintln!(
                "[HotExit] Timeout: Got {}/{} window responses",
                final_state.responses.len(),
                final_state.expected_windows.len()
            );
            let _ = app.emit(EVENT_CAPTURE_TIMEOUT, ());
            Ok(session)
        }
    }
}

async fn wait_for_all_responses(state: Arc<Mutex<CaptureState>>, expected: usize) {
    loop {
        {
            let current = state.lock().await;
            if current.responses.len() >= expected {
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

/// Restore session to main window (legacy single-window restore)
pub async fn restore_session(
    app: &AppHandle,
    session: SessionData,
) -> Result<(), String> {
    // Migrate session if needed
    let session = if needs_migration(&session) {
        eprintln!(
            "[HotExit] Migrating session from v{} to v{}",
            session.version, SCHEMA_VERSION
        );
        migrate_session(session)?
    } else if !can_migrate(session.version) {
        return Err(format!(
            "Incompatible session version: {} (supported: 1 to {})",
            session.version, SCHEMA_VERSION
        ));
    } else {
        session
    };

    // Check if session is stale (>7 days old)
    if session.is_stale(MAX_SESSION_AGE_DAYS) {
        return Err(format!("Session is too old (>{} days)", MAX_SESSION_AGE_DAYS));
    }

    // Emit restore event to main window
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    main_window
        .emit(EVENT_RESTORE_START, &session)
        .map_err(|e| format!("Failed to emit restore event: {}", e))?;

    Ok(())
}

/// Result of multi-window restore initialization
#[derive(Serialize, Deserialize, Debug)]
pub struct RestoreMultiWindowResult {
    pub windows_created: Vec<String>,
}

/// Initialize multi-window restore
///
/// Creates secondary windows and stores session state for pull-based restoration.
/// Each window will call get_window_restore_state on startup to get its state.
pub async fn restore_session_multi_window(
    app: &AppHandle,
    session: SessionData,
) -> Result<RestoreMultiWindowResult, String> {
    // Migrate session if needed
    let session = if needs_migration(&session) {
        eprintln!(
            "[HotExit] Migrating session from v{} to v{}",
            session.version, SCHEMA_VERSION
        );
        migrate_session(session)?
    } else if !can_migrate(session.version) {
        return Err(format!(
            "Incompatible session version: {} (supported: 1 to {})",
            session.version, SCHEMA_VERSION
        ));
    } else {
        session
    };

    // Check if session is stale (>7 days old)
    if session.is_stale(MAX_SESSION_AGE_DAYS) {
        return Err(format!("Session is too old (>{} days)", MAX_SESSION_AGE_DAYS));
    }

    // Store session state for each window
    let pending = get_pending_restore_state();
    {
        let mut state = pending.lock().await;
        state.window_states.clear();
        state.completed_windows.clear();
        // Start with 1 for main window - will add successfully created secondary windows
        state.expected_count = 1;

        for window_state in &session.windows {
            state.window_states.insert(window_state.window_label.clone(), window_state.clone());
        }
    }

    // Create secondary windows (not main)
    let mut windows_created = Vec::new();
    for window_state in &session.windows {
        if window_state.is_main_window {
            continue;
        }

        // Create document window
        match crate::window_manager::create_document_window(app, None, None) {
            Ok(label) => {
                // Update the window label mapping in pending state
                let mut state = pending.lock().await;
                if let Some(ws) = state.window_states.remove(&window_state.window_label) {
                    // Store with the NEW label (the one we just created)
                    state.window_states.insert(label.clone(), WindowState {
                        window_label: label.clone(),
                        ..ws
                    });
                }
                // Increment expected count for successfully created window
                state.expected_count += 1;
                windows_created.push(label);
            }
            Err(e) => {
                // Remove failed window's state to prevent orphan entries
                let mut state = pending.lock().await;
                state.window_states.remove(&window_state.window_label);
                eprintln!("[HotExit] Failed to create window for {}: {}", window_state.window_label, e);
            }
        }
    }

    // Emit restore start to main window
    // Main window should also call get_window_restore_state
    let main_window = app.get_webview_window("main").ok_or("Main window not found")?;
    main_window
        .emit(EVENT_RESTORE_START, &session)
        .map_err(|e| format!("Failed to emit restore event to main: {}", e))?;

    Ok(RestoreMultiWindowResult { windows_created })
}

/// Get pending window state for restoration
///
/// Called by windows on startup to get their pending restore state.
/// Returns None if no state is pending for the given window.
pub async fn get_window_restore_state(window_label: &str) -> Option<WindowState> {
    let pending = get_pending_restore_state();
    let state = pending.lock().await;
    state.window_states.get(window_label).cloned()
}

/// Mark a window as having completed restoration
///
/// Returns true if all expected windows have completed.
pub async fn mark_window_restore_complete(window_label: &str) -> bool {
    let pending = get_pending_restore_state();
    let mut state = pending.lock().await;
    state.completed_windows.insert(window_label.to_string());
    state.completed_windows.len() >= state.expected_count
}

/// Check if all windows have completed restoration
#[allow(dead_code)]
pub async fn all_windows_restored() -> bool {
    let pending = get_pending_restore_state();
    let state = pending.lock().await;
    state.expected_count > 0 && state.completed_windows.len() >= state.expected_count
}
