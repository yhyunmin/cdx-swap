import { Cloud, Eye, RefreshCw, Save, ScrollText, Server, Shield, Terminal } from "lucide-react";
import { memo } from "react";
import type { AppConfig, UpstreamStatus } from "../types/domain";

interface SettingsPanelProps {
  config: AppConfig;
  upstream: UpstreamStatus | null;
  onChange: (config: AppConfig) => void;
  onSave: () => void;
}

export const SettingsPanel = memo(function SettingsPanel({ config, upstream, onChange, onSave }: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <div className="settings-group">
        <div className="section-title">
          <h2>설정</h2>
        </div>
        <label>
          <span>Codex CLI 경로</span>
          <input
            value={config.codexCliPath}
            onChange={(event) => onChange({ ...config, codexCliPath: event.target.value })}
            placeholder="자동 탐색 또는 C:\\Users\\Administrator\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe"
          />
        </label>
        <label>
          <span>Codex Desktop 실행 파일</span>
          <input
            value={config.codexDesktopPath}
            onChange={(event) => onChange({ ...config, codexDesktopPath: event.target.value })}
            placeholder="C:\\Users\\me\\AppData\\Local\\Programs\\OpenAI\\Codex\\Codex.exe"
          />
        </label>
        <label>
          <span>갱신 주기(초)</span>
          <input
            type="number"
            min={15}
            value={config.refreshIntervalSeconds}
            onChange={(event) => onChange({ ...config, refreshIntervalSeconds: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="settings-group">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={config.restartDesktopOnSwitch}
            onChange={(event) => onChange({ ...config, restartDesktopOnSwitch: event.target.checked })}
          />
          <Terminal size={16} />
          <span>계정 선택 시 Codex Desktop 안전 재시작</span>
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={config.confirmBeforeSwitch}
            onChange={(event) => onChange({ ...config, confirmBeforeSwitch: event.target.checked })}
          />
          <Shield size={16} />
          <span>전환 전 확인</span>
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={config.autostart} onChange={(event) => onChange({ ...config, autostart: event.target.checked })} />
          <RefreshCw size={16} />
          <span>Windows 시작 시 실행</span>
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={config.maskEmails} onChange={(event) => onChange({ ...config, maskEmails: event.target.checked })} />
          <Eye size={16} />
          <span>이메일 마스킹</span>
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={config.showSessionLogs}
            onChange={(event) => onChange({ ...config, showSessionLogs: event.target.checked })}
          />
          <ScrollText size={16} />
          <span>세션 로그 보기</span>
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={config.sshCodexSyncEnabled}
            onChange={(event) => onChange({ ...config, sshCodexSyncEnabled: event.target.checked })}
          />
          <Server size={16} />
          <span>SSH Codex 계정 동시 변경</span>
        </label>
        {config.sshCodexSyncEnabled && (
          <label>
            <span>SSH 이름</span>
            <input
              value={config.sshCodexHost}
              onChange={(event) => onChange({ ...config, sshCodexHost: event.target.value })}
              placeholder="codex-wsl"
            />
          </label>
        )}
      </div>

      <div className="settings-group">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={config.claudeEnabled}
            onChange={(event) => onChange({ ...config, claudeEnabled: event.target.checked })}
          />
          <Cloud size={16} />
          <span>Claude 사용량 설정</span>
        </label>
        {config.claudeEnabled && (
          <label>
            <span>Claude CLI 경로</span>
            <input
              value={config.claudeCliPath}
              onChange={(event) => onChange({ ...config, claudeCliPath: event.target.value })}
              placeholder="v1에서는 저장만 하고 조회는 비활성"
            />
          </label>
        )}
      </div>

      <div className="upstream-card">
        <strong>cdx upstream</strong>
        <span>{upstream?.latestRef ? `${upstream.baseRef} -> ${upstream.latestRef}` : upstream?.baseRef ?? "확인 중"}</span>
        {upstream?.updateAvailable && <small>업데이트 가능. 수동 sync 후 반영하세요.</small>}
        {upstream?.error && <small>{upstream.error}</small>}
      </div>
      <button className="primary-button" type="button" onClick={onSave}>
        <Save size={15} />
        저장
      </button>
    </section>
  );
});
