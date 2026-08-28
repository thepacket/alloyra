import type { Alloy } from "./types.ts";
import { alloys as baseAlloys } from "./seeds/alloys.v1.ts";
import { designations } from "./seeds/designations.v1.ts";
import { physicalProperties } from "./seeds/physical.v1.ts";
import { nistCryoCurves } from "./curves/nistCryo.v1.ts";

export type {
  Alloy,
  Condition,
  CurveRecord,
  CurveXQuantity,
  Designation,
  PropertyRecord,
  PropertyId,
  TestConditions,
} from "./types.ts";
export type { PropertyCategory, PropertyDef } from "./properties.ts";
export { PROPERTY_VOCABULARY, propertyDef } from "./properties.ts";

/** Seed alloys with designations (B-302), physical-property records and
 *  curve records (B-301) merged in. */
export const alloys: Alloy[] = baseAlloys.map((a) => {
  const d = designations[a.uns];
  const conditions = a.conditions.map((c) => {
    const extra = physicalProperties[c.id];
    const curves = nistCryoCurves[c.id];
    if (!extra && !curves) return c;
    return {
      ...c,
      properties: extra ? [...c.properties, ...extra] : c.properties,
      ...(curves ? { curves } : {}),
    };
  });
  return { ...a, conditions, ...(d ? { designations: d } : {}) };
});
export { failureRules, RULESET_VERSION } from "./rules/rules.v1.ts";
export { candidateFacts } from "./facts.ts";
export type { MicroConcept } from "./microstructure/concepts.v1.ts";
export { microConcepts } from "./microstructure/concepts.v1.ts";

/** Bump on any seed change; recorded on every comparison (R-2.6, R-1.7). */
export const DATASET_VERSION = "2026.08.5";
