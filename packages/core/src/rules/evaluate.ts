import { midpointComposition, wt } from "../composition.ts";
import type { CompositionRange, ElementSymbol } from "../composition.ts";
import { tensileStressPresent } from "../duty.ts";
import type { DutyInput } from "../duty.ts";
import { pren } from "../calculators/pren.ts";
import type {
  AuditStatus,
  CandidateFacts,
  Clause,
  FailureRule,
  RuleAudit,
} from "./types.ts";

type ClauseResult =
  | { r: "hit"; because: string }
  | { r: "near"; because: string }
  | { r: "miss" }
  | { r: "unknown"; field: string };

function familyMatches(family: string[], path: string[]): boolean {
  return path.every((seg, i) => family[i] === seg);
}

/** Mid-spec content; balance elements estimated by difference from 100 %. */
export function estimateContent(
  ranges: readonly CompositionRange[],
  element: ElementSymbol,
): number {
  const r = ranges.find((x) => x.element === element);
  if (!r) return 0;
  if (!r.balance) {
    if (r.min !== undefined && r.max !== undefined) return (r.min + r.max) / 2;
    return r.min ?? 0;
  }
  let others = 0;
  for (const o of ranges) {
    if (o.balance) continue;
    if (o.min !== undefined && o.max !== undefined) others += (o.min + o.max) / 2;
    else if (o.min !== undefined) others += o.min;
  }
  return Math.max(0, 100 - others);
}

function numericGate(
  actual: number,
  op: ">=" | "<=",
  value: number,
  nearBand: number | undefined,
  label: string,
): ClauseResult {
  const met = op === ">=" ? actual >= value : actual <= value;
  if (met) return { r: "hit", because: `${label} (${actual} vs ${op} ${value})` };
  if (nearBand !== undefined) {
    const nearOk =
      op === ">="
        ? actual >= value * (1 - nearBand)
        : actual <= value * (1 + nearBand);
    if (nearOk) {
      return {
        r: "near",
        because: `${label} — within ${Math.round(nearBand * 100)} % of the ${value} threshold (${actual}); thresholds are soft`,
      };
    }
  }
  return { r: "miss" };
}

function evalClause(
  c: Clause,
  f: CandidateFacts,
  d: DutyInput,
): ClauseResult {
  switch (c.kind) {
    case "family":
      return familyMatches(f.family, c.path)
        ? { r: "hit", because: `alloy family is ${c.path.join(" → ")}` }
        : { r: "miss" };
    case "notFamily":
      return familyMatches(f.family, c.path) ? { r: "miss" } : { r: "hit", because: `alloy is not ${c.path.join(" → ")}` };
    case "specMaxAbove": {
      const range = f.composition.find((x) => x.element === c.element);
      const max = range?.max;
      return max !== undefined && max > c.above
        ? { r: "hit", because: `spec allows ${c.element} up to ${max} wt% (> ${c.above})` }
        : { r: "miss" };
    }
    case "contentAtLeast": {
      const est = estimateContent(f.composition, c.element);
      return est >= c.wtPct
        ? { r: "hit", because: `≈ ${est.toFixed(1)} wt% ${c.element} (≥ ${c.wtPct})` }
        : { r: "miss" };
    }
    case "yieldAtLeast": {
      if (f.yieldMPa === undefined) return { r: "unknown", field: "yield strength for this condition" };
      return numericGate(f.yieldMPa, ">=", c.mpa, c.nearBand, "yield strength");
    }
    case "conditionIncludes":
      return f.conditionName.toLowerCase().includes(c.text.toLowerCase())
        ? { r: "hit", because: `condition is "${f.conditionName}"` }
        : { r: "miss" };
    case "conditionExcludes":
      return f.conditionName.toLowerCase().includes(c.text.toLowerCase())
        ? { r: "miss" }
        : { r: "hit", because: `condition "${f.conditionName}" is not ${c.text}` };
    case "prenBelow": {
      const p = pren(midpointComposition([...f.composition]));
      if (!p.inWindow) return { r: "miss" };
      return p.value < c.value
        ? { r: "hit", because: `PREN ≈ ${p.value.toFixed(1)} (mid-spec) < ${c.value}` }
        : { r: "miss" };
    }
    case "homologousTempAbove": {
      if (f.solidusK === undefined) return { r: "unknown", field: "solidus temperature" };
      if (d.tempMaxC === null) return { r: "unknown", field: "max service temperature" };
      const tK = d.tempMaxC + 273.15;
      return numericGate(
        Number((tK / f.solidusK).toFixed(3)),
        ">=",
        c.fraction,
        c.nearBand,
        "homologous temperature T/T_solidus",
      );
    }
    case "duty": {
      const v = d[c.field];
      if (v === null) return { r: "unknown", field: c.field };
      return numericGate(v, c.op, c.value, c.nearBand, c.field);
    }
    case "dutyFlag":
      return d[c.field] === c.value
        ? { r: "hit", because: `${c.field} = ${c.value}` }
        : { r: "miss" };
    case "mediumIn":
      return c.anyOf.includes(d.medium)
        ? { r: "hit", because: `medium is ${d.medium}` }
        : { r: "miss" };
    case "loadIn":
      return c.anyOf.includes(d.loadType)
        ? { r: "hit", because: `load type is ${d.loadType}` }
        : { r: "miss" };
    case "tensileStress":
      return tensileStressPresent(d)
        ? {
            r: "hit",
            because: d.welded
              ? "tensile stress present (welded — residual stress counts)"
              : "sustained tensile design stress present",
          }
        : { r: "miss" };
    case "galvanicCouplePresent":
      return d.galvanicCouple.trim() !== ""
        ? { r: "hit", because: `galvanic couple with ${d.galvanicCouple.trim()}` }
        : { r: "miss" };
    case "lmeContact":
      return c.anyOf.includes(d.lmeContact as never)
        ? { r: "hit", because: `molten-metal contact: ${d.lmeContact}` }
        : { r: "miss" };
  }
}

