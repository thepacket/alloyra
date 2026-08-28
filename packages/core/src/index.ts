export type { Provenance, SourceRef } from "./provenance.ts";
export type { ElementSymbol, CompositionRange, Composition } from "./composition.ts";
export { midpointComposition, missingElements, wt } from "./composition.ts";
export type { SpecRangeResult } from "./calculators/specRange.ts";
export { specRange } from "./calculators/specRange.ts";
export type { CalcResult } from "./calculators/types.ts";
export { pren, type PrenVariant } from "./calculators/pren.ts";
export { wrc1992, type Wrc1992Result } from "./calculators/wrc1992.ts";
export { ceIIW } from "./calculators/carbonEquivalent.ts";
export { msAndrews } from "./calculators/msAndrews.ts";
export { larsonMiller } from "./calculators/larsonMiller.ts";
export { md30Nohara } from "./calculators/md30.ts";
export {
  MATRIX_CONSTANTS,
  ashbyOrowan,
  astmToMicrons,
  hallPetch,
  hollomon,
  micronsToAstm,
} from "./calculators/strengthening.ts";
export type { GradeMatch, GradeRef, Violation } from "./analysis/nearestGrades.ts";
export { nearestGrades } from "./analysis/nearestGrades.ts";
export type { CostResult } from "./analysis/cost.ts";
export { elementCost } from "./analysis/cost.ts";
export type {
  ElementDelta,
  SimilarGradeInput,
  SimilarGradeMatch,
} from "./analysis/similarGrades.ts";
export { similarGrades } from "./analysis/similarGrades.ts";
export type { DutyInput, LoadType, Medium, LmeContact, TriState } from "./duty.ts";
export { tensileStressPresent } from "./duty.ts";
export type {
  AuditStatus,
  CandidateFacts,
  Clause,
  FailureRule,
  ReviewRecord,
  ReviewStatus,
  RuleAudit,
  Severity,
} from "./rules/types.ts";
export { describeClause, estimateContent, evaluateRules } from "./rules/evaluate.ts";
export { isValidRule, validateRule } from "./rules/validate.ts";
export type {
  EquilibriumQuery,
  EquilibriumResult,
  ModelProvider,
  PhaseFraction,
  ProviderCapabilities,
  SystemInfo,
} from "./provider.ts";
export type { Contribution, ExtraCriterion, RankResult, Weights } from "./ranking.ts";
export type {
  CandidateScreen,
  FamilyStage,
  LimitStage,
  PropertyMeta,
  RegionStage,
  ScreeningStage,
  ScreenResult,
  StageOutcome,
  UnknownPolicy,
} from "./screening.ts";
export { describeStage, screenCandidates } from "./screening.ts";
export { DEFAULT_WEIGHTS, rankCandidate } from "./ranking.ts";
export type {
  Constituent,
  ConstituentRole,
  MechanismId,
  MechanismRole,
  MechanismTag,
  Microstructure,
  SerrationClass,
  TwinDensity,
} from "./microstructure.ts";
export {
  MECHANISMS,
  hasMechanism,
  matchesMicroQuery,
  microstructureHaystack,
} from "./microstructure.ts";
