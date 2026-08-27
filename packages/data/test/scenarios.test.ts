import { describe, expect, it } from "vitest";
import {
  evaluateRules,
  rankCandidate,
  type DutyInput,
} from "@alloyra/core";
import { alloys, candidateFacts, failureRules } from "../src/index.ts";

/**
 * Textbook scenarios: the seeded rule set against the seeded alloys.
 * These encode the blueprint § 6 matrix — the cases a metallurgist would
 * spot-check first.
 */

function duty(over: Partial<DutyInput>): DutyInput {
  // All-known baseline for scenario clarity; unknowns are per-test.
  return {
    tempMaxC: null,
    loadType: "static",
    designStressMPa: 0,
    cycles: null,
    medium: "atmospheric",
    chloridePpm: null,
    pH: null,
    h2sKpa: null,
    ammonia: "no",
    crevices: "no",
    welded: "no",
    cathodicProtection: "no",
    galvanicCouple: "",
    lmeContact: "none",
    ...over,
  };
}

function facts(uns: string, conditionIdx = 0) {
  const a = alloys.find((x) => x.uns === uns);
  if (!a) throw new Error(uns);
  const c = a.conditions[conditionIdx];
  if (!c) throw new Error(`${uns} condition ${conditionIdx}`);
  return candidateFacts(a, c);
}

function statusOf(unsFacts: ReturnType<typeof facts>, d: DutyInput, ruleId: string) {
  const audit = evaluateRules(unsFacts, d, failureRules).find((x) => x.rule.id === ruleId);
  if (!audit) throw new Error(ruleId);
  return audit.status;
}

const hotSeawaterWelded = duty({
  tempMaxC: 80,
  chloridePpm: 19000,
  medium: "immersion",
  welded: "yes",
});

describe("chloride SCC (the seed conversation's phenomenon)", () => {
  it("304 welded in hot seawater: chloride SCC hits", () => {
    expect(statusOf(facts("S30400"), hotSeawaterWelded, "scc-chloride-austenitic")).toBe("hit");
  });
  it("2205 duplex in the same duty: chloride SCC clear", () => {
    expect(statusOf(facts("S32205"), hotSeawaterWelded, "scc-chloride-austenitic")).toBe("clear");
  });
  it("316L at 55 °C in chloride: NEAR miss — thresholds are soft (R-5.5)", () => {
    const d = duty({ tempMaxC: 55, chloridePpm: 1000, designStressMPa: 100 });
    expect(statusOf(facts("S31603"), d, "scc-chloride-austenitic")).toBe("near");
  });
});

describe("sensitization", () => {
  it("welded 304 (C ≤ 0.07) in immersion service: hits", () => {
    expect(statusOf(facts("S30400"), hotSeawaterWelded, "sensitization-austenitic")).toBe("hit");
  });
  it("welded 304L (C ≤ 0.03): clear", () => {
    expect(statusOf(facts("S30403"), hotSeawaterWelded, "sensitization-austenitic")).toBe("clear");
  });
});

describe("sour service (ISO 15156)", () => {
  const sour = duty({ h2sKpa: 10, medium: "process-fluid", designStressMPa: 400 });
  it("any steel in sour service: mandatory ISO 15156 qualification check fires", () => {
    expect(statusOf(facts("K02600"), sour, "iso15156-sour-service")).toBe("hit");
    expect(statusOf(facts("G43400"), sour, "iso15156-sour-service")).toBe("hit");
  });
  it("4340 Q&T (σy ≈ 1420 MPa): susceptibility flag fires but does NOT disqualify — qualification is the standard's call", () => {
    const f = facts("G43400");
    const audits = evaluateRules(f, sour, failureRules);
    expect(audits.find((a) => a.rule.id === "scc-sulfide-hsla")?.status).toBe("hit");
    const rank = rankCandidate(f, sour, audits);
    expect(rank.eliminated).toBe(false);
  });
  it("A36 (σy 250 MPa): susceptibility flag clear (definite miss on yield)", () => {
    expect(statusOf(facts("K02600"), sour, "scc-sulfide-hsla")).toBe("clear");
  });
});

describe("unknowns are indeterminate, not clear", () => {
  it("chloride SCC with unknown weld state and no stated stress: INDETERMINATE", () => {
    const d = duty({ tempMaxC: 80, chloridePpm: 19000, welded: "unknown", designStressMPa: null });
    expect(statusOf(facts("S30400"), d, "scc-chloride-austenitic")).toBe("indeterminate");
  });
  it("a blank-ish duty leaves season cracking indeterminate for brass", () => {
    const d = duty({ ammonia: "unknown", designStressMPa: 50 });
    expect(statusOf(facts("C26000"), d, "scc-season-cracking-brass")).toBe("indeterminate");
  });
});

describe("7xxx aluminum: the T6 vs T73 decision", () => {
  const humid = duty({ chloridePpm: 100, loadType: "sustained", designStressMPa: 200 });
  it("7075-T651 (peak aged): serious SCC hit", () => {
    expect(statusOf(facts("A97075", 0), humid, "scc-7xxx-peak-aged")).toBe("hit");
  });
  it("7075-T7351 (overaged): peak-aged rule clear, residual-watch caution instead", () => {
    expect(statusOf(facts("A97075", 1), humid, "scc-7xxx-peak-aged")).toBe("clear");
    expect(statusOf(facts("A97075", 1), humid, "scc-7xxx-overaged-residual")).toBe("hit");
  });
});

describe("season cracking", () => {
  it("cartridge brass + ammonia + tensile stress: hits", () => {
    const d = duty({ ammonia: "yes", designStressMPa: 50 });
    expect(statusOf(facts("C26000"), d, "scc-season-cracking-brass")).toBe("hit");
  });
  it("no ammonia: clear", () => {
    const d = duty({ designStressMPa: 50 });
    expect(statusOf(facts("C26000"), d, "scc-season-cracking-brass")).toBe("clear");
  });
});

describe("creep regime", () => {
  it("316L at 450 °C is past 0.4 T_solidus (≈ 396 °C)", () => {
    expect(statusOf(facts("S31603"), duty({ tempMaxC: 450 }), "creep-regime")).toBe("hit");
  });
  it("316L at 200 °C: clear", () => {
    expect(statusOf(facts("S31603"), duty({ tempMaxC: 200 }), "creep-regime")).toBe("clear");
  });
});

describe("ranking sanity on the marine duty", () => {
  it("2205 outscores 304 in hot welded seawater service", () => {
    const d = { ...hotSeawaterWelded, designStressMPa: 150 };
    const score = (uns: string) => {
      const f = facts(uns);
      const audits = evaluateRules(f, d, failureRules);
      return rankCandidate(f, d, audits);
    };
    const duplex = score("S32205");
    const austenitic = score("S30400");
    expect(duplex.eliminated).toBe(false);
    expect(duplex.score).toBeGreaterThan(austenitic.score);
  });
});

describe("ranking stability under perturbation (release-gate check)", () => {
  it("2205 > 304 ordering survives ±10 % design stress and weight changes", () => {
    const rank = (uns: string, stress: number, w: number) => {
      const f = facts(uns);
      const d = { ...hotSeawaterWelded, designStressMPa: stress };
      const audits = evaluateRules(f, d, failureRules);
      return rankCandidate(f, d, audits, { strength: w, corrosion: 1, auditCleanliness: 1 });
    };
    for (const stress of [135, 150, 165]) {
      for (const w of [0.75, 1, 1.25]) {
        expect(rank("S32205", stress, w).score).toBeGreaterThan(rank("S30400", stress, w).score);
      }
    }
  });
});
