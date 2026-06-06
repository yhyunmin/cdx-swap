import { Check, RefreshCw, Settings, X } from "lucide-react";
import { formatRefreshTime } from "../lib/time";
import type { ProfileUsage } from "../types/domain";

interface StatusBarProps {
  activeProfile: ProfileUsage | null;
  lastUpdated: string | null;
  refreshing: boolean;
  settingsOpen: boolean;
  onRefresh: () => void;
  onToggleSettings: () => void;
}

export function StatusBar({ activeProfile, lastUpdated, refreshing, settingsOpen, onRefresh, onToggleSettings }: StatusBarProps) {
  return (
    <header className="topbar">
      <div className="status-line">
        <span className="muted">현재상태:</span>
        <strong>{activeProfile?.profileId ?? "선택 없음"}</strong>
        {activeProfile && <Check size={16} />}
      </div>
      <div className="header-actions">
        <span className="refresh-label">갱신 {formatRefreshTime(lastUpdated)}</span>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh">
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
        </button>
        <button className="icon-button" type="button" onClick={onToggleSettings} aria-label="Settings">
          {settingsOpen ? <X size={17} /> : <Settings size={17} />}
        </button>
      </div>
    </header>
  );
}
