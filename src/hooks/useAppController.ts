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
  validateProfileName,
} from "../lib/app-model";
import { native } from "../lib/native";
import type {
  ActionKind,
  ActionSession,
  AppConfig,
  ClaudeUsageStatus,
  CurrentAccountStatus,
  ProfileUsage,
  SshSyncResult,
  SwitchResult,
  TrayActionPayload,
  UpstreamStatus,
} from "../types/domain";

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
  const [currentAccountStatus, setCurrentAccountStatus] = useState<CurrentAccountStatus | null>(null);
  const [sshStatus, setSshStatus] = useState<SshSyncResult | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<SwitchResult["desktop"] | null>(null);
  const [lastSwitchError, setLastSwitchError] = useState<string | null>(null);
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsageStatus | null>(null);
  const [claudeOAuthCode, setClaudeOAuthCode] = useState("");
  const [claudeBusy, setClaudeBusy] = useState(false);
  const [newProfileId, setNewProfileId] = useState("work");
  const [profileLoginDialogOpen, setProfileLoginDialogOpen] = useState(false);
  const [profileLoginName, setProfileLoginName] = useState("work");
  const [profileLoginError, setProfileLoginError] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ profileId: string; value: string; error: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<ProfileUsage | null>(null);
  const notifiedSessions = useRef(new Set<string>());
  const notifiedLowQuota = useRef(new Set<string>());
  const configRef = useRef(config);
  const profilesRef = useRef(profiles);
  const lastSwitchErrorRef = useRef<string | null>(null);
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
    await native.updateTrayMenuState(trayMenuState(nextConfig, rows, lastSwitchErrorRef.current));
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
        const shouldFetchClaude = configRef.current.claudeEnabled;
        const [rows, currentStatus] = await Promise.all([
          native.listProfileUsage(),
          native.getCurrentAccountStatus().catch(() => null),
        ]);
        const nextClaudeUsage = shouldFetchClaude
          ? await native.getClaudeUsage().catch((err) => ({
              ok: false,
              authenticated: false,
              source: "anthropic_oauth_usage",
              credentialSource: null,
              fiveHour: null,
              sevenDay: null,
              error: "usage_request_failed",
              message: String(err),
              fetchedAt: new Date().toISOString(),
            }))
          : null;
        let nextConfig = configRef.current;
        if (nextConfig.activeProfileId && !rows.some((row) => row.profileId === nextConfig.activeProfileId)) {
          nextConfig = normalizeConfig(await native.saveConfig({ ...nextConfig, activeProfileId: null }));
          configRef.current = nextConfig;
          setConfig(nextConfig);
          setDraftConfig(nextConfig);
        }
        profilesRef.current = rows;
        setProfiles(rows);
        setCurrentAccountStatus(currentStatus);
        setClaudeUsage(nextClaudeUsage);
        setLastUpdated(new Date().toISOString());
        notifyLowQuota(rows);
        await publishTrayState(nextConfig, rows);
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
      void refreshUsage();
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    }
  }, [draftConfig, refreshUsage, saveConfig]);

  const selectProfile = useCallback(
    async (profile: ProfileUsage, confirmed = false, forceRestart = false) => {
      const currentConfig = configRef.current;
      if (currentConfig.activeProfileId === profile.profileId && !forceRestart) {
        return true;
      }
      const nextConfig = { ...currentConfig, activeProfileId: profile.profileId };
      const shouldRestartDesktop = forceRestart || currentConfig.restartDesktopOnSwitch;
      if (confirmed) {
        pendingForceRestart.current = false;
        setPendingProfile(null);
      }
      if (currentConfig.confirmBeforeSwitch && !confirmed) {
        pendingForceRestart.current = forceRestart;
        setPendingProfile(profile);
        return true;
      }

      try {
        const switchConfig = shouldRestartDesktop ? { ...nextConfig, restartDesktopOnSwitch: true } : nextConfig;
        const result = await native.switchProfile(profile.profileId, switchConfig);
        setError(null);
        setDesktopStatus(result.desktop);
        setSshStatus(result.ssh);
        const switchWarnings = [result.desktop.ok === false ? result.desktop.message : null, result.ssh.ok === false ? result.ssh.message : null].filter(Boolean) as string[];
        const nextSwitchError = switchWarnings.length ? switchWarnings.join(" ") : null;
        lastSwitchErrorRef.current = nextSwitchError;
        setLastSwitchError(nextSwitchError);
        await saveConfig(nextConfig);
        toast.message(result.message);
        pendingForceRestart.current = false;
        setPendingProfile(null);
        void refreshUsage();
        return true;
      } catch (err) {
        const message = String(err);
        setError(message);
        lastSwitchErrorRef.current = message;
        setLastSwitchError(message);
        await publishTrayState(configRef.current, profilesRef.current).catch(() => undefined);
        toast.error(message);
        return false;
      }
    },
    [publishTrayState, refreshUsage, saveConfig],
  );

  const retrySshCodexSync = useCallback(async () => {
    try {
      const result = await native.retrySshCodexSync(configRef.current);
      setSshStatus(result);
      if (result.ok === false) {
        const message = result.message ?? "SSH Codex 동기화 실패";
        lastSwitchErrorRef.current = message;
        setLastSwitchError(message);
        await publishTrayState(configRef.current, profilesRef.current).catch(() => undefined);
        toast.error(message);
        return;
      }
      lastSwitchErrorRef.current = null;
      setLastSwitchError(null);
      await publishTrayState(configRef.current, profilesRef.current).catch(() => undefined);
      toast.success(result.message ?? "SSH Codex 동기화 완료");
    } catch (err) {
      const message = String(err);
      setError(message);
      lastSwitchErrorRef.current = message;
      setLastSwitchError(message);
      await publishTrayState(configRef.current, profilesRef.current).catch(() => undefined);
      toast.error(message);
    }
  }, [publishTrayState]);

  const runProfileById = useCallback(
    async (profileId: string) => {
      const profile = profilesRef.current.find((row) => row.profileId === profileId);
      if (!profile) {
        const message = `Unknown profile: ${profileId}`;
        setError(message);
        toast.error(message);
        return false;
      }
      return selectProfile(profile, false, true);
    },
    [selectProfile],
  );

  const selectProfileById = useCallback(
    async (profileId: string, confirmed = false) => {
      const profile = profilesRef.current.find((row) => row.profileId === profileId);
      if (profile) {
        await selectProfile(profile, confirmed);
        return;
      }
      const message = `Unknown profile: ${profileId}`;
      setError(message);
      toast.error(message);
    },
    [selectProfile],
  );

  const startAction = useCallback(
    async (kind: ActionKind, profileId: string) => {
      const id = profileId.trim();
      if (!id) {
        setError("프로필 이름이 필요합니다.");
        return false;
      }
      setError(null);
      if (kind === "run") {
        return runProfileById(id);
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
        return next.status !== "failed";
      } catch (err) {
        const message = String(err);
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [notifySessionComplete, refreshUsage, runProfileById],
  );

  const confirmPendingProfile = useCallback(async () => {
    if (!pendingProfile) return;
    await selectProfile(pendingProfile, true, pendingForceRestart.current);
  }, [pendingProfile, selectProfile]);

  const openProfileLoginDialog = useCallback(() => {
    setProfileLoginName(newProfileId);
    setProfileLoginError(null);
    setProfileLoginDialogOpen(true);
  }, [newProfileId]);

  const closeProfileLoginDialog = useCallback(() => {
    setProfileLoginDialogOpen(false);
    setProfileLoginError(null);
  }, []);

  const submitProfileLogin = useCallback(async () => {
    const value = profileLoginName.trim();
    const validation = validateProfileName(
      value,
      profilesRef.current.map((profile) => profile.profileId),
    );
    if (validation) {
      setProfileLoginError(validation);
      return;
    }
    const started = await startAction("login", value);
    if (!started) {
      setProfileLoginError("로그인 시작에 실패했습니다. 화면의 오류 메시지를 확인하세요.");
      return;
    }
    setNewProfileId(value);
    setProfileLoginDialogOpen(false);
    setProfileLoginError(null);
  }, [profileLoginName, startAction]);

  const openRenameDialog = useCallback((profile: ProfileUsage) => {
    setRenameDialog({ profileId: profile.profileId, value: profile.profileId, error: null });
  }, []);

  const closeRenameDialog = useCallback(() => {
    setRenameDialog(null);
  }, []);

  const setRenameValue = useCallback((value: string) => {
    setRenameDialog((current) => (current ? { ...current, value, error: null } : current));
  }, []);

  const submitRenameProfile = useCallback(async () => {
    if (!renameDialog) return;
    const nextProfileId = renameDialog.value.trim();
    const validation = validateProfileName(
      nextProfileId,
      profilesRef.current.map((profile) => profile.profileId),
      renameDialog.profileId,
    );
    if (validation) {
      setRenameDialog((current) => (current ? { ...current, error: validation } : current));
      return;
    }
    try {
      await native.renameProfile(renameDialog.profileId, nextProfileId);
      const nextRows = profilesRef.current.map((profile) =>
        profile.profileId === renameDialog.profileId ? { ...profile, profileId: nextProfileId } : profile,
      );
      profilesRef.current = nextRows;
      setProfiles(nextRows);
      const currentConfig = configRef.current;
      const nextConfig = {
        ...currentConfig,
        activeProfileId: currentConfig.activeProfileId === renameDialog.profileId ? nextProfileId : currentConfig.activeProfileId,
        hiddenProfileIds: currentConfig.hiddenProfileIds.map((id) => (id === renameDialog.profileId ? nextProfileId : id)),
      };
      await saveConfig(nextConfig);
      setRenameDialog(null);
      toast.success("프로필 이름을 변경했습니다.");
      void refreshUsage();
    } catch (err) {
      const message = String(err);
      setRenameDialog((current) => (current ? { ...current, error: message } : current));
      setError(message);
      toast.error(message);
    }
  }, [refreshUsage, renameDialog, saveConfig]);

  const sendSessionInput = useCallback(
    async (input: string) => {
      if (!session) return;
      await native.sendActionInput(session.id, input);
    },
    [session],
  );

  const refreshClaudeUsage = useCallback(async () => {
    try {
      setClaudeBusy(true);
      const usage = await native.getClaudeUsage();
      setClaudeUsage(usage);
      if (!usage.ok) {
        toast.error(usage.message ?? "Claude 사용량 조회 실패");
      }
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setClaudeBusy(false);
    }
  }, []);

  const startClaudeLogin = useCallback(async () => {
    try {
      setClaudeBusy(true);
      await native.startClaudeLogin();
      toast.message("Claude 로그인 창을 열었습니다.");
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setClaudeBusy(false);
    }
  }, []);

  const finishClaudeLogin = useCallback(async () => {
    const code = claudeOAuthCode.trim();
    if (!code) {
      toast.error("Claude OAuth code가 필요합니다.");
      return;
    }
    try {
      setClaudeBusy(true);
      const usage = await native.finishClaudeLogin(code);
      setClaudeUsage(usage);
      setClaudeOAuthCode("");
      if (usage.authenticated) {
        toast.success("Claude 로그인 완료");
      } else {
        toast.error(usage.message ?? "Claude 로그인 확인 실패");
      }
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setClaudeBusy(false);
    }
  }, [claudeOAuthCode]);

  const logoutClaude = useCallback(async () => {
    try {
      setClaudeBusy(true);
      const usage = await native.logoutClaude();
      setClaudeUsage(usage);
      toast.success("Claude 로그아웃 완료");
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setClaudeBusy(false);
    }
  }, []);

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
        void selectProfileById(payload.profileId, true);
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
    currentAccountStatus,
    sshStatus,
    desktopStatus,
    lastSwitchError,
    claudeUsage,
    claudeOAuthCode,
    claudeBusy,
    selected,
    newProfileId,
    profileLoginDialogOpen,
    profileLoginName,
    profileLoginError,
    renameDialog,
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
    setProfileLoginName,
    setClaudeOAuthCode,
    refreshUsage,
    retrySshCodexSync,
    refreshClaudeUsage,
    saveSettings,
    selectProfile,
    openProfileLoginDialog,
    closeProfileLoginDialog,
    submitProfileLogin,
    openRenameDialog,
    closeRenameDialog,
    setRenameValue,
    submitRenameProfile,
    startAction,
    sendSessionInput,
    startClaudeLogin,
    finishClaudeLogin,
    logoutClaude,
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
