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

fn check_command(cmd: &str) -> (bool, Option<String>) {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    match Command::new(which_cmd).arg(cmd).output() {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(path))
        }
        _ => (false, None),
    }
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
    provider: String,
    prompt: String,
    model: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<(), String> {
    match provider.as_str() {
        // CLI providers
        "claude" => run_cli_provider(&window, "claude", &["--print", "--output-format", "text"], &prompt),
        "codex" => run_cli_provider(&window, "codex", &[], &prompt),
        "gemini" => run_cli_provider(&window, "gemini", &[], &prompt),
        "ollama" => {
            let m = model.as_deref().unwrap_or("llama3.2");
            run_cli_provider(&window, "ollama", &["run", m], &prompt)
        }

        // REST providers
        "anthropic" => {
            run_rest_anthropic(
                &window,
                &endpoint.unwrap_or_else(|| "https://api.anthropic.com".to_string()),
                &api_key.unwrap_or_default(),
                &model.unwrap_or_else(|| "claude-sonnet-4-5-20250929".to_string()),
                &prompt,
            )
            .await
        }
        "openai" => {
            run_rest_openai(
                &window,
                &endpoint.unwrap_or_else(|| "https://api.openai.com".to_string()),
                &api_key.unwrap_or_default(),
                &model.unwrap_or_else(|| "gpt-4o".to_string()),
                &prompt,
            )
            .await
        }
        "google-ai" => {
            run_rest_google(
                &window,
                &api_key.unwrap_or_default(),
                &model.unwrap_or_else(|| "gemini-2.0-flash".to_string()),
                &prompt,
            )
            .await
        }
        "ollama-api" => {
            run_rest_ollama(
                &window,
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

fn run_cli_provider(
    window: &WebviewWindow,
    cmd: &str,
    args: &[&str],
    prompt: &str,
) -> Result<(), String> {
    let mut child = Command::new(cmd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", cmd, e))?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        // stdin is dropped here, closing it
    }

    // Stream stdout line by line
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let _ = window.emit(
                        "ai:response",
                        AiResponseChunk {
                            chunk: text + "\n",
                            done: false,
                            error: None,
                        },
                    );
                }
                Err(e) => {
                    let _ = window.emit(
                        "ai:response",
                        AiResponseChunk {
                            chunk: String::new(),
                            done: true,
                            error: Some(format!("Read error: {}", e)),
                        },
                    );
                    return Ok(());
                }
            }
        }
    }

    // Check exit status
    let status = child.wait().map_err(|e| format!("Wait failed: {}", e))?;
    if !status.success() {
        // Read stderr for error message
        let _ = window.emit(
            "ai:response",
            AiResponseChunk {
                chunk: String::new(),
                done: true,
                error: Some(format!("{} exited with status {}", cmd, status)),
            },
        );
    } else {
        let _ = window.emit(
            "ai:response",
            AiResponseChunk {
                chunk: String::new(),
                done: true,
                error: None,
            },
        );
    }

    Ok(())
}

// ============================================================================
// REST Execution (reqwest)
// ============================================================================

async fn run_rest_anthropic(
    window: &WebviewWindow,
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
        emit_error(window, &format!("Anthropic API error {}: {}", status, text));
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
                let _ = window.emit(
                    "ai:response",
                    AiResponseChunk {
                        chunk: text.to_string(),
                        done: false,
                        error: None,
                    },
                );
            }
        }
    }

    emit_done(window);
    Ok(())
}

async fn run_rest_openai(
    window: &WebviewWindow,
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
        emit_error(window, &format!("OpenAI API error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
        if let Some(text) = choices
            .first()
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|t| t.as_str())
        {
            let _ = window.emit(
                "ai:response",
                AiResponseChunk {
                    chunk: text.to_string(),
                    done: false,
                    error: None,
                },
            );
        }
    }

    emit_done(window);
    Ok(())
}

async fn run_rest_google(
    window: &WebviewWindow,
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
        emit_error(window, &format!("Google AI error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(candidates) = json.get("candidates").and_then(|c| c.as_array()) {
        if let Some(text) = candidates
            .first()
            .and_then(|c| c.get("content"))
            .and_then(|c| c.get("parts"))
            .and_then(|p| p.as_array())
            .and_then(|parts| parts.first())
            .and_then(|p| p.get("text"))
            .and_then(|t| t.as_str())
        {
            let _ = window.emit(
                "ai:response",
                AiResponseChunk {
                    chunk: text.to_string(),
                    done: false,
                    error: None,
                },
            );
        }
    }

    emit_done(window);
    Ok(())
}

async fn run_rest_ollama(
    window: &WebviewWindow,
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
        emit_error(window, &format!("Ollama API error {}: {}", status, text));
        return Ok(());
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(text) = json.get("response").and_then(|r| r.as_str()) {
        let _ = window.emit(
            "ai:response",
            AiResponseChunk {
                chunk: text.to_string(),
                done: false,
                error: None,
            },
        );
    }

    emit_done(window);
    Ok(())
}

// ============================================================================
// Helpers
// ============================================================================

fn emit_done(window: &WebviewWindow) {
    let _ = window.emit(
        "ai:response",
        AiResponseChunk {
            chunk: String::new(),
            done: true,
            error: None,
        },
    );
}

fn emit_error(window: &WebviewWindow, msg: &str) {
    let _ = window.emit(
        "ai:response",
        AiResponseChunk {
            chunk: String::new(),
            done: true,
            error: Some(msg.to_string()),
        },
    );
}
