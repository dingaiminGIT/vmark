/// Session data structures for hot exit
///
/// These structs mirror the TypeScript types in src/utils/hotExit/types.ts

use serde::{Deserialize, Serialize};

/// Schema version for hot exit sessions
pub const SCHEMA_VERSION: u32 = 1;

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
    pub from: u32,
    pub to: u32,
    pub node_type: String,
    pub heading_level: Option<u8>,
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
    /// Create empty session with current version
    pub fn new(vmark_version: String) -> Self {
        Self {
            version: SCHEMA_VERSION,
            timestamp: chrono::Utc::now().timestamp(),
            vmark_version,
            windows: Vec::new(),
            workspace: None,
        }
    }

    /// Validate session schema version
    pub fn is_compatible(&self) -> bool {
        self.version == SCHEMA_VERSION
    }

    /// Check if session is stale (older than max_age_days)
    pub fn is_stale(&self, max_age_days: i64) -> bool {
        let now = chrono::Utc::now().timestamp();
        let age_seconds = now - self.timestamp;
        let max_age_seconds = max_age_days * 24 * 60 * 60;
        age_seconds > max_age_seconds
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_serialization() {
        let session = SessionData::new("0.3.18".to_string());
        let json = serde_json::to_string(&session).unwrap();
        let deserialized: SessionData = serde_json::from_str(&json).unwrap();
        assert_eq!(session.version, deserialized.version);
        assert_eq!(session.vmark_version, deserialized.vmark_version);
    }

    #[test]
    fn test_session_compatibility() {
        let session = SessionData::new("0.3.18".to_string());
        assert!(session.is_compatible());

        let mut old_session = session.clone();
        old_session.version = 0;
        assert!(!old_session.is_compatible());
    }

    #[test]
    fn test_stale_session() {
        let mut session = SessionData::new("0.3.18".to_string());

        // 8 days old - should be stale
        session.timestamp = chrono::Utc::now().timestamp() - (8 * 24 * 60 * 60);
        assert!(session.is_stale(7));

        // 6 days old - should not be stale
        session.timestamp = chrono::Utc::now().timestamp() - (6 * 24 * 60 * 60);
        assert!(!session.is_stale(7));
    }
}
