import { Check, Gem, RefreshCw, Settings, X } from "lucide-react";
import { memo } from "react";
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

export const StatusBar = memo(function StatusBar({ activeProfile, lastUpdated, refreshing, settingsOpen, onRefresh, onToggleSettings }: StatusBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <Gem size={18} />
        </div>
        <div className="status-line">
          <span className="muted">현재상태</span>
          <strong>{activeProfile?.profileId ?? "선택 없음"}</strong>
          {activeProfile && <Check size={15} />}
        </div>
      </div>
      <div className="header-actions">
        <span className="refresh-label">갱신 {formatRefreshTime(lastUpdated)}</span>
        <button className="icon-button tooltip-trigger" type="button" onClick={onRefresh} aria-label="Refresh" data-tooltip="갱신">
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
        </button>
        <button className="icon-button tooltip-trigger" type="button" onClick={onToggleSettings} aria-label="Settings" data-tooltip={settingsOpen ? "닫기" : "설정"}>
          {settingsOpen ? <X size={17} /> : <Settings size={17} />}
        </button>
      </div>
    </header>
  );
});
