import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { defaultConfig, normalizeConfig } from "./app-model";
import type {
  ActionKind,
  ActionSession,
  AppConfig,
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
    return { activeProfileId: profileId, desktopRestarted: false, message: `${profileId} 선택됨` };
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
  setTrayTooltip: (label) => invoke("set_tray_tooltip", { label }),
  updateTrayMenuState: (menuState) => invoke("update_tray_menu_state", { menuState }),
  onTrayAction: (handler) => listen<TrayActionPayload>("tray-action", (event) => handler(event.payload)),
  startWindowDrag: () => getCurrentWindow().startDragging(),
  hideWindow: () => getCurrentWindow().hide(),
  checkCdxUpstream: () => invoke("check_cdx_upstream"),
};

export const native = isBrowserPreview ? browserApi : tauriApi;
