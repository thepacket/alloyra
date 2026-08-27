import type { Composition, ElementSymbol } from "../composition.ts";
import { missingElements, wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";
import { indeterminate } from "./types.ts";

export type PrenVariant = "N16" | "N30";

const REQUIRED: ElementSymbol[] = ["Cr"];
const OPTIONAL: ElementSymbol[] = ["Mo", "N", "W"];

/**
 * Pitting Resistance Equivalent Number for stainless steels.
 * PREN = %Cr + 3.3(%Mo + 0.5·%W) + k·%N, k = 16 (default) or 30.
 * Comparative screening index only — it ranks alloys, it does not set a
 * service boundary (temperature, pH, potential, deposits all matter).
 */
export function pren(c: Composition, variant: PrenVariant = "N16"): CalcResult {
  const k = variant === "N16" ? 16 : 30;
  const base = {
    unit: "",
    formula: `PREN = %Cr + 3.3(%Mo + 0.5·%W) + ${k}·%N`,
    source: {
      citation: "Pitting resistance equivalent, standard screening relation",
      note: "Comparative index within stainless families only; not a service guarantee and not a threshold.",
    },
  };
  const missing = missingElements(c, REQUIRED);
  if (missing.length > 0) return indeterminate(missing, base);

  const warnings: string[] = [];
  const absent = missingElements(c, OPTIONAL);
  if (absent.length > 0) {
    warnings.push(`Not specified, taken as 0 (affects the value): ${absent.join(", ")}.`);
  }
  const cr = wt(c, "Cr");
  const value = cr + 3.3 * (wt(c, "Mo") + 0.5 * wt(c, "W")) + k * wt(c, "N");
  let inWindow = true;
  if (cr < 10.5) {
    inWindow = false;
    warnings.push("Cr < 10.5 wt% — not a stainless steel; PREN is not meaningful.");
  }
  return { ...base, value, inWindow, warnings };
}
