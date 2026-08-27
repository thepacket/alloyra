import type { SourceRef } from "../provenance.ts";

/**
 * Every calculator result carries its formula, source, and applicability
 * (blueprint R-4.2 / R-4.3). `inWindow: false` means the inputs left the
 * model's validated range — the UI greys the value out instead of
 * extrapolating silently.
 */
export interface CalcResult {
  value: number;
  unit: string;
  formula: string;
  source: SourceRef;
  inWindow: boolean;
  warnings: string[];
}
