export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${y}/${m}/${d}`;
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const EXPIRY_LABEL: Record<string, string> = {
  best_before: "賞味期限 (hạn ngon nhất)",
  use_by: "消費期限 (hạn an toàn)",
};

export const EXPIRY_SHORT: Record<string, string> = { best_before: "賞味", use_by: "消費" };

export function fmtTemp(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v}°C`;
}

export function fmtRange(min: number | null, max: number | null): string {
  if (min === null && max !== null) return `≤ ${max}°C`;
  if (max === null && min !== null) return `≥ ${min}°C`;
  if (min === null && max === null) return "—";
  return `${min} – ${max}°C`;
}

/** FR-OUT-02 exclusion steps as shown to users. */
export const EXCLUSION_LABEL: Record<string, string> = {
  use_by_expired: "① 消費期限 đã đến — HARD STOP",
  zone_mismatch: "② Sai dải nhiệt",
  quarantine: "③ Đang 隔離",
  window_violation: "④ Quá delivery window",
  date_reversal: "⑤ 日付逆転",
};

export const LANE_LABEL: Record<string, string> = { rice: "米 (産地・取引)", beef: "牛 (mã cá thể 10 số)", internal_lot: "Nội bộ" };

export const RESULT_LABEL: Record<string, string> = { accepted: "Đạt → nhập kho", rejected: "Từ chối", hold: "保留 → 隔離" };
