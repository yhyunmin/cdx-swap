import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { defaultConfig, normalizeConfig } from "./app-model";
import type {
  ActionKind,
  ActionSession,
  AppConfig,
  ClaudeLoginStart,
  ClaudeUsageStatus,
  CurrentAccountStatus,
  ProfileRecord,
  ProfileUsage,
  SwitchResult,
  TrayActionPayload,
  TrayMenuState,
  UpstreamStatus,
} from "../types/domain";

interface NativeApi {
  getConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<AppConfig>;
  listProfileUsage(): Promise<ProfileUsage[]>;
  getCurrentAccountStatus(): Promise<CurrentAccountStatus | null>;
  ensureProfile(profileId: string): Promise<ProfileRecord>;
  startActionSession(kind: ActionKind, profileId: string, config: AppConfig): Promise<ActionSession>;
  sendActionInput(sessionId: string, input: string): Promise<void>;
  getActionSession(sessionId: string): Promise<ActionSession | null>;
  switchProfile(profileId: string, config: AppConfig): Promise<SwitchResult>;
  retrySshCodexSync(config: AppConfig): Promise<SwitchResult["ssh"]>;
  startClaudeLogin(): Promise<ClaudeLoginStart>;
  finishClaudeLogin(code: string): Promise<ClaudeUsageStatus>;
  logoutClaude(): Promise<ClaudeUsageStatus>;
  getClaudeUsage(): Promise<ClaudeUsageStatus>;
  setTrayTooltip(label: string): Promise<void>;
  updateTrayMenuState(menuState: TrayMenuState): Promise<void>;
  onTrayAction(handler: (payload: TrayActionPayload) => void): Promise<UnlistenFn>;
  startWindowDrag(): Promise<void>;
  hideWindow(): Promise<void>;
  checkCdxUpstream(): Promise<UpstreamStatus>;
}

const sampleProfiles: ProfileUsage[] = [
  { profileId: "main", account: "preview@example.com", plan: "plus", fiveHourLeft: 35, fiveHourReset: null, weeklyLeft: 61, weeklyReset: null, error: null },
  { profileId: "work", account: "work@example.com", plan: "team", fiveHourLeft: 66, fiveHourReset: null, weeklyLeft: 47, weeklyReset: null, error: null },
];

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export const isBrowserPreview = !isTauriRuntime();

const browserApi: NativeApi = {
  async getConfig() {
    return normalizeConfig(JSON.parse(localStorage.getItem("cdx-swap-config") ?? "null") ?? defaultConfig);
  },
  async saveConfig(config) {
    localStorage.setItem("cdx-swap-config", JSON.stringify(config));
    return config;
  },
  async listProfileUsage() {
    return sampleProfiles;
  },
  async getCurrentAccountStatus() {
    return { account: "preview@example.com", accountId: "preview", matchedProfileId: "main", registered: true };
  },
  async ensureProfile(profileId) {
    return { id: profileId, homePath: `~/.cdx/profiles/${profileId}`, source: "modern", auth: null };
  },
  async startActionSession(kind, profileId) {
    return {
      id: `${kind}-${profileId}-preview`,
      kind,
      profileId,
      status: "failed",
      startedAt: String(Date.now()),
      finishedAt: String(Date.now()),
      exitCode: 1,
      message: "브라우저 preview에서는 codex 프로세스를 실행할 수 없습니다. Tauri 앱에서 실행하세요.",
      recentOutput: [`Run this app with Tauri to execute: codex ${kind === "run" ? "" : kind}`.trim()],
    };
  },
  async getActionSession() {
    return null;
  },
  async sendActionInput() {},
  async switchProfile(profileId) {
    return {
      activeProfileId: profileId,
      desktopRestarted: false,
      windows: { ok: true, message: `${profileId} 선택됨` },
      desktop: { requested: false, ok: null, restarted: false, message: null },
      ssh: { enabled: false, ok: null, stage: "disabled", message: null },
      message: `${profileId} 선택됨`,
    };
  },
  async retrySshCodexSync() {
    return { enabled: false, ok: null, stage: "disabled", message: null };
  },
  async startClaudeLogin() {
    return { ok: true, authUrl: "https://claude.ai/oauth/authorize", pendingPath: "~/.cdx/claude_oauth_pending.json" };
  },
  async finishClaudeLogin() {
    return {
      ok: true,
      authenticated: true,
      source: "anthropic_oauth_usage",
      credentialSource: "preview",
      fiveHour: { utilization: 42, resetsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() },
      sevenDay: { utilization: 64, resetsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      error: null,
      message: null,
      fetchedAt: new Date().toISOString(),
    };
  },
  async logoutClaude() {
    return {
      ok: true,
      authenticated: false,
      source: "anthropic_oauth_usage",
      credentialSource: null,
      fiveHour: null,
      sevenDay: null,
      error: "login_required",
      message: "Claude 로그인이 필요합니다.",
      fetchedAt: new Date().toISOString(),
    };
  },
  async getClaudeUsage() {
    return {
      ok: true,
      authenticated: true,
      source: "anthropic_oauth_usage",
      credentialSource: "preview",
      fiveHour: { utilization: 42, resetsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() },
      sevenDay: { utilization: 64, resetsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      error: null,
      message: null,
      fetchedAt: new Date().toISOString(),
    };
  },
  async setTrayTooltip() {},
  async updateTrayMenuState() {},
  async onTrayAction() {
    return () => {};
  },
  async startWindowDrag() {},
  async hideWindow() {},
  async checkCdxUpstream() {
    return { repo: "https://github.com/ezpzai/cdx", baseRef: "v1.0.10", latestRef: null, updateAvailable: false, error: null };
  },
};

const tauriApi: NativeApi = {
  getConfig: () => invoke("get_app_config"),
  saveConfig: (config) => invoke("save_app_config", { config }),
  listProfileUsage: () => invoke("list_profile_usage"),
  getCurrentAccountStatus: () => invoke("get_current_account_status"),
  ensureProfile: (profileId) => invoke("ensure_profile", { profileId }),
  startActionSession: (kind, profileId, config) => invoke("start_action_session", { kind, profileId, config }),
  sendActionInput: (sessionId, input) => invoke("send_action_input", { sessionId, input }),
  getActionSession: (sessionId) => invoke("get_action_session", { sessionId }),
  switchProfile: (profileId, config) => invoke("switch_profile", { profileId, config }),
  retrySshCodexSync: (config) => invoke("retry_ssh_codex_sync", { config }),
  startClaudeLogin: () => invoke("start_claude_login"),
  finishClaudeLogin: (code) => invoke("finish_claude_login", { code }),
  logoutClaude: () => invoke("logout_claude"),
  getClaudeUsage: () => invoke("get_claude_usage"),
  setTrayTooltip: (label) => invoke("set_tray_tooltip", { label }),
  updateTrayMenuState: (menuState) => invoke("update_tray_menu_state", { menuState }),
  onTrayAction: (handler) => listen<TrayActionPayload>("tray-action", (event) => handler(event.payload)),
  startWindowDrag: () => getCurrentWindow().startDragging(),
  hideWindow: () => getCurrentWindow().hide(),
  checkCdxUpstream: () => invoke("check_cdx_upstream"),
};

export const native = isBrowserPreview ? browserApi : tauriApi;
