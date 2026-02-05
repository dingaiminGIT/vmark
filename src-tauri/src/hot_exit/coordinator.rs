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
    /// Set of window labels that are expected to complete restoration
    pub expected_labels: HashSet<String>,
    /// Labels of windows that have completed restoration
    pub completed_windows: HashSet<String>,
}

impl PendingRestoreState {
    /// Check if all expected windows have completed
    fn all_complete(&self) -> bool {
        !self.expected_labels.is_empty()
            && self.expected_labels.iter().all(|label| self.completed_windows.contains(label))
    }

    /// Clear all state
    fn clear(&mut self) {
        self.window_states.clear();
        self.expected_labels.clear();
        self.completed_windows.clear();
    }
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
    state.clear();
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
            Ok(mut response) => {
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

                // Normalize: ensure state.window_label matches the response key
                if response.window_label != response.state.window_label {
                    eprintln!(
                        "[HotExit] Normalizing mismatched window_label: {} -> {}",
                        response.state.window_label,
                        response.window_label
                    );
                    response.state.window_label = response.window_label.clone();
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

    // Broadcast capture request - ensure unlisten on failure
    if let Err(e) = app.emit(EVENT_CAPTURE_REQUEST, ()) {
        app.unlisten(unlisten);
        return Err(format!("Failed to emit capture request: {}", e));
    }

    // Wait for responses with timeout
    let result = timeout(
        Duration::from_secs(CAPTURE_TIMEOUT_SECS),
        wait_for_all_responses(state.clone(), windows.len()),
    )
    .await;

    // Always unlisten after waiting
    app.unlisten(unlisten);

    let final_state = state.lock().await;

    // Build session from collected responses, sorted deterministically
    let mut windows_vec: Vec<WindowState> = final_state.responses.values().cloned().collect();
    windows_vec.sort_by(|a, b| {
        // Main window first, then by label
        match (a.is_main_window, b.is_main_window) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.window_label.cmp(&b.window_label),
        }
    });

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
            if let Err(e) = app.emit(EVENT_CAPTURE_TIMEOUT, ()) {
                eprintln!("[HotExit] Failed to emit capture timeout event: {}", e);
            }
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

/// Prepare session for restoration: migrate if needed, validate version and staleness
fn prepare_session_for_restore(session: SessionData) -> Result<SessionData, String> {
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

    Ok(session)
}

/// Initialize pending restore state with given windows
async fn init_pending_restore_state(
    windows: impl IntoIterator<Item = (String, WindowState)>,
    expected_labels: HashSet<String>,
) {
    let pending = get_pending_restore_state();
    let mut state = pending.lock().await;
    state.clear();
    state.expected_labels = expected_labels;
    for (label, window_state) in windows {
        state.window_states.insert(label, window_state);
    }
}

/// Restore session to main window (legacy single-window restore)
///
/// Now uses pull-based approach: stores state in PendingRestoreState,
/// then emits RESTORE_START signal to trigger main window to pull its state.
pub async fn restore_session(
    app: &AppHandle,
    session: SessionData,
) -> Result<(), String> {
    let session = prepare_session_for_restore(session)?;

    // Validate main window exists BEFORE modifying state
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Find main window state only (single-window restore)
    let main_state = session
        .windows
        .iter()
        .find(|w| w.window_label == "main")
        .cloned()
        .ok_or("No main window state in session")?;

    // Store only main window state for pull-based retrieval
    let expected = std::iter::once("main".to_string()).collect();
    init_pending_restore_state(
        std::iter::once(("main".to_string(), main_state)),
        expected,
    ).await;

    // Emit restore signal to main window (signal only, state is pulled)
    main_window
        .emit(EVENT_RESTORE_START, ())
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
///
/// CRITICAL: State is stored BEFORE windows are created, and the mutex is held
/// across window creation to prevent race conditions where a window starts
/// before its state is available.
pub async fn restore_session_multi_window(
    app: &AppHandle,
    session: SessionData,
) -> Result<RestoreMultiWindowResult, String> {
    let session = prepare_session_for_restore(session)?;

    // Validate main window exists BEFORE modifying state
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Collect secondary windows to create
    let secondary_windows: Vec<_> = session
        .windows
        .iter()
        .filter(|w| !w.is_main_window)
        .cloned()
        .collect();

    // CRITICAL: Hold mutex while creating windows to prevent race conditions.
    // Windows can start their JS immediately after creation, so state must be
    // ready BEFORE the window exists.
    let pending = get_pending_restore_state();
    let mut windows_created = Vec::new();

    {
        let mut state = pending.lock().await;
        state.clear();

        // Store main window state first
        if let Some(main_state) = session.windows.iter().find(|w| w.is_main_window) {
            state.window_states.insert("main".to_string(), main_state.clone());
            state.expected_labels.insert("main".to_string());
        }

        // Create each secondary window while holding the lock
        for window_state in secondary_windows {
            match crate::window_manager::create_document_window(app, None, None) {
                Ok(new_label) => {
                    // Store state with NEW label BEFORE window's JS can query it
                    let updated_state = WindowState {
                        window_label: new_label.clone(),
                        ..window_state
                    };
                    state.window_states.insert(new_label.clone(), updated_state);
                    state.expected_labels.insert(new_label.clone());
                    windows_created.push(new_label);
                }
                Err(e) => {
                    eprintln!(
                        "[HotExit] Failed to create window for {}: {}",
                        window_state.window_label, e
                    );
                    // Don't add to expected_labels - window doesn't exist
                }
            }
        }
    } // Mutex released here - all state is now ready

    // Emit restore signal to main window (signal only, state is pulled)
    main_window
        .emit(EVENT_RESTORE_START, ())
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
/// Only counts windows that were in the expected set.
pub async fn mark_window_restore_complete(window_label: &str) -> bool {
    let pending = get_pending_restore_state();
    let mut state = pending.lock().await;

    // Only track completion for expected windows
    if state.expected_labels.contains(window_label) {
        state.completed_windows.insert(window_label.to_string());
    } else {
        eprintln!(
            "[HotExit] Ignoring completion from unexpected window: {}",
            window_label
        );
    }

    state.all_complete()
}
