//! AI Genies — file reader and default genie installer
//!
//! Scans global (`<appDataDir>/genies/`) and workspace (`.vmark/genies/`)
//! directories for markdown prompt files. Workspace genies override global
//! ones on name collision in the store (menu shows both independently).

use serde::Serialize;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle, Manager};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Clone)]
pub struct PromptEntry {
    pub name: String,
    pub path: String,
    pub source: String, // "global" | "workspace"
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PromptContent {
    pub metadata: PromptMetadata,
    pub template: String,
}

#[derive(Debug, Serialize)]
pub struct PromptMetadata {
    pub name: String,
    pub description: String,
    pub scope: String,
    pub category: Option<String>,
    pub icon: Option<String>,
    pub model: Option<String>,
}

// ============================================================================
// Commands
// ============================================================================

/// Return the global genies directory path.
#[command]
pub fn get_genies_dir(app: AppHandle) -> Result<String, String> {
    let dir = global_prompts_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

/// List all available prompts from global + workspace directories.
/// Workspace prompts override global on name collision.
#[command]
pub fn list_prompts(
    app: AppHandle,
    workspace_root: Option<String>,
) -> Result<Vec<PromptEntry>, String> {
    let mut by_name: HashMap<String, PromptEntry> = HashMap::new();

    // 1. Scan global prompts
    let global_dir = global_prompts_dir(&app)?;
    if global_dir.is_dir() {
        scan_prompts_dir(&global_dir, &global_dir, "global", &mut by_name);
    }

    // 2. Scan workspace prompts (overrides global)
    if let Some(root) = workspace_root {
        let ws_dir = Path::new(&root).join(".vmark").join("genies");
        if ws_dir.is_dir() {
            scan_prompts_dir(&ws_dir, &ws_dir, "workspace", &mut by_name);
        }
    }

    let mut entries: Vec<PromptEntry> = by_name.into_values().collect();
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

/// Read a single prompt file — parse frontmatter and return metadata + template.
/// Validates the path is within allowed prompt directories to prevent traversal.
#[command]
pub fn read_prompt(
    app: AppHandle,
    path: String,
    workspace_root: Option<String>,
) -> Result<PromptContent, String> {
    // Canonicalize requested path
    let requested = fs::canonicalize(&path)
        .map_err(|e| format!("Invalid prompt path {}: {}", path, e))?;

    // Build allowed roots
    let global_dir = fs::canonicalize(global_prompts_dir(&app)?)
        .unwrap_or_else(|_| global_prompts_dir(&app).unwrap_or_default());

    let mut allowed = false;
    if requested.starts_with(&global_dir) {
        allowed = true;
    }

    if let Some(root) = &workspace_root {
        let ws_dir = Path::new(root).join(".vmark").join("genies");
        if let Ok(ws_canonical) = fs::canonicalize(&ws_dir) {
            if requested.starts_with(&ws_canonical) {
                allowed = true;
            }
        }
    }

    if !allowed {
        return Err("Prompt path is outside allowed directories".to_string());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read prompt file {}: {}", path, e))?;

    parse_prompt(&content, &path)
}

// ============================================================================
// Scanning
// ============================================================================

pub fn global_prompts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("genies"))
}

/// Recursively scan a directory for `.md` files. Subdirectory names become categories.
fn scan_prompts_dir(
    dir: &Path,
    base: &Path,
    source: &str,
    entries: &mut HashMap<String, PromptEntry>,
) {
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        // Skip symlinks for safety
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_symlink() {
            continue;
        }

        let path = entry.path();
        if ft.is_dir() {
            scan_prompts_dir(&path, base, source, entries);
        } else if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("md")) {
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Category from subdirectory relative to base
            let category = path
                .parent()
                .and_then(|p| p.strip_prefix(base).ok())
                .filter(|rel| !rel.as_os_str().is_empty())
                .map(|rel| rel.to_string_lossy().to_string());

            entries.insert(
                name.clone(),
                PromptEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    source: source.to_string(),
                    category,
                },
            );
        }
    }
}

// ============================================================================
// Menu scanning — returns entries with resolved titles from frontmatter
// ============================================================================

pub struct GenieMenuEntry {
    pub title: String,
    pub path: String,
    pub category: Option<String>,
}

/// Scan a directory and return prompt entries with titles resolved from frontmatter.
pub fn scan_genies_with_titles(dir: &Path) -> Vec<GenieMenuEntry> {
    let mut entries = Vec::new();
    scan_genies_recursive(dir, dir, &mut entries);
    entries.sort_by(|a, b| a.title.cmp(&b.title));
    entries
}

fn scan_genies_recursive(dir: &Path, base: &Path, entries: &mut Vec<GenieMenuEntry>) {
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_symlink() {
            continue;
        }

        let path = entry.path();
        if ft.is_dir() {
            scan_genies_recursive(&path, base, entries);
        } else if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("md")) {
            let filename_stem = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let title = match fs::read_to_string(&path) {
                Ok(content) => extract_frontmatter_name(&content).unwrap_or(filename_stem),
                Err(_) => filename_stem,
            };

            let category = path
                .parent()
                .and_then(|p| p.strip_prefix(base).ok())
                .filter(|rel| !rel.as_os_str().is_empty())
                .map(|rel| rel.to_string_lossy().to_string());

            entries.push(GenieMenuEntry {
                title,
                path: path.to_string_lossy().to_string(),
                category,
            });
        }
    }
}

/// Extract the `name:` value from YAML frontmatter without a full parse.
fn extract_frontmatter_name(content: &str) -> Option<String> {
    let content = content.trim_start_matches('\u{FEFF}');
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let after_first = &trimmed[3..];
    let closing = after_first.find("\n---")?;
    let frontmatter = &after_first[..closing];

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some((key, value)) = line.split_once(':') {
            if key.trim().eq_ignore_ascii_case("name") {
                let name = value.trim().to_string();
                if !name.is_empty() {
                    return Some(name);
                }
            }
        }
    }
    None
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

