import { AlertTriangle, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProfilePanel } from "./components/ProfilePanel";
import { SessionPanel } from "./components/SessionPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";
import { UsageTable } from "./components/UsageTable";
import { activeProfile, defaultConfig, trayLabel } from "./lib/app-model";
import { isBrowserPreview, native } from "./lib/native";
import type { ActionKind, ActionSession, AppConfig, ProfileUsage, UpstreamStatus } from "./types/domain";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [draftConfig, setDraftConfig] = useState<AppConfig>(defaultConfig);
  const [profiles, setProfiles] = useState<ProfileUsage[]>([]);
  const [session, setSession] = useState<ActionSession | null>(null);
  const [upstream, setUpstream] = useState<UpstreamStatus | null>(null);
  const [newProfileId, setNewProfileId] = useState("work");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<ProfileUsage | null>(null);

  const selected = useMemo(() => activeProfile(config, profiles), [config, profiles]);

  async function refreshUsage() {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await native.listProfileUsage();
      setProfiles(rows);
      setLastUpdated(new Date().toISOString());
      await native.setTrayTooltip(trayLabel(activeProfile(config, rows)));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void native.getConfig().then((loaded) => {
      setConfig(loaded);
      setDraftConfig(loaded);
    });
    void native.checkCdxUpstream().then(setUpstream);
  }, []);

  useEffect(() => {
    void refreshUsage();
    const timer = window.setInterval(() => void refreshUsage(), config.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [config.refreshIntervalSeconds]);

  useEffect(() => {
    if (!session || session.finishedAt) {
      return;
    }
    const timer = window.setInterval(async () => {
      const next = await native.getActionSession(session.id);
      if (next) {
        setSession(next);
        if (next.finishedAt) {
          void refreshUsage();
        }
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.finishedAt]);

  async function saveSettings() {
    const saved = await native.saveConfig(draftConfig);
    setConfig(saved);
    setDraftConfig(saved);
    setMessage("설정을 저장했습니다.");
  }

  async function selectProfile(profile: ProfileUsage, confirmed = false) {
    const nextConfig = { ...config, activeProfileId: profile.profileId };
    if (config.restartDesktopOnSwitch && config.confirmBeforeSwitch && !confirmed) {
      setPendingProfile(profile);
      return;
    }
    setConfig(await native.saveConfig(nextConfig));
    await native.switchProfile(profile.profileId, nextConfig).then((result) => setMessage(result.message));
    await native.setTrayTooltip(trayLabel(profile));
    setPendingProfile(null);
  }

  async function startAction(kind: ActionKind, profileId: string) {
    const id = profileId.trim();
    if (!id) {
      setError("프로필 이름이 필요합니다.");
      return;
    }
    setError(null);
    setSession(await native.startActionSession(kind, id));
  }

  async function sendSessionInput(input: string) {
    if (!session) return;
    await native.sendActionInput(session.id, input);
  }

  return (
    <main className="tray-shell">
      <StatusBar
        activeProfile={selected}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        settingsOpen={settingsOpen}
        onRefresh={() => void refreshUsage()}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
      />

      {message && <div className="notice notice--ok">{message}</div>}
      {isBrowserPreview && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>브라우저 preview 모드입니다. Login/Run/Logout과 트레이 기능은 Tauri 앱에서만 실제 실행됩니다.</span>
        </div>
      )}
      {error && (
        <div className="notice notice--error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {settingsOpen ? (
        <SettingsPanel config={draftConfig} upstream={upstream} onChange={setDraftConfig} onSave={() => void saveSettings()} />
      ) : (
        <>
          <ProfilePanel
            profiles={profiles}
            activeProfileId={selected?.profileId ?? null}
            loading={loading}
            newProfileId={newProfileId}
            onNewProfileIdChange={setNewProfileId}
            onSelect={(profile) => void selectProfile(profile)}
            onAction={(kind, profileId) => void startAction(kind, profileId)}
          />
          <SessionPanel session={session} onSendInput={(input) => void sendSessionInput(input)} />
          <UsageTable profiles={profiles} resetAt={selected?.fiveHourReset ?? null} />
          <section className="panel">
            <div className="section-title">
              <h2>확장 Provider</h2>
              <span>준비됨</span>
            </div>
            <div className="provider-row">
              <Power size={15} />
              <span>Claude 사용량</span>
              <small>disabled placeholder</small>
            </div>
          </section>
        </>
      )}

      {pendingProfile && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h3>Codex Desktop을 재시작할까요?</h3>
            <p>{pendingProfile.profileId}로 활성 프로필을 바꾸고 Codex Desktop을 종료한 뒤 다시 실행합니다.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingProfile(null)}>취소</button>
              <button className="danger-button" type="button" onClick={() => void selectProfile(pendingProfile, true)}>재시작</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
