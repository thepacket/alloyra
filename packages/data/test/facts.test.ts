import { expect, it } from "vitest";
import { alloys, candidateFacts } from "../src/index.ts";
it("preserves each selected yield record's test temperature through the facts bridge", () => {
  for (const alloy of alloys) for (const condition of alloy.conditions) {
    const record = condition.properties.find((p) => p.property === "yield_strength");
    const facts = candidateFacts(alloy, condition);
    expect(facts.yieldTestTempC).toBe(record?.testTempC);
    expect(facts.yieldMPa).toBe(record?.value);
  }
});
