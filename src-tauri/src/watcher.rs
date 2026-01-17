use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Watchers keyed by watch_id (typically window label or unique identifier)
static WATCHERS: Mutex<Option<HashMap<String, WatcherEntry>>> = Mutex::new(None);

struct WatcherEntry {
    /// Stored to keep the watcher alive; dropping stops watching
    _watcher: RecommendedWatcher,
}

/// File system change event with watch context.
/// Includes watchId to scope events to their originating watcher.
#[derive(Clone, Serialize)]
pub struct FsChangeEvent {
    /// Unique identifier for this watcher (window label)
    #[serde(rename = "watchId")]
    pub watch_id: String,
    /// Root path being watched
    #[serde(rename = "rootPath")]
    pub root_path: String,
    /// Changed paths (may be multiple for batch operations)
    pub paths: Vec<String>,
    /// Event kind: "create", "modify", "remove", "rename"
    pub kind: String,
}

/// Map notify event kinds to simple string identifiers.
/// Returns None for events we don't care about (Access, Other, Any).
fn event_kind_to_string(kind: &notify::EventKind) -> Option<&'static str> {
    use notify::EventKind::*;
    match kind {
        Create(_) => Some("create"),
        Modify(_) => Some("modify"),
        Remove(_) => Some("remove"),
        // Rename events come as pairs - handle as special case
        _ => None,
    }
}

/// Handle a notify event and emit it to the frontend.
fn handle_event(app: &AppHandle, watch_id: &str, root_path: &str, event: Event) {
    let Some(kind_str) = event_kind_to_string(&event.kind) else {
        return;
    };

    // Collect all paths from the event
    let paths: Vec<String> = event
        .paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    if paths.is_empty() {
        return;
    }

    let payload = FsChangeEvent {
        watch_id: watch_id.to_string(),
        root_path: root_path.to_string(),
        paths,
        kind: kind_str.to_string(),
    };

    let _ = app.emit("fs:changed", payload);
}

/// Start watching a directory.
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `watch_id` - Unique identifier for this watcher (typically window label)
/// * `path` - Directory path to watch recursively
#[tauri::command]
pub fn start_watching(app: AppHandle, watch_id: String, path: String) -> Result<(), String> {
    let watch_path = Path::new(&path);
    if !watch_path.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // Stop any existing watcher for this watch_id first
    stop_watching(watch_id.clone())?;

    let app_handle = app.clone();
    let watch_id_clone = watch_id.clone();
    let root_path_clone = path.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                handle_event(&app_handle, &watch_id_clone, &root_path_clone, event);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    watcher
        .watch(watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {e}"))?;

    let mut guard = WATCHERS.lock().map_err(|e| format!("Lock error: {e}"))?;
    let watchers = guard.get_or_insert_with(HashMap::new);
    watchers.insert(watch_id, WatcherEntry { _watcher: watcher });

    Ok(())
}

/// Stop watching for a specific watch_id.
#[tauri::command]
pub fn stop_watching(watch_id: String) -> Result<(), String> {
    let mut guard = WATCHERS.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(watchers) = guard.as_mut() {
        watchers.remove(&watch_id);
    }
    Ok(())
}

/// Stop all watchers.
#[tauri::command]
pub fn stop_all_watchers() -> Result<(), String> {
    let mut guard = WATCHERS.lock().map_err(|e| format!("Lock error: {e}"))?;
    *guard = None;
    Ok(())
}

/// Get list of active watcher IDs.
#[tauri::command]
pub fn list_watchers() -> Result<Vec<String>, String> {
    let guard = WATCHERS.lock().map_err(|e| format!("Lock error: {e}"))?;
    Ok(guard
        .as_ref()
        .map(|w| w.keys().cloned().collect())
        .unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::EventKind;

    #[test]
    fn test_event_kind_create() {
        let kind = EventKind::Create(notify::event::CreateKind::File);
        assert_eq!(event_kind_to_string(&kind), Some("create"));
    }

    #[test]
    fn test_event_kind_modify() {
        let kind = EventKind::Modify(notify::event::ModifyKind::Data(
            notify::event::DataChange::Content,
        ));
        assert_eq!(event_kind_to_string(&kind), Some("modify"));
    }

    #[test]
    fn test_event_kind_remove() {
        let kind = EventKind::Remove(notify::event::RemoveKind::File);
        assert_eq!(event_kind_to_string(&kind), Some("remove"));
    }

    #[test]
    fn test_event_kind_access_ignored() {
        let kind = EventKind::Access(notify::event::AccessKind::Read);
        assert_eq!(event_kind_to_string(&kind), None);
    }

    #[test]
    fn test_event_kind_other_ignored() {
        let kind = EventKind::Other;
        assert_eq!(event_kind_to_string(&kind), None);
    }

    #[test]
    fn test_fs_change_event_serialization() {
        let event = FsChangeEvent {
            watch_id: "main".to_string(),
            root_path: "/Users/test".to_string(),
            paths: vec!["/Users/test/file.md".to_string()],
            kind: "modify".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"watchId\":\"main\""));
        assert!(json.contains("\"rootPath\":\"/Users/test\""));
        assert!(json.contains("\"kind\":\"modify\""));
    }
}
