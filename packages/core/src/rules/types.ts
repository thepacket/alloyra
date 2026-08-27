import type { CompositionRange, ElementSymbol } from "../composition.ts";
import type { LmeContact, LoadType, Medium } from "../duty.ts";

/** R-5.4: a hit is a flag for expert judgment, never a verdict. */
export type Severity = "caution" | "serious" | "disqualifying";

/**
 * The declarative predicate DSL (R-5.3: rules are data, not code).
 * A rule fires when ALL of its clauses match. Numeric clauses may carry a
 * `nearBand` (fraction): a value inside the band but short of the
 * threshold yields a NEAR result instead of a miss (R-5.5 — thresholds
 * are soft).
 */
export type Clause =
  /** Alloy family path prefix, e.g. ["Fe","stainless","austenitic"]. */
  | { kind: "family"; path: string[] }
  | { kind: "notFamily"; path: string[] }
  /** The governing spec permits more than `above` wt% of the element. */
  | { kind: "specMaxAbove"; element: ElementSymbol; above: number }
  /** Estimated content (mid-spec; balance estimated by difference) ≥ wt%. */
  | { kind: "contentAtLeast"; element: ElementSymbol; wtPct: number }
  | { kind: "yieldAtLeast"; mpa: number; nearBand?: number }
  | { kind: "conditionIncludes"; text: string }
  | { kind: "conditionExcludes"; text: string }
  /** PREN (mid-spec) below `value`; never matches non-stainless. */
  | { kind: "prenBelow"; value: number }
  /** T_service[K] > fraction × T_solidus[K]. */
  | { kind: "homologousTempAbove"; fraction: number; nearBand?: number }
  | {
      kind: "duty";
      field: "chloridePpm" | "tempMaxC" | "h2sKpa" | "pH" | "cycles";
      op: ">=" | "<=";
      value: number;
      nearBand?: number;
    }
  | {
      kind: "dutyFlag";
      field: "crevices" | "welded" | "cathodicProtection" | "ammonia";
      value: boolean;
    }
  | { kind: "mediumIn"; anyOf: Medium[] }
  | { kind: "loadIn"; anyOf: LoadType[] }
  | { kind: "tensileStress" }
  | { kind: "galvanicCouplePresent" }
  | { kind: "lmeContact"; anyOf: Exclude<LmeContact, "none">[] };

export interface FailureRule {
  id: string;
  name: string;
  severity: Severity;
  when: Clause[];
  /** Prose mechanism, phrased as a flag for judgment (R-5.4). */
  mechanism: string;
  citation: string;
  mitigations: string[];
  reviewedBy: string;
}

/** What the engine knows about one candidate: an alloy IN a condition. */
export interface CandidateFacts {
  uns: string;
  name: string;
  family: string[];
  conditionId: string;
  conditionName: string;
  /** Best available yield for the condition; caller labels its provenance. */
  yieldMPa?: number;
  composition: readonly CompositionRange[];
  /** Approximate solidus, K (estimated) — powers the creep-regime clause. */
  solidusK?: number;
}

export type AuditStatus = "hit" | "near" | "clear";

export interface RuleAudit {
  rule: FailureRule;
  status: AuditStatus;
  /** Human-readable statements of what matched (or nearly did). */
  because: string[];
  /** Duty fields the rule needed but the profile left unspecified. */
  unchecked: string[];
}
