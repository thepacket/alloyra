import type { ElementSymbol } from "../composition.ts";
import type { SourceRef } from "../provenance.ts";

/**
 * Every calculator result carries its formula, source, and applicability
 * (blueprint R-4.2 / R-4.3). `inWindow: false` means the inputs left the
 * model's validated range — the UI greys the value out instead of
 * extrapolating silently.
 */
export interface CalcResult {
  /** NaN when the result is indeterminate (see `missing`). */
  value: number;
  unit: string;
  formula: string;
  source: SourceRef;
  inWindow: boolean;
  warnings: string[];
  /**
   * Required elements the composition did not specify. Non-empty means
   * the result is UNKNOWN — the UI must say "unknown", never show a
   * number computed with silent zeros.
   */
  missing?: ElementSymbol[];
}

/** Standard indeterminate result for missing required chemistry. */
export function indeterminate(
  missing: ElementSymbol[],
  base: Omit<CalcResult, "value" | "inWindow" | "warnings" | "missing">,
): CalcResult {
  return {
    ...base,
    value: Number.NaN,
    inWindow: false,
    missing,
    warnings: [
      `Cannot compute — composition does not specify: ${missing.join(", ")}. Missing chemistry propagates as unknown, never as zero.`,
    ],
  };
}
