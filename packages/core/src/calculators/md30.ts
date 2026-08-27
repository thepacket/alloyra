import type { Composition } from "../composition.ts";
import { wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";

/**
 * Md30 — austenite stability (Nohara), the temperature at which 50 %
 * martensite forms at 0.30 true strain:
 *   Md30(°C) = 551 − 462(C+N) − 9.2·Si − 8.1·Mn − 13.7·Cr − 29(Ni+Cu)
 *              − 18.5·Mo − 68·Nb
 * Grain-size term omitted (no grain-size input yet) — noted in source.
 * Lower (more negative) = more stable austenite.
 */
export function md30Nohara(c: Composition): CalcResult {
  const value =
    551 -
    462 * (wt(c, "C") + wt(c, "N")) -
    9.2 * wt(c, "Si") -
    8.1 * wt(c, "Mn") -
    13.7 * wt(c, "Cr") -
    29 * (wt(c, "Ni") + wt(c, "Cu")) -
    18.5 * wt(c, "Mo") -
    68 * wt(c, "Nb");
  const warnings: string[] = [];
  let inWindow = true;
  if (wt(c, "Cr") < 15 || wt(c, "Ni") < 5) {
    inWindow = false;
    warnings.push(
      "Composition is not a typical austenitic stainless — Nohara's relation does not apply.",
    );
  }
  return {
    value,
    unit: "°C",
    formula:
      "Md30 = 551 − 462(C+N) − 9.2·Si − 8.1·Mn − 13.7·Cr − 29(Ni+Cu) − 18.5·Mo − 68·Nb",
    source: {
      citation: "Nohara, Ono & Ohashi (1977), Tetsu-to-Hagané 63",
      note: "Grain-size term −1.42(ν−8) omitted; strain-induced martensite context (formability, permeability drift).",
    },
    inWindow,
    warnings,
  };
}
