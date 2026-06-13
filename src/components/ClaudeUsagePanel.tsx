import { Cloud, RefreshCw } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { formatResetDate } from "../lib/time";
import type { ClaudeUsageStatus } from "../types/domain";

function usageTone(value: number | null | undefined) {
  if (value == null) return "unknown";
  if (value >= 95) return "danger";
  if (value >= 80) return "warn";
  return "good";
}

function usageText(value: number | null | undefined) {
  if (value == null) return "--";
  return `${Math.round(value)}%`;
}

const UsedCell = memo(function UsedCell({ value }: { value: number | null | undefined }) {
  const percent = value ?? 0;
  return (
    <span className={`quota quota--${usageTone(value)}`} style={{ "--quota-value": `${percent}%` } as CSSProperties}>
      <span className="quota-track" aria-hidden="true">
        <span />
      </span>
      <span className="quota-value">{usageText(value)}</span>
    </span>
  );
});

interface ClaudeUsagePanelProps {
  usage: ClaudeUsageStatus | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export const ClaudeUsagePanel = memo(function ClaudeUsagePanel({ usage, refreshing, onRefresh }: ClaudeUsagePanelProps) {
  const resetAt = usage?.fiveHour?.resetsAt ?? usage?.sevenDay?.resetsAt ?? null;
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Claude 사용량</h2>
        <div className="provider-row">
          <span>{formatResetDate(resetAt)}</span>
          <button className="icon-button icon-button--sm tooltip-trigger" type="button" onClick={onRefresh} aria-label="Claude 사용량 조회" data-tooltip="조회">
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
          </button>
        </div>
      </div>
      <div className="usage-table">
        <div className="usage-row usage-row--head usage-row--claude">
          <strong>Provider</strong>
          <strong>5H Used</strong>
          <strong>Week Used</strong>
        </div>
        <div className={`usage-row usage-row--claude ${usage?.ok === false ? "is-error" : ""}`}>
          <div>
            <strong>
              <Cloud size={14} />
              Claude
            </strong>
            <small>{usage?.authenticated ? usage.credentialSource ?? usage.source : usage?.message ?? "로그인 필요"}</small>
          </div>
          {usage?.authenticated ? <UsedCell value={usage.fiveHour?.utilization} /> : <span />}
          {usage?.authenticated ? <UsedCell value={usage.sevenDay?.utilization} /> : <span />}
        </div>
      </div>
    </section>
  );
});
