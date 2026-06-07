import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const configRef = useRef(config);
  const profilesRef = useRef(profiles);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const pendingForceRestart = useRef(false);

  const selected = useMemo(() => activeProfile(config, profiles), [config, profiles]);
  const visibleSession = config.showSessionLogs ? session : null;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

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
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }
    const refresh = (async () => {
      setRefreshing(true);
      setError(null);
      try {
        const rows = await native.listProfileUsage();
        profilesRef.current = rows;
        setProfiles(rows);
        setLastUpdated(new Date().toISOString());
        notifyLowQuota(rows);
        await publishTrayState(configRef.current, rows);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = refresh;
    return refresh;
  }, [notifyLowQuota, publishTrayState]);

  const saveConfig = useCallback(
    async (nextConfig: AppConfig) => {
      const saved = normalizeConfig(await native.saveConfig(nextConfig));
      configRef.current = saved;
      setConfig(saved);
      setDraftConfig(saved);
      await publishTrayState(saved, profilesRef.current);
      return saved;
    },
    [publishTrayState],
  );

  const saveSettings = useCallback(async () => {
    try {
      await saveConfig(draftConfig);
      toast.success("설정을 저장했습니다.");
      startTransition(() => setView("dashboard"));
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    }
  }, [draftConfig, saveConfig]);

  const selectProfile = useCallback(
    async (profile: ProfileUsage, confirmed = false, forceRestart = false) => {
      const currentConfig = configRef.current;
      const nextConfig = { ...currentConfig, activeProfileId: profile.profileId };
      const shouldRestartDesktop = forceRestart || currentConfig.restartDesktopOnSwitch;
      if (shouldRestartDesktop && currentConfig.confirmBeforeSwitch && !confirmed) {
        pendingForceRestart.current = forceRestart;
        setPendingProfile(profile);
        return;
      }

      try {
        const switchConfig = shouldRestartDesktop ? { ...nextConfig, restartDesktopOnSwitch: true } : nextConfig;
        const result = await native.switchProfile(profile.profileId, switchConfig);
        await saveConfig(nextConfig);
        toast.message(result.message);
        pendingForceRestart.current = false;
        setPendingProfile(null);
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [saveConfig],
  );

  const runProfileById = useCallback(
    async (profileId: string) => {
      const profile = profilesRef.current.find((row) => row.profileId === profileId);
      if (!profile) {
        const message = `Unknown profile: ${profileId}`;
        setError(message);
        toast.error(message);
        return;
      }
      await selectProfile(profile, false, true);
    },
    [selectProfile],
  );

  const selectProfileById = useCallback(
    async (profileId: string) => {
      const profile = profilesRef.current.find((row) => row.profileId === profileId);
      if (profile) {
        await selectProfile(profile);
      }
    },
    [selectProfile],
  );

  const startAction = useCallback(
    async (kind: ActionKind, profileId: string) => {
      const id = profileId.trim();
      if (!id) {
        setError("프로필 이름이 필요합니다.");
        return;
      }
      setError(null);
      if (kind === "run") {
        await runProfileById(id);
        return;
      }
      try {
        const next = await native.startActionSession(kind, id, configRef.current);
        setSession(next);
        notifySessionComplete(next);
        if (next.finishedAt) {
          void refreshUsage();
        }
        if (next.finishedAt && !configRef.current.showSessionLogs) {
          setSession(null);
        }
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [notifySessionComplete, refreshUsage, runProfileById],
  );

  const confirmPendingProfile = useCallback(async () => {
    if (!pendingProfile) return;
    await selectProfile(pendingProfile, true, pendingForceRestart.current);
  }, [pendingProfile, selectProfile]);

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
        await saveConfig(toggleHiddenProfile(configRef.current, profileId));
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
      }
    },
    [saveConfig],
  );

  const showDashboard = useCallback(() => {
    startTransition(() => setView("dashboard"));
  }, []);

  const showSettings = useCallback(() => {
    startTransition(() => setView("settings"));
  }, []);

  const toggleSettingsView = useCallback(() => {
    startTransition(() => {
      setView((current) => (current === "settings" ? "dashboard" : "settings"));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void native.getConfig().then((loaded) => {
      if (!alive) return;
      const next = normalizeConfig(loaded);
      configRef.current = next;
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
      if (payload.action === "open") showDashboard();
      if (payload.action === "settings") showSettings();
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
  }, [refreshUsage, selectProfileById, showDashboard, showSettings]);

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
    showDashboard,
    showSettings,
    toggleSettingsView,
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
    cancelPendingProfile: () => {
      pendingForceRestart.current = false;
      setPendingProfile(null);
    },
    confirmPendingProfile,
  };
}

export type AppController = ReturnType<typeof useAppController>;
