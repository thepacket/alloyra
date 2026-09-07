import { describe, expect, it } from "vitest";
import { alloys, conditionCandidates, screenProperty } from "../src/index.ts";
describe("condition screening", () => {
  it("keeps each 7075 heat treatment and its own yield record", () => {
    const candidates=conditionCandidates(alloys).filter((c)=>c.uns==="A97075");
    expect(candidates.length).toBeGreaterThan(1);
    expect(new Set(candidates.map((c)=>c.condition.id)).size).toBe(candidates.length);
    expect(new Set(candidates.map((c)=>screenProperty("yield")!.get(c))).size).toBeGreaterThan(1);
  });
  it("never borrows a missing property from another condition", () => {
    const alloy=alloys.find((a)=>a.uns==="A97075")!;
    const changed={...alloy,conditions:alloy.conditions.map((c,i)=>i===0?{...c,properties:[]}:c)};
    const candidates=conditionCandidates([changed]);
    expect(screenProperty("yield")!.get(candidates[0]!)).toBeUndefined();
    expect(screenProperty("yield")!.get(candidates[1]!)).toBeDefined();
  });
});