/** Human-readable clause text for the rules browser (R-5.3: reviewable). */
export function describeClause(c: Clause): string {
  switch (c.kind) {
    case "family": return `alloy family is ${c.path.join(" → ")}`;
    case "notFamily": return `alloy family is NOT ${c.path.join(" → ")}`;
    case "specMaxAbove": return `spec allows ${c.element} > ${c.above} wt%`;
    case "contentAtLeast": return `≥ ${c.wtPct} wt% ${c.element} (mid-spec estimate)`;
    case "yieldAtLeast": return `yield strength ≥ ${c.mpa} MPa${c.nearBand ? ` (±${Math.round(c.nearBand * 100)} % near-band)` : ""}`;
    case "conditionIncludes": return `condition includes "${c.text}"`;
    case "conditionExcludes": return `condition does not include "${c.text}"`;
    case "prenBelow": return `PREN (mid-spec) < ${c.value}`;
    case "homologousTempAbove": return `T_service > ${c.fraction} × T_solidus${c.nearBand ? ` (±${Math.round(c.nearBand * 100)} % near-band)` : ""}`;
    case "duty": return `${c.field} ${c.op} ${c.value}${c.nearBand ? ` (±${Math.round(c.nearBand * 100)} % near-band)` : ""}`;
    case "dutyFlag": return `${c.field} is ${c.value ? "yes" : "no"}`;
    case "mediumIn": return `medium is ${c.anyOf.join(" or ")}`;
    case "loadIn": return `load type is ${c.anyOf.join(" or ")}`;
    case "tensileStress": return "sustained tensile stress present (design stress, or residual from welding)";
    case "galvanicCouplePresent": return "a galvanic couple is declared";
    case "lmeContact": return `molten-metal contact with ${c.anyOf.join(" or ")}`;
  }
}

/** Audit one candidate against the full rule set (R-5.1). */
export function evaluateRules(
  facts: CandidateFacts,
  duty: DutyInput,
  rules: readonly FailureRule[],
): RuleAudit[] {
  return rules.map((rule) => {
    const because: string[] = [];
    const unchecked: string[] = [];
    let sawNear = false;
    let miss = false;
    for (const clause of rule.when) {
      const res = evalClause(clause, facts, duty);
      if (res.r === "miss") {
        miss = true;
        break;
      }
      if (res.r === "unknown") {
        unchecked.push(res.field);
        miss = true; // cannot confirm — do not flag, but do report the gap
        continue;
      }
      if (res.r === "near") sawNear = true;
      because.push(res.because);
    }
    const status: AuditStatus = miss ? "clear" : sawNear ? "near" : "hit";
    return {
      rule,
      status,
      because: status === "clear" ? [] : because,
      unchecked,
    };
  });
}
