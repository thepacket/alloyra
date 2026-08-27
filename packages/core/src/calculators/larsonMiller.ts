import type { CalcResult } from "./types.ts";

/**
 * Larson-Miller parameter for creep-rupture interpolation:
 *   LMP = T[K] · (C + log10 t[h]) / 1000
 * C defaults to 20 and is user-editable (blueprint § 5).
 */
export function larsonMiller(
  tempC: number,
  hours: number,
  C = 20,
): CalcResult {
  const tK = tempC + 273.15;
  const warnings: string[] = [];
  let inWindow = true;
  if (hours <= 0) {
    inWindow = false;
    warnings.push("Time must be positive.");
  }
  const value = inWindow ? (tK * (C + Math.log10(hours))) / 1000 : Number.NaN;
  return {
    value,
    unit: "×10³ K",
    formula: "LMP = T[K]·(C + log₁₀ t) / 1000",
    source: {
      citation: "Larson & Miller (1952), Trans. ASME 74",
      note: "Interpolate within tested data only; extrapolation beyond the rupture dataset is not supported.",
    },
    inWindow,
    warnings,
  };
}
