//! AI Provider Router
//!
//! Detects available CLI AI providers and executes prompts via shell commands
//! or REST APIs. Streams results back to the frontend via Tauri events.

use serde::Serialize;
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::process::{Command, Stdio};
use tauri::{command, Emitter, WebviewWindow};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CliProviderEntry {
    #[serde(rename = "type")]
    pub provider_type: String,
    pub name: String,
    pub command: String,
    pub available: bool,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AiResponseChunk {
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub chunk: String,
    pub done: bool,
    pub error: Option<String>,
}

// ============================================================================
// CLI Provider Detection
// ============================================================================

/// Detect which CLI AI providers are available on the system.
#[command]
pub fn detect_ai_providers() -> Vec<CliProviderEntry> {
    let providers = [
        ("claude", "Claude", "claude"),
        ("codex", "Codex", "codex"),
        ("gemini", "Gemini", "gemini"),
        ("ollama", "Ollama", "ollama"),
    ];

    providers
        .iter()
        .map(|(typ, name, cmd)| {
            let (available, path) = check_command(cmd);
            CliProviderEntry {
                provider_type: typ.to_string(),
                name: name.to_string(),
                command: cmd.to_string(),
                available,
                path,
            }
        })
        .collect()
}

/// Resolve the user's full login-shell `$PATH`.
///
/// macOS app bundles launched from Finder/Dock inherit a minimal PATH
/// (`/usr/bin:/bin:/usr/sbin:/sbin`).  Instead of guessing install
/// locations, we spawn the user's interactive login shell and ask for
/// its PATH.  Using `-li` ensures both `.zprofile` AND `.zshrc` are
/// sourced, which is needed for tools initialized in `.zshrc` (nvm,
/// fnm, pyenv, etc.).  Markers isolate PATH from shell startup noise.
/// The result is cached for the lifetime of the process.
fn login_shell_path() -> String {
    use std::sync::OnceLock;
    static CACHED: OnceLock<String> = OnceLock::new();

    const START: &str = "__VMARK_PATH_START__";
    const END: &str = "__VMARK_PATH_END__";

    CACHED
        .get_or_init(|| {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            let cmd = format!("echo {START}${{PATH}}{END}");
            let output = Command::new(&shell)
                .args(["-lic", &cmd])
                .output()
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).to_string());

            if let Some(raw) = output {
                if let Some(start) = raw.find(START) {
                    if let Some(end) = raw.find(END) {
                        let path = &raw[start + START.len()..end];
                        return path.trim().to_string();
                    }
                }
            }
            std::env::var("PATH").unwrap_or_default()
        })
        .clone()
}

fn check_command(cmd: &str) -> (bool, Option<String>) {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    match Command::new(which_cmd)
        .arg(cmd)
        .env("PATH", login_shell_path())
        .output()
    {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(path))
        }
        _ => (false, None),
    }
}

// ============================================================================
// Environment API Keys
// ============================================================================

/// Read well-known API key environment variables for REST providers.
///
/// Returns a map of `RestProviderType → key` for any env var that is set
/// and non-empty. The frontend uses this to pre-fill empty API key fields.
#[command]
pub fn read_env_api_keys() -> std::collections::HashMap<String, String> {
    let mapping: &[(&str, &[&str])] = &[
        ("anthropic", &["ANTHROPIC_API_KEY"]),
        ("openai", &["OPENAI_API_KEY"]),
        ("google-ai", &["GOOGLE_API_KEY", "GEMINI_API_KEY"]),
    ];

    let mut result = std::collections::HashMap::new();
    for (provider, vars) in mapping {
        for var in *vars {
            if let Ok(val) = std::env::var(var) {
                if !val.is_empty() {
                    result.insert(provider.to_string(), val);
                    break; // first match wins
                }
            }
        }
    }
    result
}

// ============================================================================
// Prompt Execution
// ============================================================================

