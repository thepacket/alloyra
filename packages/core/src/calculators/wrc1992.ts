import type { Composition, ElementSymbol } from "../composition.ts";
import { missingElements, wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";
import { indeterminate } from "./types.ts";

export interface Wrc1992Result {
  creq: CalcResult;
  nieq: CalcResult;
}

const REQUIRED: ElementSymbol[] = ["Cr", "Ni", "C", "N"];
const OPTIONAL: ElementSymbol[] = ["Mo", "Nb", "Cu"];

/**
 * WRC-1992 chromium and nickel equivalents:
 *   Creq = Cr + Mo + 0.7·Nb
 *   Nieq = Ni + 35·C + 20·N + 0.25·Cu
 * Developed for STAINLESS-STEEL WELD METAL ferrite prediction — it is
 * not a generic wrought-alloy property model, and actual weld ferrite
 * also depends on welding conditions (cooling rate, dilution).
 * C and N carry 35× / 20× weights, so they are required inputs.
 */
export function wrc1992(c: Composition): Wrc1992Result {
  const source = {
    citation: "Kotecki & Siewert, WRC Bulletin 342 (1992)",
    note: "Weld-metal constitution model; welding conditions affect real ferrite content.",
  };
  const creqBase = { unit: "", formula: "Creq = Cr + Mo + 0.7·Nb", source };
  const nieqBase = { unit: "", formula: "Nieq = Ni + 35·C + 20·N + 0.25·Cu", source };

  const missing = missingElements(c, REQUIRED);
  if (missing.length > 0) {
    return {
      creq: indeterminate(missing, creqBase),
      nieq: indeterminate(missing, nieqBase),
    };
  }

  const warnings: string[] = [];
  const absent = missingElements(c, OPTIONAL);
  if (absent.length > 0) {
    warnings.push(`Not specified, taken as 0 (affects the value): ${absent.join(", ")}.`);
  }
  const creqV = wt(c, "Cr") + wt(c, "Mo") + 0.7 * wt(c, "Nb");
  const nieqV = wt(c, "Ni") + 35 * wt(c, "C") + 20 * wt(c, "N") + 0.25 * wt(c, "Cu");
  let inWindow = true;
  // Diagram axes: Creq 17–31, Nieq 9–18.
  if (creqV < 17 || creqV > 31 || nieqV < 9 || nieqV > 18) {
    inWindow = false;
    warnings.push(
      "Outside the WRC-1992 diagram window (Creq 17–31, Nieq 9–18); ferrite prediction not valid.",
    );
  }
  return {
    creq: { ...creqBase, value: creqV, inWindow, warnings },
    nieq: { ...nieqBase, value: nieqV, inWindow, warnings },
  };
}
