/// Coordinator for hot exit capture and restore
///
/// Orchestrates multi-window capture with timeout and restore logic.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use tauri::{AppHandle, Emitter, Listener, Manager};
use serde::{Deserialize, Serialize};
use super::session::{SessionData, WindowState, SCHEMA_VERSION, MAX_SESSION_AGE_DAYS};
use super::{EVENT_CAPTURE_REQUEST, EVENT_CAPTURE_RESPONSE, EVENT_CAPTURE_TIMEOUT, EVENT_RESTORE_START};

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

/// Restore session to main window
pub async fn restore_session(
    app: &AppHandle,
    session: SessionData,
) -> Result<(), String> {
    // Validate version
    if !session.is_compatible() {
        return Err(format!(
            "Incompatible session version: {} (expected {})",
            session.version, SCHEMA_VERSION
        ));
    }

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
