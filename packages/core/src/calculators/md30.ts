import type { Composition, ElementSymbol } from "../composition.ts";
import { missingElements, wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";
import { indeterminate } from "./types.ts";

const REQUIRED: ElementSymbol[] = ["C", "N", "Cr", "Ni"];
const OPTIONAL: ElementSymbol[] = ["Si", "Mn", "Cu", "Mo", "Nb"];

/**
 * Md30 — austenite stability (Nohara):
 *   Md30(°C) = 551 − 462(C+N) − 9.2·Si − 8.1·Mn − 13.7·Cr − 29(Ni+Cu)
 *              − 18.5·Mo − 68·Nb − 1.42(ν−8)
 * C+N carry a 462× weight and are required. The grain-size term −1.42(ν−8)
 * (ν = ASTM E112 number) applies only when a grain size is supplied
 * (B-107); without one the term is omitted and the note says so.
 * Lower = more stable austenite.
 */
export function md30Nohara(
  c: Composition,
  opts?: { grainSizeAstm?: number },
): CalcResult {
  const nu = opts?.grainSizeAstm;
  const base = {
    unit: "°C",
    formula:
      `Md30 = 551 − 462(C+N) − 9.2·Si − 8.1·Mn − 13.7·Cr − 29(Ni+Cu) − 18.5·Mo − 68·Nb${nu !== undefined ? " − 1.42(ν−8)" : ""}`,
    source: {
      citation: "Nohara, Ono & Ohashi (1977), Tetsu-to-Hagané 63",
      note:
        nu !== undefined
          ? `Empirical; grain-size term included with ν = ${nu} (ASTM E112). Strain-induced martensite context (formability, permeability drift).`
          : "Empirical; grain-size term −1.42(ν−8) omitted — supply a grain size in the studio to include it. Strain-induced martensite context (formability, permeability drift).",
    },
  };
  const missing = missingElements(c, REQUIRED);
  if (missing.length > 0) return indeterminate(missing, base);

  const warnings: string[] = [];
  const absent = missingElements(c, OPTIONAL);
  if (absent.length > 0) {
    warnings.push(`Not specified, taken as 0 (affects the value): ${absent.join(", ")}.`);
  }
  const value =
    551 -
    462 * (wt(c, "C") + wt(c, "N")) -
    9.2 * wt(c, "Si") -
    8.1 * wt(c, "Mn") -
    13.7 * wt(c, "Cr") -
    29 * (wt(c, "Ni") + wt(c, "Cu")) -
    18.5 * wt(c, "Mo") -
    68 * wt(c, "Nb") -
    (nu !== undefined ? 1.42 * (nu - 8) : 0);
  let inWindow = true;
  if (wt(c, "Cr") < 15 || wt(c, "Ni") < 5) {
    inWindow = false;
    warnings.push(
      "Composition is not a typical austenitic stainless — Nohara's relation does not apply.",
    );
  }
  return { ...base, value, inWindow, warnings };
}
