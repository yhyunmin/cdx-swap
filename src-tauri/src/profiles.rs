use crate::{
    domain::{AuthSummary, ProfileRecord, ProfileSource, ProfileUsage},
    usage::fetch_usage,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashMap, fs, path::PathBuf};

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

fn profiles_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".cdx").join("profiles"))
}

fn decode_jwt_payload(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let decoded = URL_SAFE_NO_PAD.decode(payload).ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn read_auth_summary(home_path: &PathBuf) -> Option<AuthSummary> {
    let raw = fs::read_to_string(home_path.join("auth.json")).ok()?;
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
