// Cold-chain temperature check against Yuki's SELF-DECLARED band thresholds (R-01, BR-TEMP-01) —
// read from temperature_zones, never an industry default.

export interface TempRange {
  min: number | null;
  max: number | null;
}

export function isTempWithinRange(tempC: number, range: TempRange): boolean {
  if (range.min !== null && tempC < range.min) return false;
  if (range.max !== null && tempC > range.max) return false;
  return true;
}

export function formatTempRange(range: TempRange): string {
  if (range.min === null && range.max !== null) return `≤ ${range.max}°C`;
  if (range.max === null && range.min !== null) return `≥ ${range.min}°C`;
  return `${range.min}–${range.max}°C`;
}

