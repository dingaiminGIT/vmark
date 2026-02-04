/// Session data structures for hot exit
///
/// These structs mirror the TypeScript types in src/utils/hotExit/types.ts

use serde::{Deserialize, Serialize};

/// Schema version for hot exit sessions
pub const SCHEMA_VERSION: u32 = 1;

/// Maximum session age in days before considering it stale
pub const MAX_SESSION_AGE_DAYS: i64 = 7;

/// Seconds per day constant to avoid magic numbers
const SECONDS_PER_DAY: i64 = 86_400;

/// Complete application session state
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionData {
    pub version: u32,
    pub timestamp: i64,
    pub vmark_version: String,
    pub windows: Vec<WindowState>,
    pub workspace: Option<WorkspaceState>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WindowState {
    pub window_label: String,
    pub is_main_window: bool,
    pub active_tab_id: Option<String>,
    pub tabs: Vec<TabState>,
    pub ui_state: UiState,
    pub geometry: Option<WindowGeometry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TabState {
    pub id: String,
    pub file_path: Option<String>,
    pub title: String,
    pub is_pinned: bool,
    pub document: DocumentState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DocumentState {
    pub content: String,
    pub saved_content: String,
    pub is_dirty: bool,
    pub is_missing: bool,
    pub is_divergent: bool,
    pub line_ending: String,
    pub cursor_info: Option<CursorInfo>,
    pub last_modified_timestamp: Option<i64>,
    pub is_untitled: bool,
    pub untitled_number: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CursorInfo {
    pub source_line: u32,
    pub word_at_cursor: String,
    pub offset_in_word: u32,
    pub node_type: String,
    pub percent_in_line: f32,
    pub context_before: String,
    pub context_after: String,
    pub block_anchor: Option<serde_json::Value>, // Polymorphic - can be TableAnchor or CodeBlockAnchor
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UiState {
    pub sidebar_visible: bool,
    pub sidebar_width: u32,
    pub outline_visible: bool,
    pub sidebar_view_mode: String,
    pub status_bar_visible: bool,
    pub source_mode_enabled: bool,
    pub focus_mode_enabled: bool,
    pub typewriter_mode_enabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceState {
    pub root_path: Option<String>,
    pub is_workspace_mode: bool,
    pub show_hidden_files: bool,
}

impl SessionData {
    /// Create empty session with current version (test helper)
    #[cfg(test)]
    pub fn new(vmark_version: String) -> Self {
        Self {
            version: SCHEMA_VERSION,
            timestamp: chrono::Utc::now().timestamp(),
            vmark_version,
            windows: Vec::new(),
            workspace: None,
        }
    }

    /// Validate session schema version (exact match).
    /// Note: For production use, prefer migration::can_migrate() which supports older versions.
    #[allow(dead_code)]
    pub fn is_compatible(&self) -> bool {
        self.version == SCHEMA_VERSION
    }

    /// Check if session is stale (older than max_age_days)
    ///
    /// Returns true if:
    /// - Session is older than max_age_days
    /// - Session timestamp is in the future (clock skew)
    /// - max_age_days is invalid (<= 0)
    pub fn is_stale(&self, max_age_days: i64) -> bool {
        // Guard against invalid input
        if max_age_days <= 0 {
            eprintln!("[HotExit] Warning: max_age_days must be positive (got {})", max_age_days);
            return true; // Treat as stale to be safe
        }

        let now = chrono::Utc::now().timestamp();
        let age_seconds = now - self.timestamp;

        // Treat future timestamps as stale (clock skew)
        if age_seconds < 0 {
            eprintln!("[HotExit] Warning: Session timestamp is in the future (clock skew)");
            return true;
        }

        // Use checked_mul to prevent overflow
        match max_age_days.checked_mul(SECONDS_PER_DAY) {
            Some(max_age_seconds) => age_seconds > max_age_seconds,
            None => {
                eprintln!("[HotExit] Warning: max_age_days overflow ({})", max_age_days);
                true // Treat as stale on overflow
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_VERSION: &str = "0.3.18";

    #[test]
    fn test_session_serialization() {
        let session = SessionData::new(TEST_VERSION.to_string());
        let json = serde_json::to_string(&session).unwrap();
        let deserialized: SessionData = serde_json::from_str(&json).unwrap();
        assert_eq!(session.version, deserialized.version);
        assert_eq!(session.vmark_version, deserialized.vmark_version);
    }

    #[test]
    fn test_session_compatibility() {
        let session = SessionData::new(TEST_VERSION.to_string());
        assert!(session.is_compatible());

        // Create new incompatible session instead of cloning
        let mut old_session = SessionData::new(TEST_VERSION.to_string());
        old_session.version = 0;
        assert!(!old_session.is_compatible());
    }

    #[test]
    fn test_stale_session() {
        let mut session = SessionData::new(TEST_VERSION.to_string());
        let now = chrono::Utc::now().timestamp();

        // 8 days old - should be stale
        session.timestamp = now - (8 * SECONDS_PER_DAY);
        assert!(session.is_stale(MAX_SESSION_AGE_DAYS));

        // 6 days old - should not be stale
        session.timestamp = now - (6 * SECONDS_PER_DAY);
        assert!(!session.is_stale(MAX_SESSION_AGE_DAYS));

        // Future timestamp - should be stale (clock skew)
        session.timestamp = now + SECONDS_PER_DAY;
        assert!(session.is_stale(MAX_SESSION_AGE_DAYS));

        // Invalid max_age_days - should be stale
        session.timestamp = now - SECONDS_PER_DAY;
        assert!(session.is_stale(0));
        assert!(session.is_stale(-1));
    }
}
