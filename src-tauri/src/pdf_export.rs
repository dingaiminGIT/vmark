//! PDF Export via WeasyPrint
//!
//! This module provides PDF generation using WeasyPrint CLI.
//! WeasyPrint must be installed on the system (`pip install weasyprint`).
//!
//! Cross-platform: uses `login_shell_path()` to find pip-installed tools
//! and `build_command()` to handle Windows `.cmd` shims.

use std::path::PathBuf;
use tauri::command;

use crate::ai_provider::{build_command, login_shell_path};

/// Check if WeasyPrint is available on the system.
#[command]
pub fn check_weasyprint() -> Result<bool, String> {
    let output = build_command("weasyprint", &["--version"])
        .env("PATH", login_shell_path())
        .output();

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// Get WeasyPrint version string.
#[command]
pub fn get_weasyprint_version() -> Result<String, String> {
    let output = build_command("weasyprint", &["--version"])
        .env("PATH", login_shell_path())
        .output()
        .map_err(|e| format!("Failed to run weasyprint: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(version)
    } else {
        Err("WeasyPrint not found".to_string())
    }
}

/// Convert HTML file to PDF using WeasyPrint.
///
/// # Arguments
/// * `html_path` - Path to the source HTML file
/// * `pdf_path` - Path for the output PDF file
///
/// # Returns
/// Result with success message or error details
#[command]
pub fn convert_html_to_pdf(html_path: String, pdf_path: String) -> Result<String, String> {
    let html = PathBuf::from(&html_path);
    let pdf = PathBuf::from(&pdf_path);

    // Validate HTML file exists
    if !html.exists() {
        return Err(format!("HTML file not found: {}", html_path));
    }

    // Ensure parent directory exists for PDF
    if let Some(parent) = pdf.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }

    // Run WeasyPrint (uses login shell PATH + .cmd handling for Windows)
    let output = build_command("weasyprint", &[&html_path, &pdf_path])
        .env("PATH", login_shell_path())
        .output()
        .map_err(|e| format!("Failed to execute weasyprint: {}", e))?;

    if output.status.success() {
        Ok(pdf_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("WeasyPrint failed: {}", stderr))
    }
}

/// Convert HTML string to PDF using WeasyPrint.
///
/// Creates a temporary HTML file, converts it, and cleans up.
///
/// # Arguments
/// * `html_content` - HTML content as string
/// * `pdf_path` - Path for the output PDF file
///
/// # Returns
/// Result with success message or error details
#[command]
pub fn convert_html_string_to_pdf(html_content: String, pdf_path: String) -> Result<String, String> {
    use std::io::Write;

    // Create a temporary file for the HTML
    let temp_dir = std::env::temp_dir();
    let temp_html = temp_dir.join(format!("vmark_export_{}.html", std::process::id()));

    // Write HTML to temp file
    let mut file = std::fs::File::create(&temp_html)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(html_content.as_bytes())
        .map_err(|e| format!("Failed to write HTML: {}", e))?;

    // Convert to PDF
    let result = convert_html_to_pdf(
        temp_html.to_string_lossy().to_string(),
        pdf_path,
    );

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_html);

    result
}
