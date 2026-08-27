import type { Composition } from "../composition.ts";
import { wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";

export interface Wrc1992Result {
  creq: CalcResult;
  nieq: CalcResult;
}

/**
 * WRC-1992 chromium and nickel equivalents for weld-metal constitution.
 *   Creq = Cr + Mo + 0.7·Nb
 *   Nieq = Ni + 35·C + 20·N + 0.25·Cu
 * Valid for the WRC-1992 diagram's composition window (austenitic and
 * duplex stainless weld metals).
 */
export function wrc1992(c: Composition): Wrc1992Result {
  const creqV = wt(c, "Cr") + wt(c, "Mo") + 0.7 * wt(c, "Nb");
  const nieqV = wt(c, "Ni") + 35 * wt(c, "C") + 20 * wt(c, "N") + 0.25 * wt(c, "Cu");
  const warnings: string[] = [];
  let inWindow = true;
  // Diagram axes: Creq 17–31, Nieq 9–18.
  if (creqV < 17 || creqV > 31 || nieqV < 9 || nieqV > 18) {
    inWindow = false;
    warnings.push(
      "Outside the WRC-1992 diagram window (Creq 17–31, Nieq 9–18); ferrite prediction not valid.",
    );
  }
  const source = {
    citation: "Kotecki & Siewert, WRC Bulletin 342 (1992)",
  };
  return {
    creq: {
      value: creqV,
      unit: "",
      formula: "Creq = Cr + Mo + 0.7·Nb",
      source,
      inWindow,
      warnings,
    },
    nieq: {
      value: nieqV,
      unit: "",
      formula: "Nieq = Ni + 35·C + 20·N + 0.25·Cu",
      source,
      inWindow,
      warnings,
    },
  };
}
