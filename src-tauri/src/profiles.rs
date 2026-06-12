use crate::{
    domain::{AuthSummary, CurrentAccountStatus, ProfileRecord, ProfileSource, ProfileUsage},
    usage::fetch_usage,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const AUTH_FILE: &str = "auth.json";

#[derive(Deserialize)]
struct AuthFile {
    last_refresh: Option<String>,
    tokens: Option<AuthTokens>,
}

#[derive(Deserialize)]
struct AuthTokens {
    id_token: Option<String>,
    access_token: Option<String>,
    account_id: Option<String>,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Failed to resolve home directory.".to_string())
}

fn default_codex_home() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".codex"))
}

fn profiles_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".cdx").join("profiles"))
}

fn decode_jwt_payload(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let decoded = URL_SAFE_NO_PAD.decode(payload).ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn read_auth_summary(home_path: &PathBuf) -> Option<AuthSummary> {
    let raw = fs::read_to_string(home_path.join(AUTH_FILE)).ok()?;
    let auth_file: AuthFile = serde_json::from_str(&raw).ok()?;
    let tokens = auth_file.tokens?;
    let payload = tokens.id_token.as_deref().and_then(decode_jwt_payload);
    let openai_auth = payload
        .as_ref()
        .and_then(|value| value.get("https://api.openai.com/auth"));

    let email = payload
        .as_ref()
        .and_then(|value| value.get("email"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let plan = openai_auth
        .and_then(|value| value.get("chatgpt_plan_type"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let organization = openai_auth
        .and_then(|value| value.get("organizations"))
        .and_then(Value::as_array)
        .and_then(|orgs| {
            orgs.iter()
                .find(|org| {
                    org.get("is_default")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                })
                .or(orgs.first())
        })
        .and_then(|org| org.get("title"))
        .and_then(Value::as_str)
        .map(str::to_string);

    Some(AuthSummary {
        email,
        plan,
        organization,
        account_id: tokens.account_id,
        access_token: tokens.access_token,
        last_refresh: auth_file.last_refresh,
    })
}

fn same_file(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn sync_profile_auth_file(profile: &ProfileRecord, target_home: &Path) -> Result<(), String> {
    let source = PathBuf::from(&profile.home_path).join(AUTH_FILE);
    if !source.is_file() {
        return Err(format!(
            "Profile {} is not logged in. Use Login first.",
            profile.id
        ));
    }

    fs::create_dir_all(target_home)
        .map_err(|error| format!("Failed to create default Codex home: {error}"))?;
    let target = target_home.join(AUTH_FILE);
    if same_file(&source, &target) {
        return Ok(());
    }

    fs::copy(&source, &target)
        .map_err(|error| format!("Failed to sync Codex auth token: {error}"))?;
    Ok(())
}

fn auth_identity_matches(current: &AuthSummary, profile: &AuthSummary) -> bool {
    if current.account_id.is_some() && current.account_id == profile.account_id {
        return true;
    }
    current.email.is_some() && current.email == profile.email
}

fn auth_file_matches(current_home: &Path, profile_home: &Path) -> bool {
    let current = fs::read(current_home.join(AUTH_FILE));
    let profile = fs::read(profile_home.join(AUTH_FILE));
    matches!((current, profile), (Ok(current), Ok(profile)) if current == profile)
}

fn current_account_status_result() -> Result<Option<CurrentAccountStatus>, String> {
    let current_home = default_codex_home()?;
    let Some(current) = read_auth_summary(&current_home) else {
        return Ok(None);
    };
    let matched_profile_id = list_profiles()?
        .into_iter()
        .find(|profile| {
            let profile_home = PathBuf::from(&profile.home_path);
            auth_file_matches(&current_home, &profile_home)
                || profile
                    .auth
                    .as_ref()
                    .map(|auth| auth_identity_matches(&current, auth))
                    .unwrap_or(false)
        })
        .map(|profile| profile.id);

    Ok(Some(CurrentAccountStatus {
        account: current.email,
        account_id: current.account_id,
        registered: matched_profile_id.is_some(),
        matched_profile_id,
    }))
}

fn sync_default_auth_to_ssh_host(host: &str) -> Result<(), String> {
    let host = host.trim();
    if host.is_empty() {
        return Err("SSH host 이름을 입력해야 합니다.".to_string());
    }

    let auth_path = default_codex_home()?.join(AUTH_FILE);
    let auth = fs::read(&auth_path)
        .map_err(|error| format!("Failed to read Windows Codex auth.json: {error}"))?;
    let mut command = Command::new("ssh");
    command
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            host,
            "mkdir -p ~/.codex && cat > ~/.codex/auth.json && chmod 600 ~/.codex/auth.json",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    hide_console_window(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start ssh auth sync: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open ssh stdin.".to_string())?;
    stdin
        .write_all(&auth)
        .map_err(|error| format!("Failed to write ssh auth sync input: {error}"))?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed to wait for ssh auth sync: {error}"))?;
    if output.status.success() {
        return restart_ssh_codex_runtime(host);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        "SSH Codex auth sync failed.".to_string()
    } else {
        format!("SSH Codex auth sync failed: {stderr}")
    })
}

fn restart_ssh_codex_runtime(host: &str) -> Result<(), String> {
    let mut command = Command::new("ssh");
    command
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            host,
            "if command -v pkill >/dev/null 2>&1; then pkill -TERM -f 'codex app-server' 2>/dev/null || true; pkill -TERM -f 'codex.*proxy' 2>/dev/null || true; pkill -TERM -f '/usr/local/bin/codex.*app-server' 2>/dev/null || true; fi",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    hide_console_window(&mut command);

    let output = command
        .output()
        .map_err(|error| format!("Failed to restart SSH Codex runtime: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        "SSH Codex runtime restart failed.".to_string()
    } else {
        format!("SSH Codex runtime restart failed: {stderr}")
    })
}

#[cfg(target_os = "windows")]
pub fn sync_profile_auth_to_default_home(profile: &ProfileRecord) -> Result<(), String> {
    sync_profile_auth_file(profile, &default_codex_home()?)
}

#[cfg(not(target_os = "windows"))]
pub fn sync_profile_auth_to_default_home(_profile: &ProfileRecord) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn sync_default_auth_to_ssh(host: &str) -> Result<(), String> {
    sync_default_auth_to_ssh_host(host)
}

#[cfg(not(target_os = "windows"))]
pub fn sync_default_auth_to_ssh(_host: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_command: &mut Command) {}

fn has_auth(profile: &ProfileRecord) -> bool {
    profile
        .auth
        .as_ref()
        .map(|auth| {
            auth.email.is_some() || auth.access_token.is_some() || auth.account_id.is_some()
        })
        .unwrap_or(false)
}

fn profile_rank(profile: &ProfileRecord) -> (u8, u8, String) {
    let auth_rank = if has_auth(profile) { 0 } else { 1 };
    let source_rank = if profile.source == ProfileSource::Legacy {
        0
    } else {
        1
    };
    (auth_rank, source_rank, profile.id.clone())
}

fn modern_profiles() -> Result<Vec<ProfileRecord>, String> {
    let root = profiles_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| format!("Failed to read profiles: {error}"))? {
        let entry = entry.map_err(|error| format!("Failed to read profile entry: {error}"))?;
        if !entry
            .file_type()
            .map(|file_type| file_type.is_dir())
            .unwrap_or(false)
        {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let home_path = entry.path();
        profiles.push(ProfileRecord {
            id,
            home_path: home_path.to_string_lossy().to_string(),
            source: ProfileSource::Modern,
            auth: read_auth_summary(&home_path),
        });
    }
    Ok(profiles)
}

fn legacy_profiles() -> Result<Vec<ProfileRecord>, String> {
    let home = home_dir()?;
    let mut profiles = Vec::new();
    for entry in
        fs::read_dir(home).map_err(|error| format!("Failed to read home directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read home entry: {error}"))?;
        if !entry
            .file_type()
            .map(|file_type| file_type.is_dir())
            .unwrap_or(false)
        {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let Some(suffix) = name.strip_prefix(".codex") else {
            continue;
        };
        if !suffix.chars().all(|char| char.is_ascii_digit()) {
            continue;
        }
        let home_path = entry.path();
        profiles.push(ProfileRecord {
            id: name.trim_start_matches('.').to_string(),
            home_path: home_path.to_string_lossy().to_string(),
            source: ProfileSource::Legacy,
            auth: read_auth_summary(&home_path),
        });
    }
    Ok(profiles)
}

pub fn list_profiles() -> Result<Vec<ProfileRecord>, String> {
    let mut profiles = modern_profiles()?;
    profiles.extend(legacy_profiles()?);
    profiles.sort_by_key(profile_rank);

    let mut deduped = HashMap::<String, ProfileRecord>::new();
    for profile in profiles {
        let replace = deduped
            .get(&profile.id)
            .map(|existing| profile_rank(&profile) < profile_rank(existing))
            .unwrap_or(true);
        if replace {
            deduped.insert(profile.id.clone(), profile);
        }
    }

    let mut values = deduped.into_values().collect::<Vec<_>>();
    values.sort_by_key(profile_rank);
    Ok(values)
}

pub fn resolve_profile(profile_id: &str) -> Result<Option<ProfileRecord>, String> {
    Ok(list_profiles()?
        .into_iter()
        .find(|profile| profile.id == profile_id))
}

fn legacy_profile_id_is_safe(id: &str) -> bool {
    id.strip_prefix("codex")
        .map(|suffix| !suffix.is_empty() && suffix.chars().all(|char| char.is_ascii_digit()))
        .unwrap_or(false)
}

fn delete_target_allowed(
    profile: &ProfileRecord,
    target: &Path,
    modern_root: &Path,
    home: &Path,
) -> bool {
    let Some(file_name) = target.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    match profile.source {
        ProfileSource::Modern => {
            target.parent() == Some(modern_root) && file_name == profile.id.as_str()
        }
        ProfileSource::Legacy => {
            target.parent() == Some(home)
                && file_name == format!(".{}", profile.id)
                && legacy_profile_id_is_safe(&profile.id)
        }
    }
}

pub fn delete_profile(profile: &ProfileRecord) -> Result<(), String> {
    let target = PathBuf::from(&profile.home_path);
    if !target.exists() {
        return Ok(());
    }
    let target = target
        .canonicalize()
        .map_err(|error| format!("Failed to resolve profile path: {error}"))?;
    let home = home_dir()?
        .canonicalize()
        .map_err(|error| format!("Failed to resolve home directory: {error}"))?;
    let allowed = match profile.source {
        ProfileSource::Modern => {
            let modern_root = profiles_root()?
                .canonicalize()
                .map_err(|error| format!("Failed to resolve profiles root: {error}"))?;
            delete_target_allowed(profile, &target, &modern_root, &home)
        }
        ProfileSource::Legacy => delete_target_allowed(profile, &target, Path::new(""), &home),
    };

    if !allowed {
        return Err(format!(
            "Refusing to delete unexpected profile path: {}",
            target.display()
        ));
    }

    fs::remove_dir_all(&target).map_err(|error| format!("Failed to delete profile: {error}"))
}

#[tauri::command]
pub fn ensure_profile(profile_id: String) -> Result<ProfileRecord, String> {
    let id = profile_id.trim();
    if id.is_empty() {
        return Err("Profile id is required.".to_string());
    }
    let home_path = profiles_root()?.join(id);
    fs::create_dir_all(&home_path).map_err(|error| format!("Failed to create profile: {error}"))?;
    Ok(ProfileRecord {
        id: id.to_string(),
        home_path: home_path.to_string_lossy().to_string(),
        source: ProfileSource::Modern,
        auth: read_auth_summary(&home_path),
    })
}

#[tauri::command]
pub async fn list_profile_usage() -> Result<Vec<ProfileUsage>, String> {
    let profiles = list_profiles()?;
    let mut rows = Vec::with_capacity(profiles.len());
    for profile in profiles {
        rows.push(fetch_usage(&profile).await);
    }
    Ok(rows)
}

#[tauri::command]
pub fn get_current_account_status() -> Result<Option<CurrentAccountStatus>, String> {
    current_account_status_result()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path(label: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        std::env::temp_dir().join(format!("cdx-swap-{label}-{suffix}"))
    }

    fn profile_at(home_path: &Path) -> ProfileRecord {
        ProfileRecord {
            id: "work".to_string(),
            home_path: home_path.to_string_lossy().to_string(),
            source: ProfileSource::Modern,
            auth: None,
        }
    }

    #[test]
    fn sync_profile_auth_file_copies_auth_to_target_home() {
        let source_home = temp_path("source");
        let target_home = temp_path("target");
        fs::create_dir_all(&source_home).expect("source home should be created");
        fs::write(
            source_home.join(AUTH_FILE),
            r#"{"tokens":{"account_id":"a"}}"#,
        )
        .expect("auth fixture should be written");

        sync_profile_auth_file(&profile_at(&source_home), &target_home).expect("auth should sync");

        let copied =
            fs::read_to_string(target_home.join(AUTH_FILE)).expect("target auth should exist");
        assert!(copied.contains(r#""account_id":"a""#));

        let _ = fs::remove_dir_all(source_home);
        let _ = fs::remove_dir_all(target_home);
    }

    #[test]
    fn sync_profile_auth_file_fails_when_profile_is_not_logged_in() {
        let source_home = temp_path("missing-source");
        let target_home = temp_path("missing-target");
        fs::create_dir_all(&source_home).expect("source home should be created");

        let error = sync_profile_auth_file(&profile_at(&source_home), &target_home)
            .expect_err("missing auth should fail");

        assert!(error.contains("Use Login first"));

        let _ = fs::remove_dir_all(source_home);
        let _ = fs::remove_dir_all(target_home);
    }

    #[test]
    fn auth_file_matches_exact_auth_contents() {
        let current_home = temp_path("current-auth");
        let profile_home = temp_path("profile-auth");
        fs::create_dir_all(&current_home).expect("current home should be created");
        fs::create_dir_all(&profile_home).expect("profile home should be created");
        fs::write(
            current_home.join(AUTH_FILE),
            r#"{"tokens":{"account_id":"same"}}"#,
        )
        .expect("current auth fixture should be written");
        fs::write(
            profile_home.join(AUTH_FILE),
            r#"{"tokens":{"account_id":"same"}}"#,
        )
        .expect("profile auth fixture should be written");

        assert!(auth_file_matches(&current_home, &profile_home));

        let _ = fs::remove_dir_all(current_home);
        let _ = fs::remove_dir_all(profile_home);
    }

    #[test]
    fn auth_identity_matches_by_account_id_or_email() {
        let current = AuthSummary {
            email: Some("main@example.com".to_string()),
            plan: None,
            organization: None,
            account_id: Some("acct-main".to_string()),
            access_token: None,
            last_refresh: None,
        };
        let account_id_match = AuthSummary {
            email: Some("other@example.com".to_string()),
            account_id: Some("acct-main".to_string()),
            ..current.clone()
        };
        let email_match = AuthSummary {
            email: Some("main@example.com".to_string()),
            account_id: None,
            ..current.clone()
        };

        assert!(auth_identity_matches(&current, &account_id_match));
        assert!(auth_identity_matches(&current, &email_match));
    }
}
