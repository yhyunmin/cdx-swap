import { invoke } from "@tauri-apps/api/core";
import { defaultConfig } from "./app-model";
import type { ActionKind, ActionSession, AppConfig, ProfileRecord, ProfileUsage, SwitchResult, UpstreamStatus } from "../types/domain";

interface NativeApi {
  getConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<AppConfig>;
  listProfileUsage(): Promise<ProfileUsage[]>;
  ensureProfile(profileId: string): Promise<ProfileRecord>;
  startActionSession(kind: ActionKind, profileId: string): Promise<ActionSession>;
  sendActionInput(sessionId: string, input: string): Promise<void>;
  getActionSession(sessionId: string): Promise<ActionSession | null>;
  switchProfile(profileId: string, config: AppConfig): Promise<SwitchResult>;
  setTrayTooltip(label: string): Promise<void>;
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
    return JSON.parse(localStorage.getItem("codex-usage-tray-config") ?? "null") ?? defaultConfig;
  },
  async saveConfig(config) {
    localStorage.setItem("codex-usage-tray-config", JSON.stringify(config));
    return config;
  },
  async listProfileUsage() {
    return sampleProfiles;
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
  async checkCdxUpstream() {
    return { repo: "https://github.com/ezpzai/cdx", baseRef: "v1.0.10", latestRef: null, updateAvailable: false, error: null };
  },
};

const tauriApi: NativeApi = {
  getConfig: () => invoke("get_app_config"),
  saveConfig: (config) => invoke("save_app_config", { config }),
  listProfileUsage: () => invoke("list_profile_usage"),
  ensureProfile: (profileId) => invoke("ensure_profile", { profileId }),
  startActionSession: (kind, profileId) => invoke("start_action_session", { kind, profileId }),
  sendActionInput: (sessionId, input) => invoke("send_action_input", { sessionId, input }),
  getActionSession: (sessionId) => invoke("get_action_session", { sessionId }),
  switchProfile: (profileId, config) => invoke("switch_profile", { profileId, config }),
  setTrayTooltip: (label) => invoke("set_tray_tooltip", { label }),
  checkCdxUpstream: () => invoke("check_cdx_upstream"),
};

export const native = isBrowserPreview ? browserApi : tauriApi;
