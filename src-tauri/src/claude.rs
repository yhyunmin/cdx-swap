use crate::domain::{ClaudeLoginStart, ClaudeUsageStatus, ClaudeUsageWindow};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const CLAUDE_CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_AUTHORIZE_ENDPOINT: &str = "https://claude.ai/oauth/authorize";
const CLAUDE_TOKEN_ENDPOINT: &str = "https://platform.claude.com/v1/oauth/token";
const CLAUDE_USAGE_ENDPOINT: &str = "https://api.anthropic.com/api/oauth/usage";
const CLAUDE_REDIRECT_URI: &str = "https://platform.claude.com/oauth/code/callback";
const CLAUDE_USAGE_USER_AGENT: &str = "ClaudeUsageBar/0.6 cdx-swap/0.2";
const CLAUDE_SCOPES: [&str; 2] = ["user:profile", "user:inference"];

#[derive(Debug, Clone)]
struct ClaudeCredentials {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: Option<u64>,
    scopes: Vec<String>,
    credential_source: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredClaudeCredentials {
    #[serde(alias = "access_token")]
    access_token: Option<String>,
    #[serde(alias = "refresh_token")]
    refresh_token: Option<String>,
    #[serde(alias = "expires_at")]
    expires_at: Option<Value>,
    scopes: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingClaudeLogin {
    verifier: String,
    state: String,
    auth_url: String,
    created_at: u64,
}

#[derive(Debug, Deserialize)]
struct ClaudeTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<Value>,
    scope: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeRawUsage {
    five_hour: Option<ClaudeUsageWindow>,
    seven_day: Option<ClaudeUsageWindow>,
}

enum ClaudeUsageError {
    Unauthorized,
    Other(String),
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn fetched_at() -> String {
    now_secs().to_string()
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Failed to resolve home directory.".to_string())
}

fn claude_credentials_path() -> Result<PathBuf, String> {
    Ok(home_dir()?
        .join(".config")
        .join("claude-usage-bar")
        .join("credentials.json"))
}

fn claude_pending_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".cdx").join("claude_oauth_pending.json"))
}

fn ensure_parent(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create directory: {error}"))?;
        set_private_dir(parent)?;
    }
    Ok(())
}

#[cfg(unix)]
fn set_private_dir(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("Failed to protect directory: {error}"))
}

#[cfg(not(unix))]
fn set_private_dir(_path: &std::path::Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|error| format!("Failed to protect file: {error}"))
}

#[cfg(not(unix))]
fn set_private_file(_path: &std::path::Path) -> Result<(), String> {
    Ok(())
}

fn write_private_json<T: Serialize>(path: &PathBuf, payload: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let raw = serde_json::to_string(payload)
        .map_err(|error| format!("Failed to serialize Claude OAuth data: {error}"))?;
    fs::write(path, raw).map_err(|error| format!("Failed to write Claude OAuth data: {error}"))?;
    set_private_file(path)?;
    Ok(())
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read Claude OAuth data: {error}"))?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|error| format!("Failed to parse Claude OAuth data: {error}"))
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{:02X}", *byte));
        }
    }
    encoded
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'+' {
            decoded.push(b' ');
            index += 1;
            continue;
        }
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                decoded.push(hex);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).to_string()
}

fn query_param(url: &str, name: &str) -> Option<String> {
    let (_, after_query) = url.split_once('?')?;
    let query = after_query
        .split_once('#')
        .map_or(after_query, |(query, _)| query);
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        if percent_decode(key) == name {
            return Some(percent_decode(value));
        }
    }
    None
}

