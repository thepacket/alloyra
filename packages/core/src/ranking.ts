import { midpointComposition } from "./composition.ts";
import type { DutyInput } from "./duty.ts";
import { pren } from "./calculators/pren.ts";
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

export interface Contribution {
  criterion: keyof Weights;
  label: string;
  /** Normalized 0–1. */
  raw: number;
  weight: number;
  /** raw × weight — what actually moves the score. */
  points: number;
  note: string;
}

export interface RankResult {
  eliminated: boolean;
  eliminationReasons: string[];
  contributions: Contribution[];
  /** 0–100, weighted mean of raws. NaN when every weight is zero. */
  score: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function rankCandidate(
  facts: CandidateFacts,
  duty: DutyInput,
  audits: readonly RuleAudit[],
  weights: Weights = DEFAULT_WEIGHTS,
): RankResult {
  const eliminationReasons: string[] = [];

  // Hard constraint: yield below design stress.
  if (
    duty.designStressMPa !== null &&
    facts.yieldMPa !== undefined &&
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
  if (facts.yieldMPa === undefined) {
    strengthRaw = 0;
    strengthNote = "No yield value for this condition — scored 0, not guessed.";
  } else if (duty.designStressMPa !== null && duty.designStressMPa > 0) {
    strengthRaw = clamp01(1 - duty.designStressMPa / facts.yieldMPa);
    strengthNote = `Margin: 1 − σ_design/σ_y = 1 − ${duty.designStressMPa}/${facts.yieldMPa}.`;
  } else {
    strengthRaw = clamp01(facts.yieldMPa / 1000);
    strengthNote = "No design stress given — normalized σ_y / 1000 MPa.";
  }

  // Corrosion index — honest scope: PREN where applicable, else neutral-void.
  const p = pren(midpointComposition([...facts.composition]));
  let corrosionRaw: number;
  let corrosionNote: string;
  if (p.inWindow) {
    corrosionRaw = clamp01(p.value / 45);
    corrosionNote = `PREN ≈ ${p.value.toFixed(1)} (mid-spec) / 45. Screening index only.`;
  } else {
    corrosionRaw = 0.5;
    corrosionNote =
      "No corrosion index available for this family — neutral 0.5; apply expert judgment.";
  }

  // Audit cleanliness.
  let auditRaw = 1;
  const hits: string[] = [];
  for (const a of audits) {
    if (a.status === "hit") {
      auditRaw -= a.rule.severity === "serious" ? 0.4 : 0.15;
      hits.push(`${a.rule.name} (${a.rule.severity})`);
    } else if (a.status === "near") {
      auditRaw -= 0.05;
      hits.push(`${a.rule.name} (near-miss)`);
    }
  }
  auditRaw = clamp01(auditRaw);

  const contributions: Contribution[] = [
    {
      criterion: "strength",
      label: "Strength margin",
      raw: strengthRaw,
      weight: weights.strength,
      points: strengthRaw * weights.strength,
      note: strengthNote,
    },
    {
      criterion: "corrosion",
      label: "Corrosion index",
      raw: corrosionRaw,
      weight: weights.corrosion,
      points: corrosionRaw * weights.corrosion,
      note: corrosionNote,
    },
    {
      criterion: "auditCleanliness",
      label: "Failure-audit cleanliness",
      raw: auditRaw,
      weight: weights.auditCleanliness,
      points: auditRaw * weights.auditCleanliness,
      note: hits.length ? `Deductions: ${hits.join("; ")}.` : "No rule hits.",
    },
  ];

  const wSum = contributions.reduce((s, c) => s + c.weight, 0);
  const score =
    wSum > 0
      ? (contributions.reduce((s, c) => s + c.points, 0) / wSum) * 100
      : Number.NaN;

  return {
    eliminated: eliminationReasons.length > 0,
    eliminationReasons,
    contributions,
    score,
  };
}
