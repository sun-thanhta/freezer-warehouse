import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps same-origin paths with their query", () => {
    expect(safeNextPath("/inventory?view=quarantine")).toBe("/inventory?view=quarantine");
  });

  it("falls back to / when missing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects open-redirect shapes", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/\tevil"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
