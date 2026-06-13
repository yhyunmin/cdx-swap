import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePanel } from "../components/ProfilePanel";
import { SessionPanel } from "../components/SessionPanel";

describe("ProfilePanel", () => {
  it("opens the profile login dialog from the icon-only action", () => {
    const onOpenLoginDialog = vi.fn();
    render(<ProfilePanel loading={false} onOpenLoginDialog={onOpenLoginDialog} />);

    fireEvent.click(screen.getByLabelText("프로필 로그인 추가"));
    expect(onOpenLoginDialog).toHaveBeenCalled();
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });

  it("disables the login action while profiles are loading", () => {
    render(<ProfilePanel loading={true} onOpenLoginDialog={vi.fn()} />);

    expect(screen.getByLabelText("프로필 로그인 추가")).toBeDisabled();
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
