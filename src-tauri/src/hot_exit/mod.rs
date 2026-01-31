/// Hot Exit Module
///
/// Provides session capture and restore functionality for update restarts.
/// The Rust coordinator ensures atomic file writes and multi-window coordination.

pub mod session;
pub mod storage;
pub mod coordinator;
pub mod commands;

// Re-export commonly used types
pub use session::{SessionData, WindowState, TabState, DocumentState};
pub use storage::{write_session_atomic, read_session, delete_session};
pub use coordinator::{capture_session, restore_session};

// Event names
pub const EVENT_CAPTURE_REQUEST: &str = "hot-exit:capture-request";
pub const EVENT_CAPTURE_RESPONSE: &str = "hot-exit:capture-response";
pub const EVENT_CAPTURE_TIMEOUT: &str = "hot-exit:capture-timeout";
pub const EVENT_RESTORE_START: &str = "hot-exit:restore-start";
pub const EVENT_RESTORE_COMPLETE: &str = "hot-exit:restore-complete";
pub const EVENT_RESTORE_FAILED: &str = "hot-exit:restore-failed";
pub const EVENT_TRIGGER_RESTART: &str = "hot-exit:trigger-restart";
