import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../lib/app-model";
import type { TrayActionPayload } from "../types/domain";

const nativeMock = vi.hoisted(() => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  listProfileUsage: vi.fn(),
  getCurrentAccountStatus: vi.fn(),
  ensureProfile: vi.fn(),
  renameProfile: vi.fn(),
  startActionSession: vi.fn(),
  sendActionInput: vi.fn(),
  getActionSession: vi.fn(),
  switchProfile: vi.fn(),
  retrySshCodexSync: vi.fn(),
  setTrayTooltip: vi.fn(),
  updateTrayMenuState: vi.fn(),
  onTrayAction: vi.fn(),
  startWindowDrag: vi.fn(),
  hideWindow: vi.fn(),
  checkCdxUpstream: vi.fn(),
  startClaudeLogin: vi.fn(),
  finishClaudeLogin: vi.fn(),
  logoutClaude: vi.fn(),
  getClaudeUsage: vi.fn(),
}));

vi.mock("../lib/native", () => ({
  native: nativeMock,
  isBrowserPreview: false,
}));

describe("useAppController tray actions", () => {
  it("switches profiles from the context menu without opening the confirmation modal", async () => {
    const { useAppController } = await import("../hooks/useAppController");
    const config = { ...defaultConfig, activeProfileId: "main", restartDesktopOnSwitch: true, confirmBeforeSwitch: true };
    const rows = [
      { profileId: "main", account: "main@example.com", plan: null, fiveHourLeft: 50, fiveHourReset: null, weeklyLeft: 60, weeklyReset: null, error: null },
      { profileId: "work", account: "work@example.com", plan: null, fiveHourLeft: 70, fiveHourReset: null, weeklyLeft: 80, weeklyReset: null, error: null },
    ];

    nativeMock.getConfig.mockResolvedValue(config);
    nativeMock.saveConfig.mockImplementation(async (nextConfig) => nextConfig);
    nativeMock.listProfileUsage.mockResolvedValue(rows);
    nativeMock.getCurrentAccountStatus.mockResolvedValue(null);
    nativeMock.checkCdxUpstream.mockResolvedValue({ repo: "repo", baseRef: "v0", latestRef: null, updateAvailable: false, error: null });
    nativeMock.switchProfile.mockResolvedValue({
      activeProfileId: "work",
      desktopRestarted: true,
      windows: { ok: true, message: "switched" },
      desktop: { requested: true, ok: true, restarted: true, message: "restarted" },
      ssh: { enabled: false, ok: null, stage: "disabled", message: null },
      message: "switched",
    });
    nativeMock.setTrayTooltip.mockResolvedValue(undefined);
    nativeMock.updateTrayMenuState.mockResolvedValue(undefined);
    nativeMock.onTrayAction.mockResolvedValue(() => {});

    function Harness() {
      useAppController();
      return null;
    }

    render(<Harness />);

    await waitFor(() => expect(nativeMock.onTrayAction).toHaveBeenCalled());
    await waitFor(() => expect(nativeMock.listProfileUsage).toHaveBeenCalled());

    const handler = nativeMock.onTrayAction.mock.calls[0][0] as (payload: TrayActionPayload) => void;
    await act(async () => {
      handler({ action: "switchProfile", profileId: "work" });
    });

    await waitFor(() => expect(nativeMock.switchProfile).toHaveBeenCalledWith("work", expect.objectContaining({ activeProfileId: "work", restartDesktopOnSwitch: true })));
    expect(nativeMock.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ activeProfileId: "work" }));
  });
});
