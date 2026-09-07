import { rankCandidate, type ExtraCriterion, type Weights } from "./ranking.ts";
import type { CandidateFacts, RuleAudit } from "./rules/types.ts";
import type { DutyInput } from "./duty.ts";

export interface SensitivityCandidate {
  id: string;
  name: string;
  facts: CandidateFacts;
  audits: readonly RuleAudit[];
  extra?: readonly ExtraCriterion[];
}
export interface SensitivitySlice {
  weight: number;
  results: { id: string; score: number; coveragePercent: number; complete: boolean; eliminated: boolean }[];
  /** No preferred candidate is inferred while any eligible candidate is incomplete. */
  leaders: string[];
}
export function weightSensitivity(candidates: readonly SensitivityCandidate[], duty: DutyInput,
  weights: Weights, criterion: keyof Weights, steps = 17): SensitivitySlice[] {
  const count = Math.max(2, Math.min(101, Math.floor(Number.isFinite(steps) ? steps : 17)));
  return Array.from({ length: count }, (_, i) => {
    const weight = i * 2 / (count - 1);
    const results = candidates.map((c) => {
      const rank = rankCandidate(c.facts, duty, c.audits, { ...weights, [criterion]: weight }, c.extra);
      return { id: c.id, score: rank.score, coveragePercent: rank.coveragePercent, complete: rank.scoreComplete, eliminated: rank.eliminated };
    });
    const eligible = results.filter((r) => !r.eliminated);
    const full = eligible.length > 0 && eligible.every((r) => r.complete);
    const best = full ? Math.max(...eligible.map((r) => r.score)) : Number.NaN;
    return { weight, results, leaders: full ? eligible.filter((r) => Math.abs(r.score - best) < 1e-8).map((r) => r.id) : [] };
  });
}
