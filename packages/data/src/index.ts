export type { Alloy, Condition, PropertyRecord, PropertyId } from "./types.ts";
export { alloys } from "./seeds/alloys.v1.ts";
export { failureRules, RULESET_VERSION } from "./rules/rules.v1.ts";
export { candidateFacts } from "./facts.ts";

/** Bump on any seed change; recorded on every comparison (R-2.6, R-1.7). */
export const DATASET_VERSION = "2026.08.1";