fn auth_url(verifier: &str, state: &str) -> String {
    let challenge =
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(sha256(verifier.as_bytes()));
    let params = [
        ("code", "true".to_string()),
        ("client_id", CLAUDE_CLIENT_ID.to_string()),
        ("response_type", "code".to_string()),
        ("redirect_uri", CLAUDE_REDIRECT_URI.to_string()),
        ("scope", CLAUDE_SCOPES.join(" ")),
        ("code_challenge", challenge),
        ("code_challenge_method", "S256".to_string()),
        ("state", state.to_string()),
    ];
    let query = params
        .into_iter()
        .map(|(key, value)| format!("{key}={}", percent_encode(&value)))
        .collect::<Vec<_>>()
        .join("&");
    format!("{CLAUDE_AUTHORIZE_ENDPOINT}?{query}")
}

fn sha256(input: &[u8]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    Sha256::digest(input).into()
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    if getrandom::fill(&mut bytes).is_err() {
        let fallback = format!(
            "{}:{}:{}",
            now_secs(),
            std::process::id(),
            home_dir()
                .map(|path| path.display().to_string())
                .unwrap_or_default()
        );
        bytes = sha256(fallback.as_bytes());
    }
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn open_browser(url: &str) {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(url).status();
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let _ = Command::new("xdg-open").arg(url).status();
    }
}

fn parse_expires_at(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(number)) => number.as_u64(),
        Some(Value::String(raw)) => raw.parse::<u64>().ok(),
        _ => None,
    }
}

fn load_credentials() -> Result<Option<ClaudeCredentials>, String> {
    let path = claude_credentials_path()?;
    let Some(stored) = read_json::<StoredClaudeCredentials>(&path)? else {
        return Ok(None);
    };
    let Some(access_token) = stored.access_token.filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    Ok(Some(ClaudeCredentials {
        access_token,
        refresh_token: stored.refresh_token.filter(|value| !value.is_empty()),
        expires_at: parse_expires_at(stored.expires_at.as_ref()),
        scopes: stored
            .scopes
            .filter(|scopes| !scopes.is_empty())
            .unwrap_or_else(|| {
                CLAUDE_SCOPES
                    .iter()
                    .map(|scope| scope.to_string())
                    .collect()
            }),
        credential_source: "claude_usage_bar".to_string(),
    }))
}

fn save_credentials(credentials: &ClaudeCredentials) -> Result<(), String> {
    let path = claude_credentials_path()?;
    let stored = StoredClaudeCredentials {
        access_token: Some(credentials.access_token.clone()),
        refresh_token: credentials.refresh_token.clone(),
        expires_at: credentials.expires_at.map(Value::from),
        scopes: Some(credentials.scopes.clone()),
    };
    write_private_json(&path, &stored)
}

fn credentials_from_token_response(
    response: ClaudeTokenResponse,
    fallback: Option<&ClaudeCredentials>,
) -> Result<ClaudeCredentials, String> {
    let access_token = response
        .access_token
        .or_else(|| fallback.map(|credentials| credentials.access_token.clone()))
        .ok_or_else(|| {
            "Claude OAuth token response did not include an access token.".to_string()
        })?;
    let expires_at = response.expires_in.as_ref().and_then(|value| match value {
        Value::Number(number) => number.as_u64(),
        Value::String(raw) => raw.parse::<u64>().ok(),
        _ => None,
    });
    let scopes = response
        .scope
        .map(|scope| {
            scope
                .split_whitespace()
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|scopes| !scopes.is_empty())
        .or_else(|| fallback.map(|credentials| credentials.scopes.clone()))
        .unwrap_or_else(|| {
            CLAUDE_SCOPES
                .iter()
                .map(|scope| scope.to_string())
                .collect()
        });
    Ok(ClaudeCredentials {
        access_token,
        refresh_token: response
            .refresh_token
            .or_else(|| fallback.and_then(|credentials| credentials.refresh_token.clone())),
        expires_at: expires_at.map(|seconds| now_secs() + seconds),
        scopes,
        credential_source: "claude_usage_bar".to_string(),
    })
}

async fn post_token(body: Value) -> Result<ClaudeTokenResponse, String> {
    let response = reqwest::Client::new()
        .post(CLAUDE_TOKEN_ENDPOINT)
        .header("User-Agent", CLAUDE_USAGE_USER_AGENT)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Claude OAuth request failed: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("Claude OAuth response read failed: {error}"))?;
    if !status.is_success() {
        return Err(format!("Claude OAuth HTTP {status}: {text}"));
    }
    serde_json::from_str(&text)
        .map_err(|error| format!("Claude OAuth response parse failed: {error}"))
}

