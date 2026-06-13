import { BadgeCheck, Eye, EyeOff, LogIn, LogOut, Pencil, Play } from "lucide-react";
import { memo, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { displayAccount, isProfileHidden } from "../lib/app-model";
import type { ActionKind, AppConfig, ProfileUsage } from "../types/domain";

function quotaTone(value: number | null) {
  if (value == null) return "unknown";
  if (value <= 10) return "danger";
  if (value <= 30) return "warn";
  return "good";
}

function quotaText(value: number | null) {
  return value == null ? "--" : `${value}%`;
}

const QuotaInline = memo(function QuotaInline({ label, value }: { label: "5H" | "Week"; value: number | null }) {
  const percent = value ?? 0;
  return (
    <span className={`quota-inline quota--${quotaTone(value)}`} style={{ "--quota-value": `${percent}%` } as CSSProperties}>
      <span className="quota-inline__label">{label}</span>
      <span className="quota-track" aria-hidden="true">
        <span />
      </span>
      <span className="quota-value">{quotaText(value)}</span>
    </span>
  );
});

interface IconActionProps {
  label: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}

function IconAction({ label, className = "", disabled, children, onClick }: IconActionProps) {
  const stopAndRun = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <button
      className={`icon-button icon-button--sm tooltip-trigger ${className}`}
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={stopAndRun}
      aria-label={label}
      data-tooltip={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

interface UsageTableProps {
  profiles: ProfileUsage[];
  config: AppConfig;
  activeProfileId: string | null;
  onSelect: (profile: ProfileUsage) => void;
  onAction: (kind: ActionKind, profileId: string) => void;
  onRename: (profile: ProfileUsage) => void;
  onToggleHidden: (profileId: string) => void;
  onLogout: (profileId: string) => void;
}

export const UsageTable = memo(function UsageTable({
  profiles,
  config,
  activeProfileId,
  onSelect,
  onAction,
  onRename,
  onToggleHidden,
  onLogout,
}: UsageTableProps) {
  return (
    <section className="panel usage-panel">
      <div className="section-title section-title--compact">
        <h2>Codex 사용량</h2>
      </div>
      <div className="usage-list">
        {profiles.length === 0 && <p className="empty">등록된 Codex 프로필이 없습니다.</p>}
        {profiles.map((profile) => {
          const hidden = isProfileHidden(config, profile.profileId);
          const active = profile.profileId === activeProfileId;
          const hasError = Boolean(profile.error && !hidden);
          const canSwitch = !active && !hidden;
          const handleSwitch = () => {
            if (canSwitch) onSelect(profile);
          };
          const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
            if ((event.key === "Enter" || event.key === " ") && canSwitch) {
              event.preventDefault();
              onSelect(profile);
            }
          };

          return (
            <div
              key={profile.profileId}
              className={`usage-item ${active ? "is-active" : ""} ${hasError ? "is-error" : ""} ${canSwitch ? "is-clickable" : ""}`}
            >
              <div className="usage-item__main">
                <div className="usage-identity">
                  <button
                    className="usage-switch-target"
                    type="button"
                    onClick={handleSwitch}
                    onKeyDown={handleKeyDown}
                    disabled={!canSwitch}
                    aria-label={canSwitch ? `${profile.profileId} 계정 전환` : `${profile.profileId} 현재 계정`}
                  >
                    <span className="profile-avatar profile-avatar--sm" aria-hidden="true">
                      {profile.profileId.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="usage-copy">
                      <span className="usage-title">
                        <strong>{profile.profileId}</strong>
                        {profile.plan && !hidden && <span className="metric-chip metric-chip--plain">{profile.plan}</span>}
                        {active && (
                          <span className="active-badge" aria-label="활성 프로필">
                            <BadgeCheck size={14} />
                          </span>
                        )}
                      </span>
                      <small>{hidden ? "숨김" : displayAccount(profile.account, config.maskEmails)}</small>
                      {hasError && <small className="error-text">{profile.error}</small>}
                    </div>
                  </button>
                  <IconAction label={`${profile.profileId} 이름 변경`} onClick={() => onRename(profile)}>
                    <Pencil size={14} />
                  </IconAction>
                </div>
                {!hidden && !hasError && (
                  <div className="quota-pair" aria-label={`${profile.profileId} 사용량`}>
                    <QuotaInline label="5H" value={profile.fiveHourLeft} />
                    <QuotaInline label="Week" value={profile.weeklyLeft} />
                  </div>
                )}
              </div>
              <div className="usage-actions" aria-label={`${profile.profileId} 작업`}>
                {hasError && (
                  <IconAction label={`${profile.profileId} 로그인`} onClick={() => onAction("login", profile.profileId)}>
                    <LogIn size={15} />
                  </IconAction>
                )}
                <IconAction label={`${profile.profileId} 실행`} onClick={() => onAction("run", profile.profileId)} disabled={hidden || hasError}>
                  <Play size={15} />
                </IconAction>
                <IconAction label={hidden ? `${profile.profileId} 보이기` : `${profile.profileId} 숨기기`} onClick={() => onToggleHidden(profile.profileId)}>
                  {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </IconAction>
                <IconAction label={`${profile.profileId} 로그아웃`} className="danger-icon" onClick={() => onLogout(profile.profileId)}>
                  <LogOut size={15} />
                </IconAction>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
