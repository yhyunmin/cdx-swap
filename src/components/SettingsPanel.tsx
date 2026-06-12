import { Cloud, Eye, LogIn, LogOut, RefreshCw, Save, ScrollText, Server, Shield, Terminal } from "lucide-react";
import { memo } from "react";
import { formatResetDate } from "../lib/time";
import type { AppConfig, ClaudeUsageStatus, UpstreamStatus } from "../types/domain";

interface SettingsPanelProps {
  config: AppConfig;
  claudeUsage: ClaudeUsageStatus | null;
  claudeOAuthCode: string;
  claudeBusy: boolean;
  upstream: UpstreamStatus | null;
  onChange: (config: AppConfig) => void;
  onClaudeOAuthCodeChange: (code: string) => void;
  onClaudeLoginStart: () => void;
  onClaudeLoginFinish: () => void;
  onClaudeLogout: () => void;
  onRefreshClaudeUsage: () => void;
  onSave: () => void;
}

function usageText(value: number | null | undefined) {
  if (value == null) return "--";
  return `${Math.round(value)}%`;
}

export const SettingsPanel = memo(function SettingsPanel({
  config,
  claudeUsage,
  claudeOAuthCode,
  claudeBusy,
  upstream,
  onChange,
  onClaudeOAuthCodeChange,
  onClaudeLoginStart,
  onClaudeLoginFinish,
  onClaudeLogout,
  onRefreshClaudeUsage,
  onSave,
}: SettingsPanelProps) {
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
          <div className="claude-settings">
            <div className="provider-row">
              <strong>{claudeUsage?.authenticated ? "Claude 연결됨" : "Claude 로그인 필요"}</strong>
              <small>{claudeUsage?.message ?? claudeUsage?.error ?? "anthropic_oauth_usage"}</small>
            </div>
            {claudeUsage?.authenticated && (
              <div className="provider-metrics">
                <span>5H {usageText(claudeUsage.fiveHour?.utilization)}</span>
                <span>Week {usageText(claudeUsage.sevenDay?.utilization)}</span>
                <small>{formatResetDate(claudeUsage.fiveHour?.resetsAt ?? claudeUsage.sevenDay?.resetsAt ?? null)}</small>
              </div>
            )}
            <div className="settings-actions">
              <button type="button" onClick={onRefreshClaudeUsage} disabled={claudeBusy}>
                <RefreshCw size={15} />
                조회
              </button>
              <button type="button" onClick={onClaudeLoginStart} disabled={claudeBusy}>
                <LogIn size={15} />
                로그인
              </button>
              <button type="button" onClick={onClaudeLogout} disabled={claudeBusy}>
                <LogOut size={15} />
                로그아웃
              </button>
            </div>
            <label>
              <span>OAuth code</span>
              <input
                value={claudeOAuthCode}
                onChange={(event) => onClaudeOAuthCodeChange(event.target.value)}
                placeholder="Claude 브라우저 로그인 후 code 붙여넣기"
              />
            </label>
            <button className="primary-button" type="button" onClick={onClaudeLoginFinish} disabled={claudeBusy}>
              <Save size={15} />
              완료
            </button>
          </div>
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
