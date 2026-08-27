import type { Composition, CompositionRange, ElementSymbol } from "../composition.ts";

/**
 * Nearest-standard-grade matching (R-4.4), conformance-first:
 * 1. Test whether the composition LIES WITHIN each grade's specification
 *    ranges (per element; elements the grade doesn't permit count as
 *    violations above a residual allowance).
 * 2. Rank by normalized out-of-range distance — each violation measured
 *    as (distance outside the range) / (range width), so a 0.5 wt%
 *    excursion on a tight N window weighs more than on a wide Cr window.
 *
 * Composition conformance is NOT product qualification: meeting the
 * ranges says nothing about melt practice, condition, testing, or
 * certification to the standard.
 */
export interface GradeRef {
  uns: string;
  name: string;
  composition: readonly CompositionRange[];
}

export interface Violation {
  element: ElementSymbol;
  /** e.g. "+0.60 above 3.0 max" or "not a permitted addition". */
  detail: string;
  /** Distance outside the range, normalized by range width. */
  normalized: number;
}

export interface GradeMatch {
  uns: string;
  name: string;
  /** True: composition lies within every spec range of the grade. */
  conforms: boolean;
  violations: Violation[];
  /** Σ normalized out-of-range distances (0 when conforming). */
  distance: number;
}

/** Residual tolerance for elements a grade's table doesn't list, wt%. */
const RESIDUAL_ALLOWANCE = 0.05;

export function nearestGrades(
  user: Composition,
  grades: readonly GradeRef[],
  limit = 3,
): GradeMatch[] {
  const matches = grades.map((g) => {
    const balance = new Set(
      g.composition.filter((r) => r.balance).map((r) => r.element),
    );
    const violations: Violation[] = [];

    for (const r of g.composition) {
      if (r.balance) continue;
      const v = user[r.element];
      const lo = r.min ?? 0;
      const hi = r.max ?? Number.POSITIVE_INFINITY;
      const width = Number.isFinite(hi) ? Math.max(hi - lo, 0.01) : Math.max(lo, 0.01);
      if (v === undefined) {
        // Unknown content: only a violation when the grade REQUIRES a
        // minimum — you can't conform to "≥ 2.0 Mo" with unknown Mo.
        if (r.min !== undefined) {
          violations.push({
            element: r.element,
            detail: `unspecified, but the grade requires ≥ ${r.min}`,
            normalized: 1,
          });
        }
        continue;
      }
      if (v < lo) {
        violations.push({
          element: r.element,
          detail: `${(v - lo).toFixed(2)} below ${lo} min`,
          normalized: (lo - v) / width,
        });
      } else if (v > hi) {
        violations.push({
          element: r.element,
          detail: `+${(v - hi).toFixed(2)} above ${hi} max`,
          normalized: (v - hi) / width,
        });
      }
    }

    // Elements present in the composition the grade doesn't list at all.
    for (const [el, v] of Object.entries(user) as [ElementSymbol, number][]) {
      if (v === undefined || v <= RESIDUAL_ALLOWANCE) continue;
      if (balance.has(el)) continue;
      if (!g.composition.some((r) => r.element === el)) {
        violations.push({
          element: el,
          detail: `${v.toFixed(2)} wt% — not a permitted addition`,
          normalized: v,
        });
      }
    }

    const distance = violations.reduce((s, x) => s + x.normalized, 0);
    violations.sort((a, b) => b.normalized - a.normalized);
    return {
      uns: g.uns,
      name: g.name,
      conforms: violations.length === 0,
      violations,
      distance,
    };
  });
  return matches.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
