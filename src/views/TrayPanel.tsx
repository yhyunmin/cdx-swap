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
          <button className="icon-button icon-button--sm" type="button" onClick={() => void controller.retrySshCodexSync()} aria-label="SSH Codex 다시 동기화" title="SSH 다시 동기화">
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
          <ProfilePanel
            profiles={controller.profiles}
            activeProfileId={controller.selected?.profileId ?? null}
            hiddenProfileIds={controller.config.hiddenProfileIds}
            maskEmails={controller.config.maskEmails}
            loading={controller.loading}
            newProfileId={controller.newProfileId}
            onNewProfileIdChange={controller.setNewProfileId}
            onSelect={handleSelectProfile}
            onAction={handleAction}
            onToggleHidden={handleToggleHidden}
          />
          <SessionPanel session={controller.session} onSendInput={handleSendSessionInput} />
          <UsageTable
            profiles={controller.profiles}
            config={controller.config}
            resetAt={controller.selected?.fiveHourReset ?? null}
            onToggleHidden={handleToggleHidden}
            onLogout={handleLogout}
          />
          {controller.config.claudeEnabled && (
            <ClaudeUsagePanel usage={controller.claudeUsage} refreshing={controller.claudeBusy} onRefresh={handleRefreshClaudeUsage} />
          )}
        </>
      )}

      {controller.pendingProfile && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h3>Codex Desktop을 재시작할까요?</h3>
            <p>{controller.pendingProfile.profileId}로 활성 프로필을 바꾸고 Codex Desktop을 종료한 뒤 다시 실행합니다.</p>
            <div className="modal-actions">
              <button type="button" onClick={controller.cancelPendingProfile}>
                취소
              </button>
              <button className="danger-button" type="button" onClick={handleConfirmPendingProfile}>
                재시작
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelChrome>
  );
}
