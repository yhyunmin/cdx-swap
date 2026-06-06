import type { AppConfig, UpstreamStatus } from "../types/domain";

interface SettingsPanelProps {
  config: AppConfig;
  upstream: UpstreamStatus | null;
  onChange: (config: AppConfig) => void;
  onSave: () => void;
}

export function SettingsPanel({ config, upstream, onChange, onSave }: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <label>
        <span>Codex Desktop 실행 파일</span>
        <input
          value={config.codexDesktopPath}
          onChange={(event) => onChange({ ...config, codexDesktopPath: event.target.value })}
          placeholder="C:\\Users\\me\\AppData\\Local\\Programs\\Codex\\Codex.exe"
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
      <label className="switch-row">
        <input
          type="checkbox"
          checked={config.restartDesktopOnSwitch}
          onChange={(event) => onChange({ ...config, restartDesktopOnSwitch: event.target.checked })}
        />
        <span>계정 선택 시 Codex Desktop 안전 재시작</span>
      </label>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={config.confirmBeforeSwitch}
          onChange={(event) => onChange({ ...config, confirmBeforeSwitch: event.target.checked })}
        />
        <span>전환 전 확인</span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={config.autostart} onChange={(event) => onChange({ ...config, autostart: event.target.checked })} />
        <span>Windows 시작 시 실행</span>
      </label>
      <div className="upstream-card">
        <strong>cdx upstream</strong>
        <span>{upstream?.latestRef ? `${upstream.baseRef} → ${upstream.latestRef}` : upstream?.baseRef ?? "확인 중"}</span>
        {upstream?.updateAvailable && <small>업데이트 가능. 수동 sync 후 반영하세요.</small>}
        {upstream?.error && <small>{upstream.error}</small>}
      </div>
      <button className="primary-button" type="button" onClick={onSave}>저장</button>
    </section>
  );
}
