import type { Composition, ElementSymbol } from "../composition.ts";
import { missingElements, wt } from "../composition.ts";
import type { CalcResult } from "./types.ts";
import { indeterminate } from "./types.ts";

const REQUIRED: ElementSymbol[] = ["C", "Mn"];
const OPTIONAL: ElementSymbol[] = ["Ni", "Cr", "Mo"];

/**
 * Martensite-start temperature, Andrews linear relation (steels):
 *   Ms(°C) = 539 − 423·C − 30.4·Mn − 17.7·Ni − 12.1·Cr − 7.5·Mo
 * Empirical fit with no published error assessment; validated roughly
 * for C ≤ 0.6 wt% low-alloy steels. Returns unknown when C or Mn is
 * unspecified — an Ms of 539 °C is pure iron, not your steel.
 */
export function msAndrews(c: Composition): CalcResult {
  const base = {
    unit: "°C",
    formula: "Ms = 539 − 423·C − 30.4·Mn − 17.7·Ni − 12.1·Cr − 7.5·Mo",
    source: {
      citation: "Andrews (1965), JISI 203, 721–727",
      note: "Empirical regression; no error bands published — treat as ±~25 °C class guidance, not a setpoint.",
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
    539 -
    423 * wt(c, "C") -
    30.4 * wt(c, "Mn") -
    17.7 * wt(c, "Ni") -
    12.1 * wt(c, "Cr") -
    7.5 * wt(c, "Mo");
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
  return { ...base, value, inWindow, warnings };
}
