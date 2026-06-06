export type ActionKind = "login" | "run" | "logout";
export type ActionStatus = "starting" | "running" | "succeeded" | "failed";

export interface AppConfig {
  activeProfileId: string | null;
  codexDesktopPath: string;
  refreshIntervalSeconds: number;
  confirmBeforeSwitch: boolean;
  restartDesktopOnSwitch: boolean;
  autostart: boolean;
}

export interface ProfileUsage {
  profileId: string;
  account: string;
  plan: string | null;
  fiveHourLeft: number | null;
  fiveHourReset: string | null;
  weeklyLeft: number | null;
  weeklyReset: string | null;
  error: string | null;
}

export interface ProfileRecord {
  id: string;
  homePath: string;
  source: "modern" | "legacy";
  auth: {
    email: string | null;
    plan: string | null;
    organization: string | null;
    accountId: string | null;
    accessToken: string | null;
    lastRefresh: string | null;
  } | null;
}

export interface ActionSession {
  id: string;
  kind: ActionKind;
  profileId: string;
  status: ActionStatus;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  message: string;
  recentOutput: string[];
}

export interface SwitchResult {
  activeProfileId: string;
  desktopRestarted: boolean;
  message: string;
}

export interface UpstreamStatus {
  repo: string;
  baseRef: string;
  latestRef: string | null;
  updateAvailable: boolean;
  error: string | null;
}
