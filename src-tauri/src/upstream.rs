use crate::domain::UpstreamStatus;
use serde::Deserialize;

const CDX_REPO: &str = "https://github.com/ezpzai/cdx";
const BASE_REF: &str = "v1.0.10";

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
}

#[tauri::command]
pub async fn check_cdx_upstream() -> Result<UpstreamStatus, String> {
    let result = reqwest::Client::new()
        .get("https://api.github.com/repos/ezpzai/cdx/releases/latest")
        .header("User-Agent", "codex-usage-tray")
        .send()
        .await;

    let response = match result {
        Ok(response) => response,
        Err(error) => {
            return Ok(UpstreamStatus {
                repo: CDX_REPO.to_string(),
                base_ref: BASE_REF.to_string(),
                latest_ref: None,
                update_available: false,
                error: Some(format!("Failed to check upstream: {error}")),
            });
        }
    };

    let release = response
        .json::<GithubRelease>()
        .await
        .map_err(|error| format!("Failed to read upstream release: {error}"))?;
    Ok(UpstreamStatus {
        repo: CDX_REPO.to_string(),
        base_ref: BASE_REF.to_string(),
        update_available: release.tag_name != BASE_REF,
        latest_ref: Some(release.tag_name),
        error: None,
    })
}
