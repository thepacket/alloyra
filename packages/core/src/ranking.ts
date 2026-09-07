import { midpointComposition } from "./composition.ts";
import type { DutyInput } from "./duty.ts";
import { prenForFamily } from "./calculators/pren.ts";
import type { CandidateFacts, RuleAudit } from "./rules/types.ts";

/**
 * Transparent candidate scoring (R-3.1): every criterion's raw value,
 * weight, and contribution is itemized; nothing is folded into an opaque
 * number. Hard constraints eliminate with a stated reason (R-3.2).
 */
export interface Weights {
  strength: number;
  corrosion: number;
  auditCleanliness: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  strength: 1,
  corrosion: 1,
  auditCleanliness: 1,
};

/**
 * A caller-supplied scoring criterion (e.g. the comparison view's
 * castability index from Scheil results). The caller owns the raw value
 * and its normalization; ranking only folds it into the same transparent
 * weighted mean. `included: false` = N/A, excluded like any other N/A.
 */
export interface ExtraCriterion {
  id: string;
  label: string;
  /** Normalized 0–1; ignored when `included` is false. */
  raw: number;
  weight: number;
  note: string;
  included: boolean;
}

export interface Contribution {
  criterion: string;
  label: string;
  /** Normalized 0–1; NaN when the criterion is N/A. */
  raw: number;
  weight: number;
  /** raw × weight — what actually moves the score. */
  points: number;
  note: string;
  /** False = N/A: excluded from the weighted mean entirely. */
  included: boolean;
}

