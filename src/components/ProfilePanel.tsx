import { LogIn, Plus } from "lucide-react";
import { memo } from "react";

interface ProfilePanelProps {
  loading: boolean;
  onOpenLoginDialog: () => void;
}

export const ProfilePanel = memo(function ProfilePanel({ loading, onOpenLoginDialog }: ProfilePanelProps) {
  return (
    <section className="panel profile-login-panel" aria-label="프로필">
      <div className="section-title">
        <h2>프로필</h2>
        <button
          className="icon-button tooltip-trigger"
          type="button"
          onClick={onOpenLoginDialog}
          aria-label="프로필 로그인 추가"
          data-tooltip="프로필 로그인"
          disabled={loading}
        >
          {loading ? <LogIn size={16} /> : <Plus size={16} />}
        </button>
      </div>
      <p className="empty">새 Codex 프로필은 이름을 정한 뒤 로그인합니다.</p>
    </section>
  );
});