async fn refresh_credentials(credentials: &ClaudeCredentials) -> Result<ClaudeCredentials, String> {
    let refresh_token = credentials
        .refresh_token
        .as_ref()
        .ok_or_else(|| "Claude OAuth refresh token is missing.".to_string())?;
    let response = post_token(json!({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": CLAUDE_CLIENT_ID,
        "scope": credentials.scopes.join(" "),
    }))
    .await?;
    let updated = credentials_from_token_response(response, Some(credentials))?;
    save_credentials(&updated)?;
    Ok(updated)
}

async fn valid_credentials() -> Result<Option<ClaudeCredentials>, String> {
    let Some(credentials) = load_credentials()? else {
        return Ok(None);
    };
    if credentials
        .expires_at
        .map(|expires_at| expires_at <= now_secs() + 120)
        .unwrap_or(false)
    {
        return refresh_credentials(&credentials).await.map(Some);
    }
    Ok(Some(credentials))
}

async fn fetch_usage_raw(
    credentials: &ClaudeCredentials,
) -> Result<ClaudeRawUsage, ClaudeUsageError> {
    let response = reqwest::Client::new()
        .get(CLAUDE_USAGE_ENDPOINT)
        .bearer_auth(&credentials.access_token)
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("User-Agent", CLAUDE_USAGE_USER_AGENT)
        .send()
        .await
        .map_err(|error| {
            ClaudeUsageError::Other(format!("Claude usage request failed: {error}"))
        })?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(ClaudeUsageError::Unauthorized);
    }
    let status = response.status();
    let text = response.text().await.map_err(|error| {
        ClaudeUsageError::Other(format!("Claude usage response read failed: {error}"))
    })?;
    if !status.is_success() {
        return Err(ClaudeUsageError::Other(format!(
            "Claude usage HTTP {status}: {text}"
        )));
    }
    serde_json::from_str(&text).map_err(|error| {
        ClaudeUsageError::Other(format!("Claude usage response parse failed: {error}"))
    })
}

fn status_login_required(error: Option<String>, message: Option<String>) -> ClaudeUsageStatus {
    ClaudeUsageStatus {
        ok: true,
        authenticated: false,
        source: "anthropic_oauth_usage".to_string(),
        credential_source: None,
        five_hour: None,
        seven_day: None,
        error,
        message,
        fetched_at: fetched_at(),
    }
}

fn status_error(authenticated: bool, error: &str, message: String) -> ClaudeUsageStatus {
    ClaudeUsageStatus {
        ok: false,
        authenticated,
        source: "anthropic_oauth_usage".to_string(),
        credential_source: None,
        five_hour: None,
        seven_day: None,
        error: Some(error.to_string()),
        message: Some(message),
        fetched_at: fetched_at(),
    }
}

#[tauri::command]
pub fn start_claude_login() -> Result<ClaudeLoginStart, String> {
    let verifier = random_token();
    let state = random_token();
    let auth_url = auth_url(&verifier, &state);
    let pending = PendingClaudeLogin {
        verifier,
        state,
        auth_url: auth_url.clone(),
        created_at: now_secs(),
    };
    let path = claude_pending_path()?;
    write_private_json(&path, &pending)?;
    open_browser(&auth_url);
    Ok(ClaudeLoginStart {
        ok: true,
        auth_url,
        pending_path: path.to_string_lossy().to_string(),
    })
}

