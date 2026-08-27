import type { CandidateFacts } from "@alloyra/core";
import type { Alloy, Condition } from "./types.ts";

/** Bridge a dataset alloy-in-condition to the engine's CandidateFacts. */
export function candidateFacts(alloy: Alloy, condition: Condition): CandidateFacts {
  const yieldRec = condition.properties.find((p) => p.property === "yield_strength");
  const facts: CandidateFacts = {
    uns: alloy.uns,
    name: alloy.names[0] ?? alloy.uns,
    family: alloy.family,
    conditionId: condition.id,
    conditionName: condition.name,
    composition: alloy.composition,
  };
  if (yieldRec) facts.yieldMPa = yieldRec.value;
  if (alloy.solidusK !== undefined) facts.solidusK = alloy.solidusK;
  return facts;
}
