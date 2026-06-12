import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../lib/app-model";
import { TrayPanel } from "../views/TrayPanel";
import type { AppController } from "../hooks/useAppController";
import type { ClaudeUsageStatus, ProfileUsage } from "../types/domain";

const mainProfile: ProfileUsage = {
  profileId: "main",
  account: "main@example.com",
  plan: "plus",
  fiveHourLeft: 50,
  fiveHourReset: null,
  weeklyLeft: 60,
  weeklyReset: null,
  error: null,
};

const claudeUsage: ClaudeUsageStatus = {
  ok: true,
  authenticated: true,
  source: "anthropic_oauth_usage",
  credentialSource: "preview",
  fiveHour: { utilization: 42, resetsAt: null },
  sevenDay: { utilization: 64, resetsAt: null },
  error: null,
  message: null,
  fetchedAt: "1",
};

function controller(overrides: Partial<AppController> = {}) {
  return {
    view: "dashboard",
    config: { ...defaultConfig, claudeEnabled: true },
    draftConfig: { ...defaultConfig, claudeEnabled: true },
    profiles: [mainProfile],
    session: null,
    upstream: null,
    currentAccountStatus: null,
    claudeUsage,
    claudeOAuthCode: "",
    claudeBusy: false,
    selected: mainProfile,
    newProfileId: "work",
    loading: false,
    refreshing: false,
    lastUpdated: null,
    error: null,
    pendingProfile: null,
    setView: vi.fn(),
    showDashboard: vi.fn(),
    showSettings: vi.fn(),
    toggleSettingsView: vi.fn(),
    setDraftConfig: vi.fn(),
    setNewProfileId: vi.fn(),
    setClaudeOAuthCode: vi.fn(),
    refreshUsage: vi.fn(),
    refreshClaudeUsage: vi.fn(),
    saveSettings: vi.fn(),
    selectProfile: vi.fn(),
    startAction: vi.fn(),
    sendSessionInput: vi.fn(),
    startClaudeLogin: vi.fn(),
    finishClaudeLogin: vi.fn(),
    logoutClaude: vi.fn(),
    toggleProfileVisibility: vi.fn(),
    hideWindow: vi.fn(),
    startWindowDrag: vi.fn(),
    cancelPendingProfile: vi.fn(),
    confirmPendingProfile: vi.fn(),
    ...overrides,
  } as unknown as AppController;
}

describe("TrayPanel buttons", () => {
  it("wires dashboard Codex actions to the controller", () => {
    const c = controller();
    render(<TrayPanel {...c} />);

    fireEvent.click(screen.getByLabelText("Refresh"));
    fireEvent.click(screen.getByLabelText("Settings"));
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(screen.getAllByText("Login")[0]);
    fireEvent.click(screen.getByText("Run"));
    fireEvent.click(screen.getByText("Logout"));
    fireEvent.click(screen.getByLabelText("main 로그아웃"));
    fireEvent.click(screen.getByLabelText("Claude 사용량 조회"));

    expect(c.refreshUsage).toHaveBeenCalled();
    expect(c.toggleSettingsView).toHaveBeenCalled();
    expect(c.hideWindow).toHaveBeenCalled();
    expect(c.startAction).toHaveBeenCalledWith("login", "main");
    expect(c.startAction).toHaveBeenCalledWith("run", "main");
    expect(c.startAction).toHaveBeenCalledWith("logout", "main");
    expect(c.refreshClaudeUsage).toHaveBeenCalled();
  });

  it("wires Claude settings actions and save", () => {
    const c = controller({ view: "settings" });
    render(<TrayPanel {...c} />);

    fireEvent.click(screen.getByText("조회"));
    fireEvent.click(screen.getByText("로그인"));
    fireEvent.change(screen.getByPlaceholderText("Claude 브라우저 로그인 후 code 붙여넣기"), {
      target: { value: "oauth-code" },
    });
    fireEvent.click(screen.getByText("완료"));
    fireEvent.click(screen.getByText("로그아웃"));
    fireEvent.click(screen.getByText("저장"));

    expect(c.refreshClaudeUsage).toHaveBeenCalled();
    expect(c.startClaudeLogin).toHaveBeenCalled();
    expect(c.setClaudeOAuthCode).toHaveBeenCalledWith("oauth-code");
    expect(c.finishClaudeLogin).toHaveBeenCalled();
    expect(c.logoutClaude).toHaveBeenCalled();
    expect(c.saveSettings).toHaveBeenCalled();
  });

  it("wires the restart confirmation modal buttons", () => {
    const c = controller({ pendingProfile: mainProfile });
    render(<TrayPanel {...c} />);

    fireEvent.click(screen.getByText("취소"));
    fireEvent.click(screen.getByText("재시작"));

    expect(c.cancelPendingProfile).toHaveBeenCalled();
    expect(c.confirmPendingProfile).toHaveBeenCalled();
  });
});