fn parse_prompt(content: &str, path: &str) -> Result<PromptContent, String> {
    // Strip UTF-8 BOM if present
    let content = content.trim_start_matches('\u{FEFF}');
    let trimmed = content.trim_start();

    if !trimmed.starts_with("---") {
        // No frontmatter — use filename as name
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        return Ok(PromptContent {
            metadata: PromptMetadata {
                name,
                description: String::new(),
                scope: "selection".to_string(),
                category: None,
                icon: None,
                model: None,
            },
            template: content.to_string(),
        });
    }

    // Find closing ---
    let after_first = &trimmed[3..];
    let closing = after_first
        .find("\n---")
        .ok_or_else(|| format!("No closing --- in frontmatter: {}", path))?;

    let frontmatter_block = &after_first[..closing];
    let template = after_first[closing + 4..].trim_start().to_string();

    // Parse key: value lines
    let mut fields: HashMap<String, String> = HashMap::new();
    for line in frontmatter_block.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((key, value)) = line.split_once(':') {
            fields.insert(
                key.trim().to_lowercase(),
                value.trim().to_string(),
            );
        }
    }

    let name = fields
        .get("name")
        .cloned()
        .unwrap_or_else(|| {
            Path::new(path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });

    Ok(PromptContent {
        metadata: PromptMetadata {
            name,
            description: fields.get("description").cloned().unwrap_or_default(),
            scope: fields
                .get("scope")
                .cloned()
                .unwrap_or_else(|| "selection".to_string()),
            category: fields.get("category").cloned(),
            icon: fields.get("icon").cloned(),
            model: fields.get("model").cloned(),
        },
        template,
    })
}

// ============================================================================
// Default Prompts Installer
// ============================================================================

struct DefaultPrompt {
    path: &'static str,
    content: &'static str,
}

const DEFAULT_PROMPTS: &[DefaultPrompt] = &[
    DefaultPrompt {
        path: "writing/improve-writing.md",
        content: include_str!("../resources/prompts/writing/improve-writing.md"),
    },
    DefaultPrompt {
        path: "writing/shorten-text.md",
        content: include_str!("../resources/prompts/writing/shorten-text.md"),
    },
    DefaultPrompt {
        path: "writing/fix-grammar.md",
        content: include_str!("../resources/prompts/writing/fix-grammar.md"),
    },
    DefaultPrompt {
        path: "writing/change-tone.md",
        content: include_str!("../resources/prompts/writing/change-tone.md"),
    },
    DefaultPrompt {
        path: "coding/explain-code.md",
        content: include_str!("../resources/prompts/coding/explain-code.md"),
    },
    DefaultPrompt {
        path: "coding/add-comments.md",
        content: include_str!("../resources/prompts/coding/add-comments.md"),
    },
    DefaultPrompt {
        path: "general/summarize.md",
        content: include_str!("../resources/prompts/general/summarize.md"),
    },
    DefaultPrompt {
        path: "general/translate.md",
        content: include_str!("../resources/prompts/general/translate.md"),
    },
];

/// Install default genies into `<appDataDir>/genies/` if they don't already exist.
pub fn install_default_prompts(app: &AppHandle) -> Result<(), String> {
    let base = global_prompts_dir(app)?;

    for prompt in DEFAULT_PROMPTS {
        let target = base.join(prompt.path);

        // Create parent directories
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create dir {:?}: {}", parent, e))?;
        }

        // Atomic create — skip if file already exists (no TOCTOU race)
        match OpenOptions::new().write(true).create_new(true).open(&target) {
            Ok(mut file) => {
                file.write_all(prompt.content.as_bytes())
                    .map_err(|e| format!("Failed to write {:?}: {}", target, e))?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                continue;
            }
            Err(e) => {
                return Err(format!("Failed to create {:?}: {}", target, e));
            }
        }
    }

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_prompt_with_frontmatter() {
        let content = r#"---
name: improve-writing
description: Improve clarity and flow
scope: selection
category: writing
icon: sparkles
---

You are an expert editor. Improve the following text:

{{content}}"#;

        let result = parse_prompt(content, "improve-writing.md").unwrap();
        assert_eq!(result.metadata.name, "improve-writing");
        assert_eq!(result.metadata.description, "Improve clarity and flow");
        assert_eq!(result.metadata.scope, "selection");
        assert_eq!(result.metadata.category.as_deref(), Some("writing"));
        assert_eq!(result.metadata.icon.as_deref(), Some("sparkles"));
        assert!(result.template.contains("{{content}}"));
    }

    #[test]
    fn test_parse_prompt_without_frontmatter() {
        let content = "Just a plain prompt template\n\n{{content}}";
        let result = parse_prompt(content, "test-prompt.md").unwrap();
        assert_eq!(result.metadata.name, "test-prompt");
        assert_eq!(result.metadata.scope, "selection");
        assert!(result.template.contains("{{content}}"));
    }

    #[test]
    fn test_parse_prompt_with_bom() {
        let content = "\u{FEFF}---\nname: bom-test\ndescription: Has BOM\nscope: document\n---\n\nTemplate here";
        let result = parse_prompt(content, "bom-test.md").unwrap();
        assert_eq!(result.metadata.name, "bom-test");
        assert_eq!(result.metadata.scope, "document");
    }

    #[test]
    fn test_parse_prompt_missing_closing() {
        let content = "---\nname: broken\nno closing fence";
        let result = parse_prompt(content, "broken.md");
        assert!(result.is_err());
    }
}
