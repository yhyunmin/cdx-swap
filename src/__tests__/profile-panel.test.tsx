import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePanel } from "../components/ProfilePanel";
import { SessionPanel } from "../components/SessionPanel";

describe("ProfilePanel", () => {
  it("shows login/run/logout actions for each profile", () => {
    render(
      <ProfilePanel
        profiles={[{ profileId: "main", account: "main@example.com", plan: null, fiveHourLeft: 50, fiveHourReset: null, weeklyLeft: 60, weeklyReset: null, error: null }]}
        activeProfileId="main"
        hiddenProfileIds={[]}
        maskEmails={false}
        loading={false}
        newProfileId="work"
        onNewProfileIdChange={vi.fn()}
        onSelect={vi.fn()}
        onAction={vi.fn()}
        onToggleHidden={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Login")).toHaveLength(2);
    expect(screen.getByText("Run")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("shows the new profile login entry when no profiles exist", () => {
    render(
      <ProfilePanel
        profiles={[]}
        activeProfileId={null}
        hiddenProfileIds={[]}
        maskEmails={false}
        loading={false}
        newProfileId="work"
        onNewProfileIdChange={vi.fn()}
        onSelect={vi.fn()}
        onAction={vi.fn()}
        onToggleHidden={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("new-profile")).toBeInTheDocument();
    expect(screen.getByText(/새 프로필 이름/)).toBeInTheDocument();
  });

  it("toggles profile visibility without starting a login action", () => {
    const onAction = vi.fn();
    const onToggleHidden = vi.fn();
    render(
      <ProfilePanel
        profiles={[{ profileId: "main", account: "main@example.com", plan: null, fiveHourLeft: 50, fiveHourReset: null, weeklyLeft: 60, weeklyReset: null, error: null }]}
        activeProfileId="main"
        hiddenProfileIds={[]}
        maskEmails={false}
        loading={false}
        newProfileId="work"
        onNewProfileIdChange={vi.fn()}
        onSelect={vi.fn()}
        onAction={onAction}
        onToggleHidden={onToggleHidden}
      />,
    );

    fireEvent.click(screen.getByLabelText("main 숨기기"));
    expect(onToggleHidden).toHaveBeenCalledWith("main");
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("SessionPanel", () => {
  it("sends input for a running session", () => {
    const onSendInput = vi.fn();
    render(
      <SessionPanel
        session={{
          id: "login-main",
          kind: "login",
          profileId: "main",
          status: "running",
          startedAt: "1",
          finishedAt: null,
          exitCode: null,
          message: "waiting",
          recentOutput: ["waiting"],
        }}
        onSendInput={onSendInput}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("세션 입력"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("Send"));
    expect(onSendInput).toHaveBeenCalledWith("123456");
  });
});
