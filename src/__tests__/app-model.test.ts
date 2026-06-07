import { describe, expect, it } from "vitest";
import {
  activeProfile,
  defaultConfig,
  displayAccount,
  isProfileHidden,
  lowQuotaAlerts,
  toggleHiddenProfile,
  trayLabel,
  trayMenuState,
} from "../lib/app-model";
import type { ProfileUsage } from "../types/domain";

const profiles: ProfileUsage[] = [
  { profileId: "main", account: "main@example.com", plan: "plus", fiveHourLeft: 35, fiveHourReset: null, weeklyLeft: 61, weeklyReset: null, error: null },
  { profileId: "work", account: "work@example.com", plan: "team", fiveHourLeft: 70, fiveHourReset: null, weeklyLeft: 81, weeklyReset: null, error: null },
];

describe("app model", () => {
  it("uses the stored active profile when it exists", () => {
    expect(activeProfile({ ...defaultConfig, activeProfileId: "work" }, profiles)?.profileId).toBe("work");
  });

  it("falls back to the first profile when the stored profile is gone", () => {
    expect(activeProfile({ ...defaultConfig, activeProfileId: "deleted" }, profiles)?.profileId).toBe("main");
  });

  it("formats the tray label from the active 5h usage", () => {
    expect(trayLabel(profiles[0])).toBe("cdx-swap 35%");
    expect(trayLabel(null)).toBe("cdx-swap --%");
  });

  it("builds the native tray menu state from profile usage", () => {
    expect(trayMenuState({ ...defaultConfig, activeProfileId: "work" }, profiles)).toEqual({
      activeProfileId: "work",
      profiles: [
        { profileId: "main", fiveHourLeft: 35, weeklyLeft: 61 },
        { profileId: "work", fiveHourLeft: 70, weeklyLeft: 81 },
      ],
    });
  });

  it("tracks hidden profiles without changing other config", () => {
    const hidden = toggleHiddenProfile(defaultConfig, "main");
    expect(isProfileHidden(hidden, "main")).toBe(true);
    expect(isProfileHidden(toggleHiddenProfile(hidden, "main"), "main")).toBe(false);
  });

  it("masks emails when privacy mode is enabled", () => {
    expect(displayAccount("main@example.com", true)).toBe("ma****@example.com");
    expect(displayAccount("main@example.com", false)).toBe("main@example.com");
  });

  it("reports low quota alerts only below the configured threshold", () => {
    expect(lowQuotaAlerts([{ ...profiles[0], fiveHourLeft: 19, weeklyLeft: 20 }])).toEqual([
      { key: "main:5H", profileId: "main", label: "5H", value: 19 },
    ]);
    expect(lowQuotaAlerts([{ ...profiles[0], fiveHourLeft: 20, weeklyLeft: 19 }])).toEqual([
      { key: "main:Week", profileId: "main", label: "Week", value: 19 },
    ]);
  });
});
