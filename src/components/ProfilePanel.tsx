import { LogIn, LogOut, Play } from "lucide-react";
import { displayAccount } from "../lib/app-model";
import type { ActionKind, ProfileUsage } from "../types/domain";

interface ProfilePanelProps {
  profiles: ProfileUsage[];
  activeProfileId: string | null;
  maskEmails: boolean;
  loading: boolean;
  newProfileId: string;
  onNewProfileIdChange: (value: string) => void;
  onSelect: (profile: ProfileUsage) => void;
  onAction: (kind: ActionKind, profileId: string) => void;
}

export function ProfilePanel({
  profiles,
  activeProfileId,
  maskEmails,
  loading,
  newProfileId,
  onNewProfileIdChange,
  onSelect,
  onAction,
}: ProfilePanelProps) {
  return (
    <section className="panel">
      <h2>프로필</h2>
      <div className="profile-list">
        {loading && <p className="empty">사용량을 불러오는 중입니다.</p>}
        {!loading && profiles.length === 0 && <p className="empty">프로필이 없습니다. 새 프로필 이름을 입력하고 Login을 누르세요.</p>}
        {profiles.map((profile) => (
          <article key={profile.profileId} className={`profile-card ${profile.profileId === activeProfileId ? "is-active" : ""}`}>
            <button className="profile-main" type="button" onClick={() => onSelect(profile)}>
              <span>{profile.profileId}</span>
              <small>{displayAccount(profile.account, maskEmails)}</small>
            </button>
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
        ))}
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
}
