import type { Composition } from "../composition.ts";
import { wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";

/**
 * Martensite-start temperature, Andrews linear relation (steels):
 *   Ms(°C) = 539 − 423·C − 30.4·Mn − 17.7·Ni − 12.1·Cr − 7.5·Mo
 * Validated roughly for C ≤ 0.6 wt% low-alloy steels.
 */
export function msAndrews(c: Composition): CalcResult {
  const value =
    539 -
    423 * wt(c, "C") -
    30.4 * wt(c, "Mn") -
    17.7 * wt(c, "Ni") -
    12.1 * wt(c, "Cr") -
    7.5 * wt(c, "Mo");
  const warnings: string[] = [];
  let inWindow = true;
  if (wt(c, "C") > 0.6) {
    inWindow = false;
    warnings.push("C > 0.6 wt% — outside Andrews' validated composition window.");
  }
  if (wt(c, "Cr") + wt(c, "Ni") > 12) {
    inWindow = false;
    warnings.push("High-alloy composition — Andrews' relation is for low-alloy steels.");
  }
  const dominant = (Object.entries(c) as [string, number][]).find(
    ([el, v]) => el !== "Fe" && v > 50,
  );
  if (dominant) {
    inWindow = false;
    warnings.push(`${dominant[0]}-dominant composition — Andrews' relation applies to steels only.`);
  }
  return {
    value,
    unit: "°C",
    formula: "Ms = 539 − 423·C − 30.4·Mn − 17.7·Ni − 12.1·Cr − 7.5·Mo",
    source: { citation: "Andrews (1965), JISI 203, 721–727" },
    inWindow,
    warnings,
  };
}
