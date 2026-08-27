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
  reviewStatus: "draft",
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

  it("rejects a missing or invalid review status", () => {
    const errs = validateRule({ ...good, reviewStatus: "vibes-checked" });
    expect(errs.join(" ")).toMatch(/reviewStatus/);
  });

  it("promotion beyond draft requires a review record", () => {
    const errs = validateRule({ ...good, reviewStatus: "expert-reviewed" });
    expect(errs.join(" ")).toMatch(/review record/);
  });

  it("review record needs reviewer and an ISO date", () => {
    const errs = validateRule({
      ...good,
      reviewStatus: "validated",
      review: { reviewer: "", date: "yesterday" },
    });
    expect(errs.join(" ")).toMatch(/review\.reviewer/);
    expect(errs.join(" ")).toMatch(/review\.date/);
  });

  it("accepts a properly signed-off promotion", () => {
    const errs = validateRule({
      ...good,
      reviewStatus: "expert-reviewed",
      review: {
        reviewer: "J. Metallurgist",
        organization: "Example Labs",
        date: "2026-08-27",
        reviewedAgainst: "ruleset 2026.08.0",
        notes: "Threshold checked against ASM 13A.",
      },
    });
    expect(errs).toEqual([]);
  });

  it("rejects non-kebab ids", () => {
    const errs = validateRule({ ...good, id: "Bad ID!" });
    expect(errs.join(" ")).toMatch(/kebab/);
  });
});
