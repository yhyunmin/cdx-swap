use crate::domain::{ProfileRecord, ProfileUsage};
use serde::Deserialize;

const CODEX_USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
const USER_AGENT: &str = "codex_cli_rs/0.76.0 (Windows; x86_64) cdx-swap/0.1.0";

#[derive(Deserialize)]
struct UsageResponse {
    email: Option<String>,
    plan_type: Option<String>,
    #[serde(rename = "planType")]
    plan_type_camel: Option<String>,
    rate_limit: Option<RateLimit>,
    #[serde(rename = "rateLimit")]
    rate_limit_camel: Option<RateLimit>,
}

#[derive(Deserialize)]
struct RateLimit {
    primary_window: Option<UsageWindow>,
    #[serde(rename = "primaryWindow")]
    primary_window_camel: Option<UsageWindow>,
    secondary_window: Option<UsageWindow>,
    #[serde(rename = "secondaryWindow")]
    secondary_window_camel: Option<UsageWindow>,
}

#[derive(Deserialize)]
struct UsageWindow {
    used_percent: Option<f64>,
    #[serde(rename = "usedPercent")]
    used_percent_camel: Option<f64>,
    reset_after_seconds: Option<f64>,
    #[serde(rename = "resetAfterSeconds")]
    reset_after_seconds_camel: Option<f64>,
}

fn remaining_percent(window: Option<&UsageWindow>) -> Option<u8> {
    let used = window?.used_percent.or(window?.used_percent_camel)?;
    Some((100.0 - used).round().clamp(0.0, 100.0) as u8)
}

fn reset_at(window: Option<&UsageWindow>) -> Option<String> {
    let seconds = window?
        .reset_after_seconds
        .or(window?.reset_after_seconds_camel)?;
    Some(format!("+{}s", seconds.round() as i64))
}

pub async fn fetch_usage(profile: &ProfileRecord) -> ProfileUsage {
    match fetch_usage_result(profile).await {
        Ok(row) => row,
        Err(error) => ProfileUsage {
            profile_id: profile.id.clone(),
            account: profile
                .auth
                .as_ref()
                .and_then(|auth| auth.email.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            plan: profile.auth.as_ref().and_then(|auth| auth.plan.clone()),
            five_hour_left: None,
            five_hour_reset: None,
            weekly_left: None,
            weekly_reset: None,
            error: Some(error),
        },
    }
}

async fn fetch_usage_result(profile: &ProfileRecord) -> Result<ProfileUsage, String> {
    let auth = profile
        .auth
        .as_ref()
        .ok_or_else(|| format!("Profile {} is not logged in.", profile.id))?;
    let access_token = auth
        .access_token
        .as_ref()
        .ok_or_else(|| format!("Profile {} is missing an access token.", profile.id))?;
    let account_id = auth
        .account_id
        .as_ref()
        .ok_or_else(|| format!("Profile {} is missing an account id.", profile.id))?;

    let client = reqwest::Client::new();
    let response = client
        .get(CODEX_USAGE_URL)
        .bearer_auth(access_token)
        .header("ChatGPT-Account-Id", account_id)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|error| format!("Usage request failed: {error}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(format!(
            "Profile {} token expired. Use Login to refresh it.",
            profile.id
        ));
    }
    if !response.status().is_success() {
        return Err(format!("Usage request failed with {}.", response.status()));
    }

    let payload = response
        .json::<UsageResponse>()
        .await
        .map_err(|error| format!("Usage response was not valid JSON: {error}"))?;
    let rate_limit = payload
        .rate_limit
        .as_ref()
        .or(payload.rate_limit_camel.as_ref());
    let primary = rate_limit.and_then(|limit| {
        limit
            .primary_window
            .as_ref()
            .or(limit.primary_window_camel.as_ref())
    });
    let secondary = rate_limit.and_then(|limit| {
        limit
            .secondary_window
            .as_ref()
            .or(limit.secondary_window_camel.as_ref())
    });

    Ok(ProfileUsage {
        profile_id: profile.id.clone(),
        account: payload
            .email
            .or_else(|| auth.email.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        plan: payload
            .plan_type
            .or(payload.plan_type_camel)
            .or_else(|| auth.plan.clone()),
        five_hour_left: remaining_percent(primary),
        five_hour_reset: reset_at(primary),
        weekly_left: remaining_percent(secondary),
        weekly_reset: reset_at(secondary),
        error: None,
    })
}
