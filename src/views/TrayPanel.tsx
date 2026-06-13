import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { ClaudeUsagePanel } from "../components/ClaudeUsagePanel";
import { PanelChrome } from "../components/PanelChrome";
import { ProfilePanel } from "../components/ProfilePanel";
import { SessionPanel } from "../components/SessionPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { StatusBar } from "../components/StatusBar";
import { UsageTable } from "../components/UsageTable";
import { isBrowserPreview } from "../lib/native";
import type { AppController } from "../hooks/useAppController";

export function TrayPanel(controller: AppController) {
  const handleRefresh = useCallback(() => {
    void controller.refreshUsage();
  }, [controller.refreshUsage]);

  const handleSaveSettings = useCallback(() => {
    void controller.saveSettings();
  }, [controller.saveSettings]);

  const handleRefreshClaudeUsage = useCallback(() => {
    void controller.refreshClaudeUsage();
  }, [controller.refreshClaudeUsage]);

  const handleClaudeLoginStart = useCallback(() => {
    void controller.startClaudeLogin();
  }, [controller.startClaudeLogin]);

  const handleClaudeLoginFinish = useCallback(() => {
    void controller.finishClaudeLogin();
  }, [controller.finishClaudeLogin]);

  const handleClaudeLogout = useCallback(() => {
    void controller.logoutClaude();
  }, [controller.logoutClaude]);

  const handleSelectProfile = useCallback(
    (profile: Parameters<AppController["selectProfile"]>[0]) => {
      void controller.selectProfile(profile);
    },
    [controller.selectProfile],
  );

  const handleAction = useCallback(
    (kind: Parameters<AppController["startAction"]>[0], profileId: string) => {
      void controller.startAction(kind, profileId);
    },
    [controller.startAction],
  );

  const handleToggleHidden = useCallback(
    (profileId: string) => {
      void controller.toggleProfileVisibility(profileId);
    },
    [controller.toggleProfileVisibility],
  );

  const handleRename = useCallback(
    (profile: Parameters<AppController["openRenameDialog"]>[0]) => {
      controller.openRenameDialog(profile);
    },
    [controller.openRenameDialog],
  );

  const handleLogout = useCallback(
    (profileId: string) => {
      void controller.startAction("logout", profileId);
    },
    [controller.startAction],
  );

  const handleSendSessionInput = useCallback(
    (input: string) => {
      void controller.sendSessionInput(input);
    },
    [controller.sendSessionInput],
  );

  const handleConfirmPendingProfile = useCallback(() => {
    void controller.confirmPendingProfile();
  }, [controller.confirmPendingProfile]);

  return (
    <PanelChrome onClose={() => void controller.hideWindow()} onStartDrag={() => void controller.startWindowDrag()}>
      <StatusBar
        activeProfile={controller.selected}
        lastUpdated={controller.lastUpdated}
        refreshing={controller.refreshing}
        settingsOpen={controller.view === "settings"}
        onRefresh={handleRefresh}
        onToggleSettings={controller.toggleSettingsView}
      />

      {isBrowserPreview && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>브라우저 preview 모드입니다. Login/Run/Logout과 트레이 기능은 Tauri 앱에서만 실제 실행됩니다.</span>
        </div>
      )}
      {controller.error && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>{controller.error}</span>
        </div>
      )}
      {controller.desktopStatus?.ok === false && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>{controller.desktopStatus.message ?? "Codex Desktop 재시작에 실패했습니다."}</span>
        </div>
      )}
      {controller.sshStatus?.enabled && controller.sshStatus.ok === false && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>{controller.sshStatus.message ?? "SSH Codex 동기화에 실패했습니다."}</span>
          <button
            className="icon-button icon-button--sm tooltip-trigger"
            type="button"
            onClick={() => void controller.retrySshCodexSync()}
            aria-label="SSH Codex 다시 동기화"
            data-tooltip="SSH 다시 동기화"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}
      {controller.sshStatus?.enabled && controller.sshStatus.ok === true && (
        <div className="notice notice--ok">
          <CheckCircle2 size={16} />
          <span>{controller.sshStatus.message ?? "SSH Codex synced."}</span>
        </div>
      )}
      {controller.currentAccountStatus && !controller.currentAccountStatus.registered && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>
            현재 로그인한 Codex 계정은 프로필에 등록되지 않은 계정입니다
            {controller.currentAccountStatus.account ? `: ${controller.currentAccountStatus.account}` : "."}
          </span>
        </div>
      )}

      {controller.view === "settings" ? (
        <SettingsPanel
          config={controller.draftConfig}
          claudeUsage={controller.claudeUsage}
          claudeOAuthCode={controller.claudeOAuthCode}
          claudeBusy={controller.claudeBusy}
          upstream={controller.upstream}
          onChange={controller.setDraftConfig}
          onClaudeOAuthCodeChange={controller.setClaudeOAuthCode}
          onClaudeLoginStart={handleClaudeLoginStart}
          onClaudeLoginFinish={handleClaudeLoginFinish}
          onClaudeLogout={handleClaudeLogout}
          onRefreshClaudeUsage={handleRefreshClaudeUsage}
          onSave={handleSaveSettings}
        />
      ) : (
        <>
          <UsageTable
            profiles={controller.profiles}
            config={controller.config}
            activeProfileId={controller.selected?.profileId ?? null}
            onSelect={handleSelectProfile}
            onAction={handleAction}
            onRename={handleRename}
            onToggleHidden={handleToggleHidden}
            onLogout={handleLogout}
          />
          <ProfilePanel loading={controller.loading} onOpenLoginDialog={controller.openProfileLoginDialog} />
          <SessionPanel session={controller.session} onSendInput={handleSendSessionInput} />
          {controller.config.claudeEnabled && (
            <ClaudeUsagePanel usage={controller.claudeUsage} refreshing={controller.claudeBusy} onRefresh={handleRefreshClaudeUsage} />
          )}
        </>
      )}

      {controller.profileLoginDialogOpen && (
        <div className="modal-backdrop">
          <form
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-login-title"
            onSubmit={(event) => {
              event.preventDefault();
              void controller.submitProfileLogin();
            }}
          >
            <h3 id="profile-login-title">프로필 로그인</h3>
            <label className="dialog-field">
              <span>프로필 이름</span>
              <input
                autoFocus
                value={controller.profileLoginName}
                onChange={(event) => controller.setProfileLoginName(event.target.value)}
                placeholder="work"
              />
            </label>
            {controller.profileLoginError && <p className="dialog-error">{controller.profileLoginError}</p>}
            <div className="modal-actions">
              <button type="button" onClick={controller.closeProfileLoginDialog}>
                취소
              </button>
              <button className="primary-button" type="submit">
                로그인
              </button>
            </div>
          </form>
        </div>
      )}

      {controller.renameDialog && (
        <div className="modal-backdrop">
          <form
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-rename-title"
            onSubmit={(event) => {
              event.preventDefault();
              void controller.submitRenameProfile();
            }}
          >
            <h3 id="profile-rename-title">프로필 이름 변경</h3>
            <label className="dialog-field">
              <span>새 이름</span>
              <input
                autoFocus
                value={controller.renameDialog.value}
                onChange={(event) => controller.setRenameValue(event.target.value)}
                placeholder="codex-work"
              />
            </label>
            {controller.renameDialog.error && <p className="dialog-error">{controller.renameDialog.error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={controller.closeRenameDialog}>
                취소
              </button>
              <button className="primary-button" type="submit">
                변경
              </button>
            </div>
          </form>
        </div>
      )}

      {controller.pendingProfile && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h3>계정 전환</h3>
            <p>{controller.pendingProfile.profileId}로 활성 프로필을 바꿉니다. 설정 또는 Run 요청에 따라 Codex Desktop이 재시작될 수 있습니다.</p>
            <div className="modal-actions">
              <button type="button" onClick={controller.cancelPendingProfile}>
                취소
              </button>
              <button className="primary-button" type="button" onClick={handleConfirmPendingProfile}>
                전환
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelChrome>
  );
}