fn parse_oauth_code(raw: &str) -> Result<(String, Option<String>), String> {
    let value = raw.trim();
    if value.len() < 20 || value.contains(char::is_whitespace) {
        return Err("Claude OAuth code만 붙여넣어야 합니다.".to_string());
    }
    if value.starts_with("https://") || value.starts_with("http://") {
        let code =
            query_param(value, "code").ok_or_else(|| "OAuth URL에 code가 없습니다.".to_string())?;
        let state = query_param(value, "state");
        return Ok((code, state));
    }
    let (code, state) = value
        .split_once('#')
        .map_or((value, None), |(code, state)| (code, Some(state)));
    Ok((code.to_string(), state.map(str::to_string)))
}

#[tauri::command]
pub async fn finish_claude_login(code: String) -> Result<ClaudeUsageStatus, String> {
    let path = claude_pending_path()?;
    let pending = read_json::<PendingClaudeLogin>(&path)?
        .ok_or_else(|| "진행 중인 Claude OAuth 로그인이 없습니다.".to_string())?;
    if pending.created_at + 15 * 60 < now_secs() {
        let _ = fs::remove_file(&path);
        return Err("Claude OAuth 로그인이 만료되었습니다. 다시 시작하세요.".to_string());
    }
    let (oauth_code, returned_state) = parse_oauth_code(&code)?;
    if returned_state
        .as_deref()
        .map(|state| state != pending.state)
        .unwrap_or(false)
    {
        let _ = fs::remove_file(&path);
        return Err("Claude OAuth state가 일치하지 않습니다. 다시 시작하세요.".to_string());
    }

    let response = post_token(json!({
        "grant_type": "authorization_code",
        "code": oauth_code,
        "state": pending.state,
        "client_id": CLAUDE_CLIENT_ID,
        "redirect_uri": CLAUDE_REDIRECT_URI,
        "code_verifier": pending.verifier,
    }))
    .await?;
    let credentials = credentials_from_token_response(response, None)?;
    save_credentials(&credentials)?;
    let _ = fs::remove_file(&path);
    Ok(get_claude_usage().await)
}

#[tauri::command]
pub fn logout_claude() -> Result<ClaudeUsageStatus, String> {
    let _ = fs::remove_file(claude_credentials_path()?);
    let _ = fs::remove_file(claude_pending_path()?);
    Ok(status_login_required(
        Some("login_required".to_string()),
        Some("Claude 로그인이 필요합니다.".to_string()),
    ))
}

#[tauri::command]
pub async fn get_claude_usage() -> ClaudeUsageStatus {
    let credentials = match valid_credentials().await {
        Ok(Some(credentials)) => credentials,
        Ok(None) => {
            return status_login_required(
                Some("login_required".to_string()),
                Some("Claude 로그인이 필요합니다.".to_string()),
            )
        }
        Err(error) => return status_error(false, "token_refresh_failed", error),
    };

    let raw = match fetch_usage_raw(&credentials).await {
        Ok(raw) => raw,
        Err(ClaudeUsageError::Unauthorized) => match refresh_credentials(&credentials).await {
            Ok(refreshed) => match fetch_usage_raw(&refreshed).await {
                Ok(raw) => raw,
                Err(ClaudeUsageError::Unauthorized) => {
                    return status_error(
                        true,
                        "unauthorized",
                        "Claude OAuth token이 만료되었습니다.".to_string(),
                    )
                }
                Err(ClaudeUsageError::Other(error)) => {
                    return status_error(true, "usage_request_failed", error)
                }
            },
            Err(error) => return status_error(false, "token_refresh_failed", error),
        },
        Err(ClaudeUsageError::Other(error)) => {
            return status_error(true, "usage_request_failed", error)
        }
    };

    ClaudeUsageStatus {
        ok: true,
        authenticated: true,
        source: "anthropic_oauth_usage".to_string(),
        credential_source: Some(credentials.credential_source),
        five_hour: raw.five_hour,
        seven_day: raw.seven_day,
        error: None,
        message: None,
        fetched_at: fetched_at(),
    }
}
