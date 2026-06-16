export function formatAuthLinkTtlLabel(ttlMs: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const secondMs = 1000;

  if (ttlMs >= dayMs && ttlMs % dayMs === 0) {
    return `${ttlMs / dayMs}일`;
  }

  if (ttlMs >= hourMs && ttlMs % hourMs === 0) {
    return `${ttlMs / hourMs}시간`;
  }

  if (ttlMs >= minuteMs) {
    return `${Math.ceil(ttlMs / minuteMs)}분`;
  }

  return `${Math.max(1, Math.ceil(ttlMs / secondMs))}초`;
}
