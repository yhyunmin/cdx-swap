import { describe, expect, it } from "vitest";
import { activeProfile, defaultConfig, trayLabel } from "../lib/app-model";
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
    expect(trayLabel(profiles[0])).toBe("Codex 35%");
    expect(trayLabel(null)).toBe("Codex --%");
  });
});
