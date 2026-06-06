use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    pub active_profile_id: Option<String>,
    pub codex_cli_path: String,
    pub codex_desktop_path: String,
    pub refresh_interval_seconds: u64,
    pub confirm_before_switch: bool,
    pub restart_desktop_on_switch: bool,
    pub autostart: bool,
    pub mask_emails: bool,
    pub show_session_logs: bool,
    pub claude_enabled: bool,
    pub claude_cli_path: String,
    pub hidden_profile_ids: Vec<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_profile_id: None,
            codex_cli_path: String::new(),
            codex_desktop_path: String::new(),
            refresh_interval_seconds: 60,
            confirm_before_switch: true,
            restart_desktop_on_switch: false,
            autostart: false,
            mask_emails: true,
            show_session_logs: false,
            claude_enabled: false,
            claude_cli_path: String::new(),
            hidden_profile_ids: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayProfile {
    pub profile_id: String,
    pub five_hour_left: Option<u8>,
    pub weekly_left: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuState {
    pub active_profile_id: Option<String>,
    pub profiles: Vec<TrayProfile>,
}

impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            active_profile_id: None,
            profiles: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionPayload {
    pub action: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSummary {
    pub email: Option<String>,
    pub plan: Option<String>,
    pub organization: Option<String>,
    pub account_id: Option<String>,
    #[serde(skip_serializing)]
    pub access_token: Option<String>,
    pub last_refresh: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRecord {
    pub id: String,
    pub home_path: String,
    pub source: ProfileSource,
    pub auth: Option<AuthSummary>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProfileSource {
    Modern,
    Legacy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileUsage {
    pub profile_id: String,
    pub account: String,
    pub plan: Option<String>,
    pub five_hour_left: Option<u8>,
    pub five_hour_reset: Option<String>,
    pub weekly_left: Option<u8>,
    pub weekly_reset: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionSession {
    pub id: String,
    pub kind: ActionKind,
    pub profile_id: String,
    pub status: ActionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub exit_code: Option<i32>,
    pub message: String,
    pub recent_output: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionKind {
    Login,
    Run,
    Logout,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionStatus {
    Starting,
    Running,
    Succeeded,
    Failed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchResult {
    pub active_profile_id: String,
    pub desktop_restarted: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamStatus {
    pub repo: String,
    pub base_ref: String,
    pub latest_ref: Option<String>,
    pub update_available: bool,
    pub error: Option<String>,
}
