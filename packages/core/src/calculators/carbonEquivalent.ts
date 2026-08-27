import type { Composition } from "../composition.ts";
import { wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";

/**
 * Carbon equivalent, IIW formula — weldability / hydrogen-cracking
 * susceptibility screening for C-Mn and low-alloy steels:
 *   CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15
 * Intended for C ≳ 0.12 %; Pcm is preferred below that (later variant).
 */
export function ceIIW(c: Composition): CalcResult {
  const value =
    wt(c, "C") +
    wt(c, "Mn") / 6 +
    (wt(c, "Cr") + wt(c, "Mo") + wt(c, "V")) / 5 +
    (wt(c, "Ni") + wt(c, "Cu")) / 15;
  const warnings: string[] = [];
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
  return {
    value,
    unit: "",
    formula: "CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15",
    source: { citation: "IIW carbon equivalent (IIW Doc. IX-535-67)" },
    inWindow,
    warnings,
  };
}
