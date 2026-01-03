use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Workspace configuration stored in .vmark file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub version: u32,
    #[serde(rename = "excludeFolders")]
    pub exclude_folders: Vec<String>,
    #[serde(rename = "lastOpenTabs")]
    pub last_open_tabs: Vec<String>,
    #[serde(default)]
    pub ai: Option<serde_json::Value>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            version: 1,
            exclude_folders: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".vmark".to_string(),
            ],
            last_open_tabs: vec![],
            ai: None,
        }
    }
}

/// Open folder dialog and return selected path
#[tauri::command]
pub async fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<FilePath>>();

    app.dialog()
        .file()
        .set_title("Open Folder")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Dialog error: {e}")),
    }
}

/// Read workspace config from .vmark file
#[tauri::command]
pub fn read_workspace_config(root_path: &str) -> Result<Option<WorkspaceConfig>, String> {
    let config_path = Path::new(root_path).join(".vmark");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read .vmark: {e}"))?;

    let config: WorkspaceConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse .vmark: {e}"))?;

    Ok(Some(config))
}

/// Write workspace config to .vmark file
#[tauri::command]
pub fn write_workspace_config(root_path: &str, config: WorkspaceConfig) -> Result<(), String> {
    let config_path = Path::new(root_path).join(".vmark");

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write .vmark: {e}"))?;

    Ok(())
}

/// Check if .vmark exists in a directory
#[tauri::command]
pub fn has_workspace_config(root_path: &str) -> bool {
    Path::new(root_path).join(".vmark").exists()
}
