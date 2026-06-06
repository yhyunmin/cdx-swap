import type { AppConfig, ProfileUsage } from "../types/domain";

export const defaultConfig: AppConfig = {
  activeProfileId: null,
  codexDesktopPath: "",
  refreshIntervalSeconds: 60,
  confirmBeforeSwitch: true,
  restartDesktopOnSwitch: false,
  autostart: false,
};

export function activeProfile(config: AppConfig, profiles: ProfileUsage[]) {
  return profiles.find((profile) => profile.profileId === config.activeProfileId) ?? profiles[0] ?? null;
}

export function trayLabel(profile: ProfileUsage | null) {
  return profile?.fiveHourLeft == null ? "Codex --%" : `Codex ${profile.fiveHourLeft}%`;
}
