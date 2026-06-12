use crate::{
    domain::{ActionKind, ActionSession, ActionStatus, AppConfig},
    profiles::{delete_profile, ensure_profile, resolve_profile},
};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{ChildStdin, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

const OUTPUT_LIMIT: usize = 40;

pub struct ActionStore {
    sessions: Arc<Mutex<HashMap<String, ActionSession>>>,
    inputs: Arc<Mutex<HashMap<String, ChildStdin>>>,
}

impl Default for ActionStore {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            inputs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

fn now_label() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn session_id(kind: ActionKind, profile_id: &str) -> String {
    format!("{kind:?}-{profile_id}-{}", now_label())
}

fn resolve_codex_cli_path(config: &AppConfig) -> PathBuf {
    if !config.codex_cli_path.trim().is_empty() {
        return PathBuf::from(config.codex_cli_path.trim());
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app_data)
                .join("Programs")
                .join("OpenAI")
                .join("Codex")
                .join("bin")
                .join("codex.exe");
            if candidate.exists() {
                return candidate;
            }
        }

        let administrator_candidate = PathBuf::from(
            r"C:\Users\Administrator\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe",
        );
        if administrator_candidate.exists() {
            return administrator_candidate;
        }
    }

    PathBuf::from("codex")
}

fn trim_output(mut lines: Vec<String>) -> Vec<String> {
    if lines.len() > OUTPUT_LIMIT {
        lines.drain(0..lines.len() - OUTPUT_LIMIT);
    }
    lines
}

fn append_output(session: &mut ActionSession, text: &str) {
    let mut next = session.recent_output.clone();
    next.extend(
        text.lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string),
    );
    session.recent_output = trim_output(next);
    if let Some(last) = session.recent_output.last() {
        session.message = last.clone();
    }
}

fn update_session(
    sessions: &Arc<Mutex<HashMap<String, ActionSession>>>,
    session_id: &str,
    update: impl FnOnce(&mut ActionSession),
) {
    let Ok(mut sessions) = sessions.lock() else {
        return;
    };
    if let Some(session) = sessions.get_mut(session_id) {
        update(session);
    }
}

fn stream_output(
    sessions: Arc<Mutex<HashMap<String, ActionSession>>>,
    session_id: String,
    reader: impl std::io::Read + Send + 'static,
) {
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            update_session(&sessions, &session_id, |session| {
                append_output(session, &line)
            });
        }
    });
}

#[tauri::command]
pub fn get_action_session(
    store: State<ActionStore>,
    session_id: String,
) -> Result<Option<ActionSession>, String> {
    let sessions = store
        .sessions
        .lock()
        .map_err(|_| "Action store lock failed.".to_string())?;
    Ok(sessions.get(&session_id).cloned())
}

#[tauri::command]
pub fn start_action_session(
    store: State<ActionStore>,
    kind: ActionKind,
    profile_id: String,
    config: AppConfig,
) -> Result<ActionSession, String> {
    if matches!(kind, ActionKind::Run) {
        return Err(
            "Run uses profile switching instead of an interactive Codex CLI session.".to_string(),
        );
    }

    let profile = match kind {
        ActionKind::Login => ensure_profile(profile_id.clone())?,
        _ => {
            resolve_profile(&profile_id)?.ok_or_else(|| format!("Unknown profile: {profile_id}"))?
        }
    };

    let id = session_id(kind, &profile.id);
    let session = ActionSession {
        id: id.clone(),
        kind,
        profile_id: profile.id.clone(),
        status: ActionStatus::Starting,
        started_at: now_label(),
        finished_at: None,
        exit_code: None,
        message: format!("{kind:?} starting for {}...", profile.id),
        recent_output: Vec::new(),
    };

    store
        .sessions
        .lock()
        .map_err(|_| "Action store lock failed.".to_string())?
        .insert(id.clone(), session.clone());

    let command_arg = match kind {
        ActionKind::Login => Some("login"),
        ActionKind::Run => None,
        ActionKind::Logout => Some("logout"),
    };
    let codex_path = resolve_codex_cli_path(&config);
    let mut command = Command::new(&codex_path);
    if let Some(arg) = command_arg {
        command.arg(arg);
    }
    command
        .env("CODEX_HOME", &profile.home_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console_window(&mut command);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            update_session(&store.sessions, &id, |session| {
                session.status = ActionStatus::Failed;
                session.exit_code = Some(1);
                session.finished_at = Some(now_label());
                session.message = format!("Failed to run {}: {error}", codex_path.display());
                session.recent_output = vec![session.message.clone()];
            });
            let sessions = store
                .sessions
                .lock()
                .map_err(|_| "Action store lock failed.".to_string())?;
            return Ok(sessions.get(&id).cloned().unwrap_or(session));
        }
    };

    if let Some(stdin) = child.stdin.take() {
        store
            .inputs
            .lock()
            .map_err(|_| "Action input store lock failed.".to_string())?
            .insert(id.clone(), stdin);
    }

    update_session(&store.sessions, &id, |session| {
        session.status = ActionStatus::Running;
        session.message = format!("{kind:?} running for {}...", profile.id);
    });

    if let Some(stdout) = child.stdout.take() {
        stream_output(Arc::clone(&store.sessions), id.clone(), stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        stream_output(Arc::clone(&store.sessions), id.clone(), stderr);
    }

    let sessions = Arc::clone(&store.sessions);
    let inputs = Arc::clone(&store.inputs);
    let wait_id = id.clone();
    let wait_profile = profile.clone();
    thread::spawn(move || {
        let status = child.wait();
        if let Ok(mut inputs) = inputs.lock() {
            inputs.remove(&wait_id);
        }
        update_session(&sessions, &wait_id, |session| match status {
            Ok(status) => {
                let code = status.code().unwrap_or(1);
                if status.success() && matches!(kind, ActionKind::Logout) {
                    if let Err(error) = delete_profile(&wait_profile) {
                        session.status = ActionStatus::Failed;
                        session.exit_code = Some(1);
                        session.finished_at = Some(now_label());
                        session.message = error.clone();
                        session.recent_output = trim_output({
                            let mut output = session.recent_output.clone();
                            output.push(error);
                            output
                        });
                        return;
                    }
                }
                session.status = if status.success() {
                    ActionStatus::Succeeded
                } else {
                    ActionStatus::Failed
                };
                session.exit_code = Some(code);
                session.finished_at = Some(now_label());
                if session.message.is_empty() {
                    session.message = format!("{kind:?} exited with code {code}.");
                }
            }
            Err(error) => {
                session.status = ActionStatus::Failed;
                session.exit_code = Some(1);
                session.finished_at = Some(now_label());
                session.message = format!("Failed to wait for codex: {error}");
            }
        });
    });

    Ok(session)
}

#[cfg(target_os = "windows")]
fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_command: &mut Command) {}

#[tauri::command]
pub fn send_action_input(
    store: State<ActionStore>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    let mut inputs = store
        .inputs
        .lock()
        .map_err(|_| "Action input store lock failed.".to_string())?;
    let stdin = inputs
        .get_mut(&session_id)
        .ok_or_else(|| "This session is not accepting input.".to_string())?;

    stdin
        .write_all(input.as_bytes())
        .map_err(|error| format!("Failed to write session input: {error}"))?;
    if !input.ends_with('\n') {
        stdin
            .write_all(b"\n")
            .map_err(|error| format!("Failed to write session newline: {error}"))?;
    }
    stdin
        .flush()
        .map_err(|error| format!("Failed to flush session input: {error}"))
}
