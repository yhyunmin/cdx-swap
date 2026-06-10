import { BadgeCheck, Eye, EyeOff, LogIn, LogOut, Play } from "lucide-react";
import { memo } from "react";
import { displayAccount } from "../lib/app-model";
import type { ActionKind, ProfileUsage } from "../types/domain";

interface ProfilePanelProps {
  profiles: ProfileUsage[];
  activeProfileId: string | null;
  hiddenProfileIds: string[];
  maskEmails: boolean;
  loading: boolean;
  newProfileId: string;
  onNewProfileIdChange: (value: string) => void;
  onSelect: (profile: ProfileUsage) => void;
  onAction: (kind: ActionKind, profileId: string) => void;
  onToggleHidden: (profileId: string) => void;
}

export const ProfilePanel = memo(function ProfilePanel({
  profiles,
  activeProfileId,
  hiddenProfileIds,
  maskEmails,
  loading,
  newProfileId,
  onNewProfileIdChange,
  onSelect,
  onAction,
  onToggleHidden,
}: ProfilePanelProps) {
  return (
    <section className="panel">
      <h2>프로필</h2>
      <div className="profile-list">
        {loading && <p className="empty">사용량을 불러오는 중입니다.</p>}
        {!loading && profiles.length === 0 && <p className="empty">프로필이 없습니다. 새 프로필 이름을 입력하고 Login을 누르세요.</p>}
        {profiles.map((profile) => {
          const hidden = hiddenProfileIds.includes(profile.profileId);
          const active = profile.profileId === activeProfileId;
          return (
            <article key={profile.profileId} className={`profile-card ${active ? "is-active" : ""}`}>
              <div className="profile-heading">
                <button className="profile-main" type="button" onClick={() => onSelect(profile)}>
                  <span className="profile-avatar" aria-hidden="true">
                    {profile.profileId.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="profile-copy">
                    <span className="profile-title">
                      {profile.profileId}
                      {active && <BadgeCheck size={15} />}
                    </span>
                    {!hidden && <small>{displayAccount(profile.account, maskEmails)}</small>}
                  </span>
                </button>
                <button
                  className="icon-button icon-button--sm"
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleHidden(profile.profileId);
                  }}
                  aria-label={hidden ? `${profile.profileId} 보이기` : `${profile.profileId} 숨기기`}
                  title={hidden ? "보이기" : "숨기기"}
                >
                  {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
              {!hidden && (
                <div className="profile-metrics">
                  {profile.plan && <span className="metric-chip">{profile.plan}</span>}
                  <span className="metric-chip">5H {profile.fiveHourLeft == null ? "--" : `${profile.fiveHourLeft}%`}</span>
                  <span className="metric-chip">Week {profile.weeklyLeft == null ? "--" : `${profile.weeklyLeft}%`}</span>
                </div>
              )}
              <div className="profile-actions">
                <button type="button" onClick={() => onAction("login", profile.profileId)}>
                  <LogIn size={15} />
                  Login
                </button>
                <button type="button" onClick={() => onAction("run", profile.profileId)}>
                  <Play size={15} />
                  Run
                </button>
                <button type="button" onClick={() => onAction("logout", profile.profileId)}>
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="new-profile">
        <input value={newProfileId} onChange={(event) => onNewProfileIdChange(event.target.value)} placeholder="new-profile" />
        <button type="button" onClick={() => onAction("login", newProfileId)}>
          <LogIn size={15} />
          Login
        </button>
      </div>
    </section>
  );
});
