import type { Composition, ElementSymbol } from "../composition.ts";
import { missingElements, wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";
import { indeterminate } from "./types.ts";

const REQUIRED: ElementSymbol[] = ["C", "Mn"];
const OPTIONAL: ElementSymbol[] = ["Cr", "Mo", "V", "Ni", "Cu"];

/**
 * Carbon equivalent, IIW formula — weldability / hydrogen-cracking
 * susceptibility screening for C-Mn and low-alloy steels:
 *   CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15
 * C and Mn dominate; a composition that does not specify them cannot
 * yield a CE (missing chemistry is unknown, not zero).
 */
export function ceIIW(c: Composition): CalcResult {
  const base = {
    unit: "",
    formula: "CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15",
    source: { citation: "IIW carbon equivalent (IIW Doc. IX-535-67)" },
  };
  const missing = missingElements(c, REQUIRED);
  if (missing.length > 0) return indeterminate(missing, base);

  const warnings: string[] = [];
  const absent = missingElements(c, OPTIONAL);
  if (absent.length > 0) {
    warnings.push(`Not specified, taken as 0 (affects the value): ${absent.join(", ")}.`);
  }
  const value =
    wt(c, "C") +
    wt(c, "Mn") / 6 +
    (wt(c, "Cr") + wt(c, "Mo") + wt(c, "V")) / 5 +
    (wt(c, "Ni") + wt(c, "Cu")) / 15;
  let inWindow = true;
  if (wt(c, "C") < 0.12) {
    warnings.push("C < 0.12 wt% — Pcm is usually preferred over CE(IIW) for low-carbon steels.");
  }
  if (wt(c, "Cr") > 10.5) {
    inWindow = false;
    warnings.push("Stainless composition — CE(IIW) does not apply.");
  }
  const dominant = (Object.entries(c) as [string, number][]).find(
    ([el, v]) => el !== "Fe" && v > 50,
  );
  if (dominant) {
    inWindow = false;
    warnings.push(`${dominant[0]}-dominant composition — CE(IIW) applies to steels only.`);
  }
  return { ...base, value, inWindow, warnings };
}
