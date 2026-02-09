mod ai_provider;
mod app_paths;
mod mcp_bridge;
mod mcp_config;
mod mcp_server;
mod menu;
mod menu_events;
mod pdf_export;
mod genies;
mod quit;
mod watcher;
mod window_manager;
mod workspace;
mod file_tree;
mod hot_exit;

#[cfg(target_os = "macos")]
mod macos_menu;
#[cfg(target_os = "macos")]
mod dock_recent;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Listener, Manager};

/// Pending files queued during cold start before frontend is ready
/// This solves the race condition where Finder opens a file but React hasn't mounted yet
#[derive(Clone, serde::Serialize)]
pub struct PendingFileOpen {
    pub path: String,
    pub workspace_root: Option<String>,
}

static PENDING_FILE_OPENS: Mutex<Vec<PendingFileOpen>> = Mutex::new(Vec::new());

/// Tracks whether frontend has initialized (called get_pending_file_opens)
/// After this, file opens should emit events instead of queueing
static FRONTEND_READY: AtomicBool = AtomicBool::new(false);

/// Get and clear pending file opens - called by frontend when ready
/// Also marks frontend as ready so future file opens emit events
#[tauri::command]
fn get_pending_file_opens() -> Vec<PendingFileOpen> {
    FRONTEND_READY.store(true, Ordering::SeqCst);
    let mut pending = PENDING_FILE_OPENS.lock().unwrap();
    pending.drain(..).collect()
}

/// Debug logging from frontend (logs to terminal, debug builds only)
#[cfg(debug_assertions)]
#[tauri::command]
fn debug_log(message: String) {
    eprintln!("[Frontend] {}", message);
}

