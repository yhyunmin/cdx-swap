import { formatResetDate } from "../lib/time";
import type { ProfileUsage } from "../types/domain";

function quotaTone(value: number | null) {
  if (value == null) return "unknown";
  if (value <= 10) return "danger";
  if (value <= 30) return "warn";
  return "good";
}

function QuotaCell({ value }: { value: number | null }) {
  return <span className={`quota quota--${quotaTone(value)}`}>{value == null ? "--" : `${value}%`}</span>;
}

export function UsageTable({ profiles, resetAt }: { profiles: ProfileUsage[]; resetAt: string | null }) {
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
        </div>
        {profiles.map((profile) => (
          <div key={profile.profileId} className={`usage-row ${profile.error ? "is-error" : ""}`}>
            <div>
              <strong>{profile.profileId}</strong>
              {profile.error && <small>{profile.error}</small>}
            </div>
            <QuotaCell value={profile.fiveHourLeft} />
            <QuotaCell value={profile.weeklyLeft} />
          </div>
        ))}
      </div>
    </section>
  );
}
