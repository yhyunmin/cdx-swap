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
        <h2>프로필 추가</h2>
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
    </section>
  );
});
