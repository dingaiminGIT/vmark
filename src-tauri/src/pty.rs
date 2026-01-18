use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

/// PTY session information
#[derive(Clone, Serialize)]
pub struct PtySession {
    pub id: String,
    pub cols: u16,
    pub rows: u16,
}

/// Message sent when PTY outputs data
#[derive(Clone, Serialize)]
struct PtyOutput {
    #[serde(rename = "sessionId")]
    session_id: String,
    data: String,
}

/// Message sent when PTY exits
#[derive(Clone, Serialize)]
struct PtyExit {
    #[serde(rename = "sessionId")]
    session_id: String,
    code: Option<i32>,
}

/// Internal session state
struct InternalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    _kill_tx: mpsc::Sender<()>,
}

/// Global PTY manager state
struct PtyManager {
    sessions: HashMap<String, InternalSession>,
}

impl PtyManager {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

/// Tauri state wrapper
pub struct PtyState(Mutex<PtyManager>);

impl PtyState {
    pub fn new() -> Self {
        Self(Mutex::new(PtyManager::new()))
    }
}

impl Default for PtyState {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve shell type to executable path
fn resolve_shell(shell_type: Option<&str>) -> String {
    match shell_type {
        Some("bash") => "/bin/bash".to_string(),
        Some("zsh") => "/bin/zsh".to_string(),
        Some("fish") => {
            // Fish is often installed via Homebrew
            if std::path::Path::new("/opt/homebrew/bin/fish").exists() {
                "/opt/homebrew/bin/fish".to_string()
            } else if std::path::Path::new("/usr/local/bin/fish").exists() {
                "/usr/local/bin/fish".to_string()
            } else {
                "/usr/bin/fish".to_string()
            }
        }
        Some("powershell") => {
            // PowerShell on macOS
            if std::path::Path::new("/usr/local/bin/pwsh").exists() {
                "/usr/local/bin/pwsh".to_string()
            } else {
                "pwsh".to_string()
            }
        }
        // "system" or None - use SHELL env var
        _ => std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string()),
    }
}

/// Spawn a new PTY session
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    state: tauri::State<'_, PtyState>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    shell: Option<String>,
) -> Result<PtySession, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    // Get the PTY system
    let pty_system = native_pty_system();

    // Create PTY pair
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Build shell command - resolve shell type to path
    let shell_path = resolve_shell(shell.as_deref());
    let mut cmd = CommandBuilder::new(&shell_path);

    // Add login shell flag (not for PowerShell)
    if !shell_path.contains("pwsh") {
        cmd.arg("-l");
    }

    // Set TERM for proper terminal emulation
    cmd.env("TERM", "xterm-256color");

    // Set working directory
    if let Some(ref dir) = cwd {
        cmd.cwd(dir);
    }

    // Spawn the child process
    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get reader and writer from master
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Create kill channel
    let (kill_tx, mut kill_rx) = mpsc::channel::<()>(1);

    // Store session with master for resize support
    {
        let mut manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        manager.sessions.insert(
            session_id.clone(),
            InternalSession {
                writer,
                master: pair.master,
                _kill_tx: kill_tx,
            },
        );
    }

    // Spawn reader task
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            // Check for kill signal (non-blocking)
            if kill_rx.try_recv().is_ok() {
                break;
            }

            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    // Convert to string, handling invalid UTF-8 gracefully
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "pty:output",
                        PtyOutput {
                            session_id: session_id_clone.clone(),
                            data,
                        },
                    );
                }
                Err(e) => {
                    eprintln!("[PTY] Read error: {}", e);
                    break;
                }
            }
        }

        // Wait for child to exit and get exit code
        // portable_pty::ExitStatus only has success() method
        let exit_code = child.wait().ok().map(|status| {
            if status.success() { 0 } else { 1 }
        });

        let _ = app_clone.emit(
            "pty:exit",
            PtyExit {
                session_id: session_id_clone,
                code: exit_code,
            },
        );
    });

    Ok(PtySession {
        id: session_id,
        cols,
        rows,
    })
}

/// Write data to a PTY session
#[tauri::command]
pub fn pty_write(
    state: tauri::State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let session = manager
        .sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write error: {}", e))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Flush error: {}", e))?;

    Ok(())
}

/// Resize a PTY session
#[tauri::command]
pub fn pty_resize(
    state: tauri::State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let session = manager
        .sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize error: {}", e))?;

    #[cfg(debug_assertions)]
    eprintln!("[PTY] Resized {}: {}x{}", session_id, cols, rows);

    Ok(())
}

/// Kill a PTY session
#[tauri::command]
pub fn pty_kill(state: tauri::State<'_, PtyState>, session_id: String) -> Result<(), String> {
    let mut manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    if manager.sessions.remove(&session_id).is_some() {
        #[cfg(debug_assertions)]
        eprintln!("[PTY] Session killed: {}", session_id);
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// List active PTY sessions
#[tauri::command]
pub fn pty_list(state: tauri::State<'_, PtyState>) -> Result<Vec<String>, String> {
    let manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.sessions.keys().cloned().collect())
}
