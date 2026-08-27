import { describe, expect, it } from "vitest";
import { validateRule } from "../src/index.ts";

const good = {
  id: "test-rule",
  name: "Test rule",
  severity: "caution",
  when: [
    { kind: "family", path: ["Fe"] },
    { kind: "duty", field: "tempMaxC", op: ">=", value: 100, nearBand: 0.1 },
  ],
  mechanism: "Something happens.",
  citation: "A real citation",
  mitigations: ["Do less of it"],
  reviewedBy: "test",
};

describe("validateRule", () => {
  it("accepts a well-formed rule", () => {
    expect(validateRule(good)).toEqual([]);
  });

  it("rejects a missing citation — uncited rules are inadmissible", () => {
    const errs = validateRule({ ...good, citation: "" });
    expect(errs.join(" ")).toMatch(/citation/);
  });

  it("rejects unknown clause kinds", () => {
    const errs = validateRule({ ...good, when: [{ kind: "vibes" }] });
    expect(errs.join(" ")).toMatch(/unknown clause kind/);
  });

  it("rejects bad duty fields and ops", () => {
    const errs = validateRule({
      ...good,
      when: [{ kind: "duty", field: "salinity", op: "~", value: 1 }],
    });
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects an out-of-range nearBand", () => {
    const errs = validateRule({
      ...good,
      when: [{ kind: "yieldAtLeast", mpa: 1000, nearBand: 3 }],
    });
    expect(errs.join(" ")).toMatch(/nearBand/);
  });

  it("rejects an empty when array", () => {
    const errs = validateRule({ ...good, when: [] });
    expect(errs.join(" ")).toMatch(/at least one clause/);
  });

  it("rejects non-kebab ids", () => {
    const errs = validateRule({ ...good, id: "Bad ID!" });
    expect(errs.join(" ")).toMatch(/kebab/);
  });
});
