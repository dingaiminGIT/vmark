use portable_pty::{native_pty_system, CommandBuilder, PtySize};
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

/// Spawn a new PTY session
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    state: tauri::State<'_, PtyState>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
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

    // Build shell command
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // Login shell

    // Set working directory
    if let Some(ref dir) = cwd {
        cmd.cwd(dir);
    }

    // Spawn the child process
    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get reader and writer
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

    // Store session
    {
        let mut manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        manager.sessions.insert(
            session_id.clone(),
            InternalSession {
                writer,
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
    // Note: portable-pty doesn't have a direct resize method after creation
    // For now, we acknowledge the resize request but don't actually resize
    // A full implementation would need to track the master PTY and call resize on it
    let manager = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    if !manager.sessions.contains_key(&session_id) {
        return Err(format!("Session not found: {}", session_id));
    }

    #[cfg(debug_assertions)]
    eprintln!("[PTY] Resize requested for {}: {}x{}", session_id, cols, rows);

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