/// Run an AI prompt and stream results back via `ai:response` events.
///
/// For CLI providers: pipes prompt to stdin of the CLI tool.
/// For REST providers: sends HTTP request via reqwest.
#[command]
pub async fn run_ai_prompt(
    window: WebviewWindow,
    request_id: String,
    provider: String,
    prompt: String,
    model: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<(), String> {
    match provider.as_str() {
        // CLI providers
        "claude" => run_cli_provider(&window, &request_id, "claude", &["--print", "--output-format", "text"], Some(&prompt)),
        "codex" => run_cli_provider(&window, &request_id, "codex", &["exec", &prompt], None),
        "gemini" => run_cli_provider(&window, &request_id, "gemini", &["-p", &prompt], None),
        "ollama" => {
            let m = model.as_deref().unwrap_or("llama3.2");
            run_cli_provider(&window, &request_id, "ollama", &["run", m], Some(&prompt))
        }

        // REST providers
        "anthropic" => {
            let Some(key) = require_api_key(&window, &request_id, &api_key, "Anthropic") else {
                return Ok(());
            };
            run_rest_anthropic(
                &window,
                &request_id,
                &endpoint.unwrap_or_else(|| "https://api.anthropic.com".to_string()),
                key,
                &model.unwrap_or_else(|| "claude-sonnet-4-5-20250929".to_string()),
                &prompt,
            )
            .await
        }
        "openai" => {
            let Some(key) = require_api_key(&window, &request_id, &api_key, "OpenAI") else {
                return Ok(());
            };
            run_rest_openai(
                &window,
                &request_id,
                &endpoint.unwrap_or_else(|| "https://api.openai.com".to_string()),
                key,
                &model.unwrap_or_else(|| "gpt-4o".to_string()),
                &prompt,
            )
            .await
        }
        "google-ai" => {
            let Some(key) = require_api_key(&window, &request_id, &api_key, "Google AI") else {
                return Ok(());
            };
            run_rest_google(
                &window,
                &request_id,
                key,
                &model.unwrap_or_else(|| "gemini-2.0-flash".to_string()),
                &prompt,
            )
            .await
        }
        "ollama-api" => {
            run_rest_ollama(
                &window,
                &request_id,
                &endpoint.unwrap_or_else(|| "http://localhost:11434".to_string()),
                &model.unwrap_or_else(|| "llama3.2".to_string()),
                &prompt,
            )
            .await
        }

        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

// ============================================================================
// CLI Execution
// ============================================================================

/// Run a CLI AI provider and stream stdout back as `ai:response` events.
///
/// When `stdin_prompt` is `Some`, the prompt is piped to stdin (for
/// providers like `claude --print` and `ollama run`).  When `None`,
/// the prompt must already be embedded in `args` (for providers like
/// `codex exec` and `gemini -p`).
fn run_cli_provider(
    window: &WebviewWindow,
    request_id: &str,
    cmd: &str,
    args: &[&str],
    stdin_prompt: Option<&str>,
) -> Result<(), String> {
    let stdin_cfg = if stdin_prompt.is_some() { Stdio::piped() } else { Stdio::null() };

    let mut child = Command::new(cmd)
        .args(args)
        .env("PATH", login_shell_path())
        .stdin(stdin_cfg)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", cmd, e))?;

    // Write prompt to stdin when the provider expects it
    if let Some(prompt) = stdin_prompt {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(prompt.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            // stdin is dropped here, closing it
        }
    }

    // Stream stdout line by line
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    emit_chunk(window, request_id, &(text + "\n"));
                }
                Err(e) => {
                    emit_error(window, request_id, &format!("Read error: {}", e));
                    let _ = child.kill();
                    return Ok(());
                }
            }
        }
    }

    // Check exit status — include stderr in error message
    let output = child.wait_with_output().map_err(|e| format!("Wait failed: {}", e))?;
    if !output.status.success() {
        let stderr_text = String::from_utf8_lossy(&output.stderr);
        let stderr_msg = stderr_text.trim();
        let msg = if stderr_msg.is_empty() {
            format!("{} exited with status {}", cmd, output.status)
        } else {
            format!("{} exited with status {}: {}", cmd, output.status, stderr_msg)
        };
        emit_error(window, request_id, &msg);
    } else {
        emit_done(window, request_id);
    }

    Ok(())
}