/// Print the current webview content using native print dialog
#[tauri::command]
fn print_webview(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Return the user's default shell.
///
/// - macOS/Linux: reads `$SHELL` (fallback: `/bin/sh`)
/// - Windows: uses `powershell.exe` (fallback: `cmd.exe`)
#[tauri::command]
fn get_default_shell() -> String {
    if cfg!(target_os = "windows") {
        // Prefer PowerShell if available, fall back to cmd.exe
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

/// Register a file with macOS Dock recent documents
#[cfg(target_os = "macos")]
#[tauri::command]
fn register_dock_recent(path: String) {
    dock_recent::register_recent_document(&path);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["settings"])
                // Exclude VISIBLE from state restoration to prevent flash.
                // Windows start hidden (visible: false) and are shown only
                // after frontend emits "ready" event in mark_window_ready().
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_pending_file_opens,
            menu::update_recent_files,
            menu::update_recent_workspaces,
            menu::refresh_genies_menu,
            menu::hide_genies_menu,
            menu::rebuild_menu,
            window_manager::new_window,
            window_manager::open_file_in_new_window,
            window_manager::open_workspace_in_new_window,
            window_manager::open_workspace_with_files_in_new_window,
            window_manager::close_window,
            window_manager::force_quit,
            window_manager::request_quit,
            quit::cancel_quit,
            watcher::start_watching,
            watcher::stop_watching,
            watcher::stop_all_watchers,
            watcher::list_watchers,
            file_tree::list_directory_entries,
            workspace::open_folder_dialog,
            workspace::read_workspace_config,
            workspace::write_workspace_config,
            workspace::has_workspace_config,
            mcp_server::mcp_bridge_start,
            mcp_server::mcp_bridge_stop,
            mcp_server::mcp_server_start,
            mcp_server::mcp_server_stop,
            mcp_server::mcp_server_status,
            mcp_server::mcp_sidecar_health,
            mcp_server::mcp_bridge_client_count,
            mcp_server::write_mcp_tool_mode,
            mcp_bridge::mcp_bridge_respond,
            mcp_config::mcp_config_get_status,
            mcp_config::mcp_config_diagnose,
            mcp_config::mcp_config_preview,
            mcp_config::mcp_config_install,
            mcp_config::mcp_config_uninstall,
            hot_exit::commands::hot_exit_capture,
            hot_exit::commands::hot_exit_restore,
            hot_exit::commands::hot_exit_inspect_session,
            hot_exit::commands::hot_exit_clear_session,
            hot_exit::commands::hot_exit_restore_multi_window,
            hot_exit::commands::hot_exit_get_window_state,
            hot_exit::commands::hot_exit_window_restore_complete,
            pdf_export::check_weasyprint,
            pdf_export::get_weasyprint_version,
            pdf_export::convert_html_to_pdf,
            pdf_export::convert_html_string_to_pdf,
            get_default_shell,
            genies::get_genies_dir,
            genies::list_genies,
            genies::read_genie,
            ai_provider::detect_ai_providers,
            ai_provider::run_ai_prompt,
            ai_provider::read_env_api_keys,
            ai_provider::test_api_key,
            ai_provider::list_models,
            ai_provider::validate_model,
            #[cfg(debug_assertions)]
            debug_log,
            print_webview,
            #[cfg(target_os = "macos")]
            register_dock_recent,
        ])
        .setup(|app| {
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;

            // Fix macOS Help/Window menus (workaround for muda bug)
            #[cfg(target_os = "macos")]
            macos_menu::apply_menu_fixes();

            // Write bootstrap file for MCP sidecar discovery
            // This file contains the path to the app data directory
            if let Err(e) = app_paths::write_app_data_path_bootstrap(app.handle()) {
                eprintln!("[Tauri] Warning: Failed to write app-data-path bootstrap: {}", e);
            }

            // Migrate legacy files from ~/.vmark/ to app data directory
            if let Err(e) = app_paths::migrate_legacy_files(app.handle()) {
                eprintln!("[Tauri] Warning: Failed to migrate legacy files: {}", e);
            }

            // Install default AI genies (no-op if already present)
            if let Err(e) = genies::install_default_genies(app.handle()) {
                eprintln!("[Tauri] Warning: Failed to install default genies: {}", e);
            }

            // Windows/Linux: handle files passed as CLI arguments
            // (macOS uses RunEvent::Opened from Finder instead)
            #[cfg(not(target_os = "macos"))]
            {
                let md_extensions = ["md", "markdown", "mdown", "mkd", "mdx"];
                let args: Vec<String> = std::env::args().skip(1).collect();
                let file_args: Vec<String> = args
                    .into_iter()
                    .filter(|arg| {
                        let path = std::path::Path::new(arg);
                        path.exists()
                            && path.is_file()
                            && path
                                .extension()
                                .and_then(|e| e.to_str())
                                .map(|e| md_extensions.contains(&e.to_lowercase().as_str()))
                                .unwrap_or(false)
                    })
                    .collect();

                if !file_args.is_empty() {
                    if let Ok(mut pending) = PENDING_FILE_OPENS.lock() {
                        for path_str in file_args {
                            let workspace_root =
                                window_manager::get_workspace_root_for_file(&path_str);
                            pending.push(PendingFileOpen {
                                path: path_str,
                                workspace_root,
                            });
                        }
                    }
                }
            }

            // Listen for "ready" events from frontend windows
            // This is used by menu_events to know when it's safe to emit events
            // The payload contains the window label as a string
            let app_handle = app.handle().clone();
            app.listen("ready", move |event| {
                // The payload is the window label
                if let Ok(label) = serde_json::from_str::<String>(event.payload()) {
                    #[cfg(debug_assertions)]
                    eprintln!("[Tauri] Window '{}' is ready", label);
                    menu_events::mark_window_ready(&app_handle, &label);
                }
            });

            Ok(())
        })
        .on_menu_event(menu_events::handle_menu_event)
        // CRITICAL: Only intercept close for document windows (main, doc-*)
        // Non-document windows (settings) should close normally
        .on_window_event(|window, event| {
            use tauri::Emitter;
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                #[cfg(debug_assertions)]
                eprintln!("[Tauri] WindowEvent::CloseRequested for window '{}'", label);
                // Only intercept close for document windows
                if label == "main" || label.starts_with("doc-") {
                    api.prevent_close();
                    // Include target label in payload so frontend can filter
                    let _ = window.emit("window:close-requested", label);
                    #[cfg(debug_assertions)]
                    eprintln!("[Tauri] Emitted window:close-requested to '{}'", label);
                }
                // Settings and other non-document windows close normally
            }
        });

    // Tauri MCP bridge plugin for automation/screenshots (dev only)
    // Use port 9324 to avoid conflict with VMark MCP bridge on 9223
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(
            tauri_plugin_mcp_bridge::Builder::new()
                .base_port(9324)
                .build(),
        );
    }

    // CRITICAL: Use .build().run() pattern for app-level event handling
    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                // CRITICAL: Prevent quit on last window close (macOS behavior)
                // App should only quit via Cmd+Q or menu Quit
                tauri::RunEvent::ExitRequested { api, code: _code, .. } => {
                    #[cfg(debug_assertions)]
                    eprintln!("[Tauri] ExitRequested received, code={:?}", _code);

                    // If we explicitly allowed exit (we're done with coordinated quit), allow it through.
                    // IMPORTANT: Quit can be "in progress" while we still need to block OS quit requests.
                    if quit::is_exit_allowed() {
                        #[cfg(debug_assertions)]
                        eprintln!("[Tauri] ExitRequested: exit allowed, allowing exit");
                        return;
                    }

                    // Prevent exit for last-window-close scenario (macOS behavior)
                    api.prevent_exit();
                    #[cfg(debug_assertions)]
                    eprintln!("[Tauri] ExitRequested: prevent_exit() called");

                    // Only start coordinated quit if there are document windows
                    let has_doc_windows = app
                        .webview_windows()
                        .keys()
                        .any(|label| quit::is_document_window_label(label));

                    if has_doc_windows {
                        #[cfg(debug_assertions)]
                        eprintln!("[Tauri] ExitRequested: starting quit flow");
                        quit::start_quit(app);
                    }
                    // If no document windows, just stay alive (macOS dock behavior)
                }
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Destroyed,
                    ..
                } => {
                    quit::handle_window_destroyed(app, &label);
                    menu_events::clear_window_ready(&label);
                }
                // macOS: Clicking dock icon when no windows visible -> create new window
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } => {
                    if !has_visible_windows {
                        let _ = window_manager::create_document_window(app, None, None);
                    }
                }
                // Handle files opened from Finder (double-click, "Open With", etc.)
                // Groups files by workspace root to open them as tabs in a single window
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Opened { urls } => {
                    // Group files by workspace root (None = no workspace / root-level files)
                    // Key: workspace root path (or empty string for no workspace)
                    // Value: list of file paths in that workspace
                    let mut files_by_workspace: HashMap<String, Vec<String>> = HashMap::new();

                    for url in urls {
                        if let Ok(path) = url.to_file_path() {
                            if let Some(path_str) = path.to_str() {
                                // Handle directories: open as workspace (separate window)
                                if path.is_dir() {
                                    let _ = window_manager::create_document_window(
                                        app,
                                        None,
                                        Some(path_str),
                                    );
                                    continue;
                                }

                                // Group files by workspace root
                                let workspace_root =
                                    window_manager::get_workspace_root_for_file(path_str);
                                let key = workspace_root.clone().unwrap_or_default();
                                files_by_workspace
                                    .entry(key)
                                    .or_default()
                                    .push(path_str.to_string());
                            }
                        }
                    }

                    // Process each workspace group
                    for (workspace_key, file_paths) in files_by_workspace {
                        let workspace_root = if workspace_key.is_empty() {
                            None
                        } else {
                            Some(workspace_key.as_str())
                        };

                        if FRONTEND_READY.load(Ordering::SeqCst) {
                            // Frontend is ready - check if we have a window to emit to
                            if let Some(main_window) = app.get_webview_window("main") {
                                // Emit events to main window (one per file)
                                use tauri::Emitter;
                                for path in file_paths {
                                    let payload = PendingFileOpen {
                                        path,
                                        workspace_root: workspace_root.map(String::from),
                                    };
                                    let _ = main_window.emit("app:open-file", payload);
                                }
                            } else {
                                // No main window (reopen scenario) - create ONE window with all files
                                if let Some(root) = workspace_root {
                                    let _ = window_manager::open_workspace_with_files_in_new_window(
                                        app.clone(),
                                        root.to_string(),
                                        file_paths,
                                    );
                                } else {
                                    // No workspace root - open first file, rest will be lost
                                    // (rare edge case: root-level files)
                                    if let Some(first) = file_paths.first() {
                                        let _ = window_manager::create_document_window(
                                            app,
                                            Some(first),
                                            None,
                                        );
                                    }
                                }
                            }
                        } else {
                            // Cold start - queue all files for the main window
                            if let Ok(mut pending) = PENDING_FILE_OPENS.lock() {
                                for path in file_paths {
                                    pending.push(PendingFileOpen {
                                        path,
                                        workspace_root: workspace_root.map(String::from),
                                    });
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        });
}
