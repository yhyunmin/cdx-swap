import { AlertTriangle } from "lucide-react";
import { PanelChrome } from "../components/PanelChrome";
import { ProfilePanel } from "../components/ProfilePanel";
import { SessionPanel } from "../components/SessionPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { StatusBar } from "../components/StatusBar";
import { UsageTable } from "../components/UsageTable";
import { isBrowserPreview } from "../lib/native";
import type { AppController } from "../hooks/useAppController";

export function TrayPanel(controller: AppController) {
  return (
    <PanelChrome onClose={() => void controller.hideWindow()} onStartDrag={() => void controller.startWindowDrag()}>
      <StatusBar
        activeProfile={controller.selected}
        lastUpdated={controller.lastUpdated}
        refreshing={controller.refreshing}
        settingsOpen={controller.view === "settings"}
        onRefresh={() => void controller.refreshUsage()}
        onToggleSettings={() => controller.setView(controller.view === "settings" ? "dashboard" : "settings")}
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

      {controller.view === "settings" ? (
        <SettingsPanel
          config={controller.draftConfig}
          upstream={controller.upstream}
          onChange={controller.setDraftConfig}
          onSave={() => void controller.saveSettings()}
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
            onSelect={(profile) => void controller.selectProfile(profile)}
            onAction={(kind, profileId) => void controller.startAction(kind, profileId)}
            onToggleHidden={(profileId) => void controller.toggleProfileVisibility(profileId)}
          />
          <SessionPanel session={controller.session} onSendInput={(input) => void controller.sendSessionInput(input)} />
          <UsageTable
            profiles={controller.profiles}
            config={controller.config}
            resetAt={controller.selected?.fiveHourReset ?? null}
            onToggleHidden={(profileId) => void controller.toggleProfileVisibility(profileId)}
            onLogout={(profileId) => void controller.startAction("logout", profileId)}
          />
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
              <button className="danger-button" type="button" onClick={() => void controller.confirmPendingProfile()}>
                재시작
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelChrome>
  );
}
