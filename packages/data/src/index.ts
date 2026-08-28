import type { Alloy } from "./types.ts";
import { alloys as baseAlloys } from "./seeds/alloys.v1.ts";
import { designations } from "./seeds/designations.v1.ts";

export type { Alloy, Condition, Designation, PropertyRecord, PropertyId } from "./types.ts";

/** Seed alloys with cross-standard designations merged in (B-302). */
export const alloys: Alloy[] = baseAlloys.map((a) => {
  const d = designations[a.uns];
  return d ? { ...a, designations: d } : a;
});
export { failureRules, RULESET_VERSION } from "./rules/rules.v1.ts";
export { candidateFacts } from "./facts.ts";
export type { MicroConcept } from "./microstructure/concepts.v1.ts";
export { microConcepts } from "./microstructure/concepts.v1.ts";

/** Bump on any seed change; recorded on every comparison (R-2.6, R-1.7). */
export const DATASET_VERSION = "2026.08.4";
