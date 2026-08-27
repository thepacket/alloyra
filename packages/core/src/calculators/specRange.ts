import type { Composition, CompositionRange } from "../composition.ts";
import type { CalcResult } from "./types.ts";

/**
 * Specification-derived interval for a composition calculator: the value
 * range the SPEC permits, evaluated at the all-minimum and all-maximum
 * corner compositions. Valid because every Alloyra calculator is
 * monotone per element with uniform coefficient sign.
 *
 * Elements the spec does not list stay ABSENT (unknown) in both corners,
 * so a calculator's required-element check propagates: a spec that never
 * regulates Mn yields an indeterminate CE range, not a pure-iron number.
 */
export interface SpecRangeResult {
  lo: number;
  /** With openEnded elements, hi is a FLOOR of the upper bound, not a bound. */
  hi: number;
  unit: string;
  formula: string;
  inWindow: boolean;
  warnings: string[];
  missing: string[];
  /** Elements with a spec minimum but no maximum — the interval is open above. */
  openEnded: string[];
}

export function specRange(
  calc: (c: Composition) => CalcResult,
  ranges: readonly CompositionRange[],
): SpecRangeResult {
  const loComp: Composition = {};
  const hiComp: Composition = {};
  const openEnded: string[] = [];
  for (const r of ranges) {
    if (r.balance) continue;
    loComp[r.element] = r.min ?? 0; // "≤ max" permits zero
    hiComp[r.element] = r.max ?? r.min ?? 0; // "≥ min": floor only
    if (r.min !== undefined && r.max === undefined) openEnded.push(r.element);
  }
  const a = calc(loComp);
  const b = calc(hiComp);
  const missing = [...new Set([...(a.missing ?? []), ...(b.missing ?? [])])];
  const warnings = [...new Set([...a.warnings, ...b.warnings])];
  if (openEnded.length > 0) {
    warnings.push(
      `Open-ended spec: ${openEnded.join(", ")} has a minimum but no maximum — the upper value is a floor, not a bound.`,
    );
  }
  const values = [a.value, b.value].sort((x, y) => x - y);
  return {
    lo: values[0] ?? Number.NaN,
    hi: values[1] ?? Number.NaN,
    unit: a.unit,
    formula: a.formula,
    inWindow: a.inWindow && b.inWindow && missing.length === 0,
    warnings,
    missing,
    openEnded,
  };
}
