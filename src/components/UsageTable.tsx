import { Eye, EyeOff, LogOut } from "lucide-react";
import { displayAccount, isProfileHidden } from "../lib/app-model";
import { formatResetDate } from "../lib/time";
import type { AppConfig, ProfileUsage } from "../types/domain";

function quotaTone(value: number | null) {
  if (value == null) return "unknown";
  if (value <= 10) return "danger";
  if (value <= 30) return "warn";
  return "good";
}

function QuotaCell({ value }: { value: number | null }) {
  return <span className={`quota quota--${quotaTone(value)}`}>{value == null ? "--" : `${value}%`}</span>;
}

interface UsageTableProps {
  profiles: ProfileUsage[];
  config: AppConfig;
  resetAt: string | null;
  onToggleHidden: (profileId: string) => void;
  onLogout: (profileId: string) => void;
}

export function UsageTable({ profiles, config, resetAt, onToggleHidden, onLogout }: UsageTableProps) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Codex 사용량</h2>
        <span>{formatResetDate(resetAt)}</span>
      </div>
      <div className="usage-table">
        <div className="usage-row usage-row--head">
          <strong>Profile</strong>
          <strong>5H</strong>
          <strong>Week</strong>
          <span />
        </div>
        {profiles.map((profile) => {
          const hidden = isProfileHidden(config, profile.profileId);
          return (
            <div key={profile.profileId} className={`usage-row ${profile.error && !hidden ? "is-error" : ""}`}>
              <div>
                <strong>{profile.profileId}</strong>
                {!hidden && <small>{displayAccount(profile.account, config.maskEmails)}</small>}
                {!hidden && profile.error && <small>{profile.error}</small>}
              </div>
              {hidden ? <span /> : <QuotaCell value={profile.fiveHourLeft} />}
              {hidden ? <span /> : <QuotaCell value={profile.weeklyLeft} />}
              <div className="usage-actions">
                <button
                  className="icon-button icon-button--sm"
                  type="button"
                  onClick={() => onToggleHidden(profile.profileId)}
                  aria-label={hidden ? `${profile.profileId} 보이기` : `${profile.profileId} 숨기기`}
                  title={hidden ? "보이기" : "숨기기"}
                >
                  {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  className="icon-button icon-button--sm danger-icon"
                  type="button"
                  onClick={() => onLogout(profile.profileId)}
                  aria-label={`${profile.profileId} 로그아웃`}
                  title="로그아웃"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