export interface RankResult {
  eliminated: boolean;
  eliminationReasons: string[];
  contributions: Contribution[];
  /** 0–100, weighted mean of raws. NaN when every weight is zero. */
  score: number;
  /** Weighted share of requested criteria with usable inputs; not confidence. */
  coveragePercent: number;
  /** Partial results are inspectable but must not be automatically ranked. */
  scoreComplete: boolean;
  evidenceGaps: string[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function rankCandidate(
  facts: CandidateFacts,
  duty: DutyInput,
  audits: readonly RuleAudit[],
  weights: Weights = DEFAULT_WEIGHTS,
  extra: readonly ExtraCriterion[] = [],
): RankResult {
  const safeWeight = (w: number) => Number.isFinite(w) && w > 0 ? w : 0;
  weights = { strength: safeWeight(weights.strength), corrosion: safeWeight(weights.corrosion), auditCleanliness: safeWeight(weights.auditCleanliness) };
  extra = extra.map((c) => ({ ...c, weight: safeWeight(c.weight), included: c.included && Number.isFinite(c.raw) }));
  const eliminationReasons: string[] = [];
  const evidenceGaps: string[] = [];
  // A single-temperature record is not a temperature-dependent property.
  // No unvalidated tolerance or extrapolation is silently introduced.
  const strengthIncluded = facts.yieldMPa !== undefined && Number.isFinite(facts.yieldMPa)
    && facts.yieldMPa > 0 && facts.yieldTestTempC !== undefined
    && Number.isFinite(facts.yieldTestTempC) && duty.tempMaxC !== null
    && duty.tempMaxC === facts.yieldTestTempC;

  // Hard constraint: yield below design stress.
  if (
    duty.designStressMPa !== null &&
    strengthIncluded && facts.yieldMPa !== undefined &&
    facts.yieldMPa < duty.designStressMPa
  ) {
    eliminationReasons.push(
      `Yield strength ${facts.yieldMPa} MPa is below the design stress ${duty.designStressMPa} MPa.`,
    );
  }

  // Hard constraint: any disqualifying rule hit.
  for (const a of audits) {
    if (a.status === "hit" && a.rule.severity === "disqualifying") {
      eliminationReasons.push(
        `${a.rule.name} (${a.rule.citation}) — disqualifying under the current rule set.`,
      );
    }
  }

  // Strength margin.
  let strengthRaw: number;
  let strengthNote: string;
  if (!strengthIncluded) {
    strengthRaw = Number.NaN;
    strengthNote = facts.yieldMPa === undefined || !Number.isFinite(facts.yieldMPa) || facts.yieldMPa <= 0
      ? "No usable yield value for this condition."
      : facts.yieldTestTempC === undefined || !Number.isFinite(facts.yieldTestTempC)
        ? "Yield test temperature is undocumented."
        : duty.tempMaxC === null
          ? "Service temperature is unspecified; yield applicability cannot be checked."
          : `Yield is recorded at ${facts.yieldTestTempC} °C; duty is ${duty.tempMaxC} °C. Supply yield data at the duty temperature; no extrapolation is applied.`;
  } else if (duty.designStressMPa !== null && duty.designStressMPa > 0) {
    strengthRaw = clamp01(1 - duty.designStressMPa / facts.yieldMPa!);
    strengthNote = `Margin: 1 − σ_design/σ_y = 1 − ${duty.designStressMPa}/${facts.yieldMPa}, at ${facts.yieldTestTempC} °C. Screening only; not a design allowable.`;
  } else {
    strengthRaw = clamp01(facts.yieldMPa! / 1000);
    strengthNote = `No positive design stress given — normalized σ_y / 1000 MPa at ${facts.yieldTestTempC} °C; not a stress margin.`;
  }
  if (!strengthIncluded && weights.strength > 0) evidenceGaps.push(strengthNote);

  const p = prenForFamily(midpointComposition([...facts.composition]), facts.family);
  const corrosionIncluded = p.inWindow && Number.isFinite(p.value);
  const corrosionRaw = corrosionIncluded ? clamp01(p.value / 45) : Number.NaN;
  const corrosionNote = corrosionIncluded
    ? `PREN ≈ ${p.value.toFixed(1)} / 45. Range midpoints; max-only residuals omitted. Stainless-family screening index, not service-specific corrosion performance.`
    : "No applicable corrosion index for this composition and family. No neutral score is assigned.";
  if (!corrosionIncluded && weights.corrosion > 0) evidenceGaps.push(corrosionNote);

  // Audit cleanliness — meaningful ONLY when rules actually ran. With
  // zero rules the criterion is N/A and drops out of the weighted mean
  // (never neutral, never perfect). Indeterminate results (missing duty
  // data) deduct: missing information lowers the score, it never helps.
  const auditIncluded = audits.length > 0;
  let auditRaw = 1;
  const hits: string[] = [];
  for (const a of audits) {
    if (a.status === "hit") {
      auditRaw -= a.rule.severity === "serious" ? 0.4 : 0.15;
      hits.push(`${a.rule.name} (${a.rule.severity})`);
    } else if (a.status === "near") {
      auditRaw -= 0.05;
      hits.push(`${a.rule.name} (near-miss)`);
    } else if (a.status === "indeterminate") {
      auditRaw -= 0.1;
      hits.push(`${a.rule.name} (indeterminate — insufficient duty data)`);
    }
  }
  auditRaw = clamp01(auditRaw);

  const contributions: Contribution[] = [
    {
      criterion: "strength",
      label: "Strength margin",
      raw: strengthRaw,
      weight: weights.strength,
      points: strengthIncluded ? strengthRaw * weights.strength : 0,
      note: strengthNote,
      included: strengthIncluded,
    },
    {
      criterion: "corrosion",
      label: "Corrosion index",
      raw: corrosionRaw,
      weight: weights.corrosion,
      points: corrosionIncluded ? corrosionRaw * weights.corrosion : 0,
      note: corrosionNote,
      included: corrosionIncluded,
    },
    {
      criterion: "auditCleanliness",
      label: "Failure-audit cleanliness",
      raw: auditIncluded ? auditRaw : Number.NaN,
      weight: weights.auditCleanliness,
      points: auditIncluded ? auditRaw * weights.auditCleanliness : 0,
      note: auditIncluded
        ? hits.length
          ? `Deductions: ${hits.join("; ")}.`
          : "No rule hits."
        : "N/A — no rules ran; this criterion is excluded from the score.",
      included: auditIncluded,
    },
    ...extra.map(
      (e): Contribution => ({
        criterion: e.id,
        label: e.label,
        raw: e.included ? clamp01(e.raw) : Number.NaN,
        weight: e.weight,
        points: e.included ? clamp01(e.raw) * e.weight : 0,
        note: e.note,
        included: e.included,
      }),
    ),
  ];

  // score = Σ(weightᵢ · rawᵢ) / Σ weightᵢ × 100, over included criteria.
  const included = contributions.filter((c) => c.included);
  const wSum = included.reduce((s, c) => s + c.weight, 0);
  const score =
    wSum > 0
      ? (included.reduce((s, c) => s + c.points, 0) / wSum) * 100
      : Number.NaN;

  const requested = contributions.filter((c) => c.weight > 0);
  const requestedWeight = requested.reduce((sum, c) => sum + c.weight, 0);
  const auditIncomplete = audits.some((a) => a.status === "indeterminate");
  const coveredWeight = requested.reduce((sum, c) => sum + (
    c.included && !(c.criterion === "auditCleanliness" && auditIncomplete) ? c.weight : 0
  ), 0);
  if (weights.auditCleanliness > 0 && (!auditIncluded || auditIncomplete)) {
    evidenceGaps.push(!auditIncluded ? "Failure audit not run — no active rules."
      : "Failure audit has unresolved inputs: " + [...new Set(audits.flatMap((a) => a.unchecked))].join(", "));
  }
  for (const c of extra) if (c.weight > 0 && !c.included) evidenceGaps.push(c.note);

  return {
    coveragePercent: requestedWeight > 0 ? coveredWeight / requestedWeight * 100 : 0,
    scoreComplete: requestedWeight > 0 && coveredWeight === requestedWeight && Number.isFinite(score),
    evidenceGaps,
    eliminated: eliminationReasons.length > 0,
    eliminationReasons,
    contributions,
    score,
  };
}
