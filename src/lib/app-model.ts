import type { AppConfig, ProfileUsage } from "../types/domain";

export const defaultConfig: AppConfig = {
  activeProfileId: null,
  codexCliPath: "",
  codexDesktopPath: "",
  refreshIntervalSeconds: 60,
  confirmBeforeSwitch: true,
  restartDesktopOnSwitch: false,
  autostart: false,
  maskEmails: true,
  showSessionLogs: false,
  claudeEnabled: false,
  claudeCliPath: "",
  hiddenProfileIds: [],
};

export function normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    ...defaultConfig,
    ...config,
    hiddenProfileIds: config?.hiddenProfileIds ?? defaultConfig.hiddenProfileIds,
  };
}

export function activeProfile(config: AppConfig, profiles: ProfileUsage[]) {
  return profiles.find((profile) => profile.profileId === config.activeProfileId) ?? profiles[0] ?? null;
}

export function trayMenuState(config: AppConfig, profiles: ProfileUsage[]) {
  return {
    activeProfileId: activeProfile(config, profiles)?.profileId ?? null,
    profiles: profiles.map((profile) => ({
      profileId: profile.profileId,
      fiveHourLeft: profile.fiveHourLeft,
      weeklyLeft: profile.weeklyLeft,
    })),
  };
}

export function trayLabel(profile: ProfileUsage | null) {
  return profile?.fiveHourLeft == null ? "cdx-swap --%" : `cdx-swap ${profile.fiveHourLeft}%`;
}

export function isProfileHidden(config: AppConfig, profileId: string) {
  return config.hiddenProfileIds.includes(profileId);
}

export function toggleHiddenProfile(config: AppConfig, profileId: string) {
  const hidden = new Set(config.hiddenProfileIds);
  if (hidden.has(profileId)) {
    hidden.delete(profileId);
  } else {
    hidden.add(profileId);
  }
  return { ...config, hiddenProfileIds: [...hidden].sort() };
}

export function displayAccount(account: string, maskEmails: boolean) {
  if (!maskEmails || !account.includes("@")) return account;
  const [name, domain] = account.split("@");
  if (!name || !domain) return account;
  return `${name.slice(0, 2)}****@${domain}`;
}
