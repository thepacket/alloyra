/** Chemical composition handling. All element contents are in weight percent. */

export type ElementSymbol =
  | "C" | "Mn" | "Si" | "P" | "S" | "Cr" | "Ni" | "Mo" | "N" | "Cu" | "W"
  | "Nb" | "Ti" | "Al" | "V" | "Fe" | "Zn" | "Mg" | "O" | "H" | "Ta" | "Co"
  | "Sn" | "Pb" | "Zr" | "B";

/**
 * A per-element specification range (wt%). `min` absent means "≤ max";
 * `max` absent means "≥ min"; `balance` marks the base element.
 */
export interface CompositionRange {
  element: ElementSymbol;
  min?: number;
  max?: number;
  balance?: boolean;
  note?: string;
}

/**
 * A resolved single-point composition (wt%).
 * ABSENT means UNKNOWN — never zero. A known-zero content must be an
 * explicit 0. Calculators declare which elements they require and return
 * indeterminate results when a required element is unknown (missingness
 * propagates; it is never silently treated as 0).
 */
export type Composition = Partial<Record<ElementSymbol, number>>;

/** Elements of `req` that the composition does not specify. */
export function missingElements(
  c: Composition,
  req: readonly ElementSymbol[],
): ElementSymbol[] {
  return req.filter((el) => c[el] === undefined);
}

/**
 * Resolve a spec range to a point composition using range midpoints.
 * "≤ max" elements resolve to 0 by default (residuals), unless
 * `includeResidualsAtHalfMax` is set — the caller decides, and the UI must
 * label the result COMPUTED either way.
 */
export function midpointComposition(
  ranges: readonly CompositionRange[],
  opts: { includeResidualsAtHalfMax?: boolean } = {},
): Composition {
  const out: Composition = {};
  for (const r of ranges) {
    if (r.balance) continue;
    if (r.min !== undefined && r.max !== undefined) {
      out[r.element] = (r.min + r.max) / 2;
    } else if (r.min !== undefined) {
      out[r.element] = r.min;
    } else if (r.max !== undefined) {
      out[r.element] = opts.includeResidualsAtHalfMax ? r.max / 2 : 0;
    }
  }
  return out;
}

export function wt(c: Composition, el: ElementSymbol): number {
  return c[el] ?? 0;
}
