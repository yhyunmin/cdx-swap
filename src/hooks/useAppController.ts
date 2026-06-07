import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  activeProfile,
  defaultConfig,
  lowQuotaAlerts,
  normalizeConfig,
  toggleHiddenProfile,
  trayLabel,
  trayMenuState,
} from "../lib/app-model";
import { native } from "../lib/native";
import type { ActionKind, ActionSession, AppConfig, ProfileUsage, TrayActionPayload, UpstreamStatus } from "../types/domain";

type PanelView = "dashboard" | "settings";

const actionSuccessText: Record<ActionKind, string> = {
  login: "로그인 성공",
  run: "실행 완료",
  logout: "로그아웃 완료",
};

export function useAppController() {
  const [view, setView] = useState<PanelView>("dashboard");
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [draftConfig, setDraftConfig] = useState<AppConfig>(defaultConfig);
  const [profiles, setProfiles] = useState<ProfileUsage[]>([]);
  const [session, setSession] = useState<ActionSession | null>(null);
  const [upstream, setUpstream] = useState<UpstreamStatus | null>(null);
  const [newProfileId, setNewProfileId] = useState("work");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<ProfileUsage | null>(null);
  const notifiedSessions = useRef(new Set<string>());
  const notifiedLowQuota = useRef(new Set<string>());

  const selected = useMemo(() => activeProfile(config, profiles), [config, profiles]);
  const visibleSession = config.showSessionLogs ? session : null;

  const publishTrayState = useCallback(async (nextConfig: AppConfig, rows: ProfileUsage[]) => {
    await native.setTrayTooltip(trayLabel(activeProfile(nextConfig, rows)));
    await native.updateTrayMenuState(trayMenuState(nextConfig, rows));
  }, []);

  const notifySessionComplete = useCallback(
    (next: ActionSession) => {
      if (!next.finishedAt || notifiedSessions.current.has(next.id)) {
        return;
      }
      notifiedSessions.current.add(next.id);
      if (next.status === "succeeded") {
        toast.success(actionSuccessText[next.kind]);
      } else {
        toast.error(next.message || `${next.kind} 실패`);
      }
    },
    [],
  );

  const notifyLowQuota = useCallback((rows: ProfileUsage[]) => {
    const alerts = lowQuotaAlerts(rows);
    const currentKeys = new Set(alerts.map((alert) => alert.key));
    for (const key of notifiedLowQuota.current) {
      if (!currentKeys.has(key)) {
        notifiedLowQuota.current.delete(key);
      }
    }
    for (const alert of alerts) {
      if (notifiedLowQuota.current.has(alert.key)) {
        continue;
      }
      notifiedLowQuota.current.add(alert.key);
      toast.warning(`${alert.profileId} ${alert.label} 잔여량 ${alert.value}%`);
    }
  }, []);

  const refreshUsage = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await native.listProfileUsage();
      setProfiles(rows);
      setLastUpdated(new Date().toISOString());
      notifyLowQuota(rows);
      await publishTrayState(config, rows);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config, notifyLowQuota, publishTrayState]);

  const saveConfig = useCallback(
    async (nextConfig: AppConfig) => {
      const saved = normalizeConfig(await native.saveConfig(nextConfig));
      setConfig(saved);
      setDraftConfig(saved);
      await publishTrayState(saved, profiles);
      return saved;
    },
    [profiles, publishTrayState],
  );

  const saveSettings = useCallback(async () => {
    try {
      await saveConfig(draftConfig);
      toast.success("설정을 저장했습니다.");
      setView("dashboard");
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    }
  }, [draftConfig, saveConfig]);

  const selectProfile = useCallback(
    async (profile: ProfileUsage, confirmed = false) => {
      const nextConfig = { ...config, activeProfileId: profile.profileId };
      if (config.restartDesktopOnSwitch && config.confirmBeforeSwitch && !confirmed) {
        setPendingProfile(profile);
        return;
      }

      try {
        const saved = await saveConfig(nextConfig);
        const result = await native.switchProfile(profile.profileId, saved);
        toast.message(result.message);
        setPendingProfile(null);
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [config, saveConfig],
  );

  const startAction = useCallback(
    async (kind: ActionKind, profileId: string) => {
      const id = profileId.trim();
      if (!id) {
        setError("프로필 이름이 필요합니다.");
        return;
      }
      setError(null);
      try {
        const next = await native.startActionSession(kind, id, config);
        setSession(next);
        notifySessionComplete(next);
        if (next.finishedAt) {
          void refreshUsage();
        }
        if (next.finishedAt && !config.showSessionLogs) {
          setSession(null);
        }
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [config, notifySessionComplete, refreshUsage],
  );

  const sendSessionInput = useCallback(
    async (input: string) => {
      if (!session) return;
      await native.sendActionInput(session.id, input);
    },
    [session],
  );

  const toggleProfileVisibility = useCallback(
    async (profileId: string) => {
      try {
        await saveConfig(toggleHiddenProfile(config, profileId));
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [config, saveConfig],
  );

  const selectProfileById = useCallback(
    async (profileId: string) => {
      const profile = profiles.find((row) => row.profileId === profileId);
      if (profile) {
        await selectProfile(profile);
      }
    },
    [profiles, selectProfile],
  );

  useEffect(() => {
    let alive = true;
    void native.getConfig().then((loaded) => {
      if (!alive) return;
      const next = normalizeConfig(loaded);
      setConfig(next);
      setDraftConfig(next);
    });
    void native.checkCdxUpstream().then((status) => {
      if (alive) setUpstream(status);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void refreshUsage();
    const interval = Math.max(15, config.refreshIntervalSeconds) * 1000;
    const timer = window.setInterval(() => void refreshUsage(), interval);
    return () => window.clearInterval(timer);
  }, [config.refreshIntervalSeconds, refreshUsage]);

  useEffect(() => {
    if (!session?.id || session.finishedAt) {
      return;
    }
    const sessionId = session.id;
    const timer = window.setInterval(async () => {
      const next = await native.getActionSession(sessionId);
      if (!next) return;
      setSession(next);
      if (next.finishedAt) {
        notifySessionComplete(next);
        if (!config.showSessionLogs) {
          setSession(null);
        }
        void refreshUsage();
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [config.showSessionLogs, notifySessionComplete, refreshUsage, session?.finishedAt, session?.id]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    const handleTrayAction = (payload: TrayActionPayload) => {
      if (payload.action === "open") setView("dashboard");
      if (payload.action === "settings") setView("settings");
      if (payload.action === "refresh") void refreshUsage();
      if (payload.action === "switchProfile" && payload.profileId) {
        void selectProfileById(payload.profileId);
      }
    };

    void native.onTrayAction(handleTrayAction).then((dispose) => {
      if (cancelled) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshUsage, selectProfileById]);

  return {
    view,
    config,
    draftConfig,
    profiles,
    session: visibleSession,
    upstream,
    selected,
    newProfileId,
    loading,
    refreshing,
    lastUpdated,
    error,
    pendingProfile,
    setView,
    setDraftConfig,
    setNewProfileId,
    refreshUsage,
    saveSettings,
    selectProfile,
    startAction,
    sendSessionInput,
    toggleProfileVisibility,
    hideWindow: native.hideWindow,
    startWindowDrag: native.startWindowDrag,
    cancelPendingProfile: () => setPendingProfile(null),
  };
}

export type AppController = ReturnType<typeof useAppController>;
