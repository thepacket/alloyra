import type { Composition } from "../composition.ts";
import { wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";

export type PrenVariant = "N16" | "N30";

/**
 * Pitting Resistance Equivalent Number for stainless steels.
 * PREN = %Cr + 3.3(%Mo + 0.5·%W) + k·%N, k = 16 (default) or 30
 * (sometimes used for duplex grades).
 */
export function pren(c: Composition, variant: PrenVariant = "N16"): CalcResult {
  const k = variant === "N16" ? 16 : 30;
  const cr = wt(c, "Cr");
  const value = cr + 3.3 * (wt(c, "Mo") + 0.5 * wt(c, "W")) + k * wt(c, "N");
  const warnings: string[] = [];
  let inWindow = true;
  if (cr < 10.5) {
    inWindow = false;
    warnings.push(
      "Cr < 10.5 wt% — not a stainless steel; PREN is not meaningful.",
    );
  }
  return {
    value,
    unit: "",
    formula: `PREN = %Cr + 3.3(%Mo + 0.5·%W) + ${k}·%N`,
    source: {
      citation: "Pitting resistance equivalent, standard screening relation",
      note: "Screening only; ranks pitting/crevice resistance within stainless families. Not a service guarantee.",
    },
    inWindow,
    warnings,
  };
}
