import type { Composition, CompositionRange, ElementSymbol } from "../composition.ts";
import { midpointComposition } from "../composition.ts";

/**
 * Nearest-standard-grade matching (R-4.4): keeps a composition study
 * anchored to procurable reality — "you have redesigned 317L, δMo +0.4".
 *
 * Distance is deliberately transparent: Σ|Δwt%| over alloying elements
 * (balance excluded), candidate at mid-spec with residuals at half-max.
 * No weighting, no cleverness — a metallurgist can check it by hand.
 */
export interface GradeRef {
  uns: string;
  name: string;
  composition: readonly CompositionRange[];
}

export interface ElementDelta {
  element: ElementSymbol;
  /** user − candidate mid-spec, wt% */
  delta: number;
}

export interface GradeMatch {
  uns: string;
  name: string;
  distance: number;
  deltas: ElementDelta[];
}

export function nearestGrades(
  user: Composition,
  grades: readonly GradeRef[],
  limit = 3,
): GradeMatch[] {
  const matches = grades.map((g) => {
    const target = midpointComposition([...g.composition], {
      includeResidualsAtHalfMax: true,
    });
    const balance = new Set(
      g.composition.filter((r) => r.balance).map((r) => r.element),
    );
    const elements = new Set<ElementSymbol>([
      ...(Object.keys(user) as ElementSymbol[]),
      ...(Object.keys(target) as ElementSymbol[]),
    ]);
    let distance = 0;
    const deltas: ElementDelta[] = [];
    for (const el of elements) {
      if (balance.has(el)) continue;
      const d = (user[el] ?? 0) - (target[el] ?? 0);
      distance += Math.abs(d);
      if (Math.abs(d) >= 0.05) deltas.push({ element: el, delta: d });
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { uns: g.uns, name: g.name, distance, deltas };
  });
  return matches.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
