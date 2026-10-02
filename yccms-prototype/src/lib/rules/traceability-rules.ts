// Traceability lanes (BR-TRACE-01/02/03): rice = 産地+取引 (statutory), beef = 10-digit individual
// identification number (statutory), internal_lot = Yuki-internal lot ↔ supplier/customer links (optional).

export type TraceLane = "rice" | "beef" | "internal_lot";

/** Beef id must be exactly 10 digits; a 9-digit code goes to business-review and is never padded/rounded. */
export function checkBeefId(code: string): "ok" | "review" | "invalid" {
  if (/^\d{10}$/.test(code)) return "ok";
  return /^\d{9}$/.test(code) ? "review" : "invalid";
}

/** Error message for a trace code that does not satisfy its lane, or null when OK. */
export function traceCodeProblem(lane: TraceLane, code: string | null | undefined): string | null {
  const value = (code ?? "").trim();
  if (lane === "rice" && !value) return "Gạo (米トレーサビリティ法): bắt buộc 産地・取引.";
  if (lane === "beef") {
    const check = checkBeefId(value);
    if (check === "review") return "Mã cá thể bò chỉ có 9 số → chuyển business-review, không tự làm tròn thành 10 số.";
    if (check === "invalid") return "Mã cá thể bò (個体識別番号) phải đúng 10 chữ số.";
  }
  return null;
}
