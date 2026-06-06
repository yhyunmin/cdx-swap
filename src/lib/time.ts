export function formatRefreshTime(value: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatResetDate(value: string | null): string {
  if (!value) {
    return "초기화 --";
  }

  const relativeSeconds = value.match(/^\+(\d+)s$/)?.[1];
  const date = relativeSeconds ? new Date(Date.now() + Number(relativeSeconds) * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "초기화 --";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}
