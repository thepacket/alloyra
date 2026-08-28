import {
  midpointComposition,
  type CompositionRange,
  type ElementSymbol,
} from "../composition.ts";

/**
 * Grade-to-grade similarity ranking (B-302): symmetric closeness between
 * two grades' MID-SPEC compositions, itemized per element so the ranking
 * is auditable ("closest because ΔMo 0.8, ΔCr 1.0"), with an optional
 * property term when both grades document a spec-min yield.
 *
 * Grades are only compared within the same base metal — cross-base
 * "similarity" is chemically meaningless and is not ranked.
 */

export interface SimilarGradeInput {
  uns: string;
  name: string;
  familyRoot: string;
  composition: readonly CompositionRange[];
  yieldMPa?: number;
}

export interface ElementDelta {
  element: ElementSymbol;
  a: number;
  b: number;
  /** |a − b| / (mean + 0.5) — scale-normalized so majors dominate but a
   *  1 wt% swing on a lean addition still registers. */
  contribution: number;
}

export interface SimilarGradeMatch {
  uns: string;
  name: string;
  distance: number;
  /** Largest element differences first. */
  deltas: ElementDelta[];
  /** Present when both grades document spec-min yield. */
  yieldNote?: string;
}

export function similarGrades(
  target: SimilarGradeInput,
  pool: readonly SimilarGradeInput[],
  limit = 5,
): SimilarGradeMatch[] {
  const midA = midpointComposition(target.composition, { includeResidualsAtHalfMax: true });
  const out: SimilarGradeMatch[] = [];

  for (const g of pool) {
    if (g.uns === target.uns) continue;
    if (g.familyRoot !== target.familyRoot) continue;
    const midB = midpointComposition(g.composition, { includeResidualsAtHalfMax: true });
    const elements = new Set<ElementSymbol>([
      ...(Object.keys(midA) as ElementSymbol[]),
      ...(Object.keys(midB) as ElementSymbol[]),
    ]);
    const deltas: ElementDelta[] = [];
    let distance = 0;
    for (const el of elements) {
      const a = midA[el] ?? 0;
      const b = midB[el] ?? 0;
      if (a === 0 && b === 0) continue;
      const contribution = Math.abs(a - b) / ((a + b) / 2 + 0.5);
      if (contribution > 0) deltas.push({ element: el, a, b, contribution });
      distance += contribution;
    }
    deltas.sort((x, y) => y.contribution - x.contribution);

    let yieldNote: string | undefined;
    if (target.yieldMPa !== undefined && g.yieldMPa !== undefined) {
      distance += Math.abs(target.yieldMPa - g.yieldMPa) / 500;
      yieldNote = `σy min ${g.yieldMPa} vs ${target.yieldMPa} MPa`;
    }

    out.push({
      uns: g.uns,
      name: g.name,
      distance,
      deltas: deltas.slice(0, 4),
      ...(yieldNote !== undefined ? { yieldNote } : {}),
    });
  }

  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