// ============================================================================
// REST Execution (reqwest)
// ============================================================================

async fn run_rest_anthropic(
    window: &WebviewWindow,
    request_id: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}]
    });

    let resp = client
        .post(format!("{}/v1/messages", endpoint))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        emit_error(window, request_id, &format!("Anthropic API error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract text from content blocks
    if let Some(content) = json.get("content").and_then(|c| c.as_array()) {
        for block in content {
            if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                emit_chunk(window, request_id, text);
            }
        }
    } else {
        emit_error(window, request_id, "No content blocks in Anthropic response");
        return Ok(());
    }

    emit_done(window, request_id);
    Ok(())
}

async fn run_rest_openai(
    window: &WebviewWindow,
    request_id: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}]
    });

    let resp = client
        .post(format!("{}/v1/chat/completions", endpoint))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        emit_error(window, request_id, &format!("OpenAI API error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(text) = json
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|choices| choices.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|t| t.as_str())
    {
        emit_chunk(window, request_id, text);
    } else {
        emit_error(window, request_id, "No choices in OpenAI response");
        return Ok(());
    }

    emit_done(window, request_id);
    Ok(())
}

async fn run_rest_google(
    window: &WebviewWindow,
    request_id: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "contents": [{"parts": [{"text": prompt}]}]
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Google AI request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        emit_error(window, request_id, &format!("Google AI error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(text) = json
        .get("candidates")
        .and_then(|c| c.as_array())
        .and_then(|candidates| candidates.first())
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.as_array())
        .and_then(|parts| parts.first())
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
    {
        emit_chunk(window, request_id, text);
    } else {
        emit_error(window, request_id, "No candidates in Google AI response");
        return Ok(());
    }

    emit_done(window, request_id);
    Ok(())
}

async fn run_rest_ollama(
    window: &WebviewWindow,
    request_id: &str,
    endpoint: &str,
    model: &str,
    prompt: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let resp = client
        .post(format!("{}/api/generate", endpoint))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        emit_error(window, request_id, &format!("Ollama API error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(text) = json.get("response").and_then(|r| r.as_str()) {
        emit_chunk(window, request_id, text);
    } else {
        emit_error(window, request_id, "No response field in Ollama response");
        return Ok(());
    }

    emit_done(window, request_id);
    Ok(())
}

// ============================================================================
// Helpers
// ============================================================================

/// Validate that an API key is present and non-empty.
///
/// Returns `Some(key)` if valid, or emits an error event and returns `None`.
fn require_api_key<'a>(
    window: &WebviewWindow,
    request_id: &str,
    api_key: &'a Option<String>,
    provider_name: &str,
) -> Option<&'a str> {
    match api_key.as_deref() {
        Some(k) if !k.is_empty() => Some(k),
        _ => {
            emit_error(window, request_id, &format!("{} API key is required", provider_name));
            None
        }
    }
}

fn emit_chunk(window: &WebviewWindow, request_id: &str, text: &str) {
    let _ = window.emit(
        "ai:response",
        AiResponseChunk {
            request_id: request_id.to_string(),
            chunk: text.to_string(),
            done: false,
            error: None,
        },
    );
}

fn emit_done(window: &WebviewWindow, request_id: &str) {
    let _ = window.emit(
        "ai:response",
        AiResponseChunk {
            request_id: request_id.to_string(),
            chunk: String::new(),
            done: true,
            error: None,
        },
    );
}

fn emit_error(window: &WebviewWindow, request_id: &str, msg: &str) {
    let _ = window.emit(
        "ai:response",
        AiResponseChunk {
            request_id: request_id.to_string(),
            chunk: String::new(),
            done: true,
            error: Some(msg.to_string()),
        },
    );
}
