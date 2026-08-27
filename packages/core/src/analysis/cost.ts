import type { Composition, ElementSymbol } from "../composition.ts";

/**
 * Element cost roll-up (R-4.5): Σ (wt%/100 × price/kg) over the full
 * composition, balance included. Prices come from the USER'S editable
 * table — Alloyra ships placeholders, never market data.
 */
export interface CostResult {
  /** currency per kg of alloy — raw-element basis only. */
  perKg: number;
  /** Elements present in the composition but missing a price. */
  unpriced: ElementSymbol[];
}

export function elementCost(
  composition: Composition,
  pricePerKg: Partial<Record<ElementSymbol, number>>,
): CostResult {
  let perKg = 0;
  const unpriced: ElementSymbol[] = [];
  for (const [el, pct] of Object.entries(composition) as [ElementSymbol, number][]) {
    if (pct <= 0) continue;
    const price = pricePerKg[el];
    if (price === undefined) {
      unpriced.push(el);
      continue;
    }
    perKg += (pct / 100) * price;
  }
  return { perKg, unpriced };
}
