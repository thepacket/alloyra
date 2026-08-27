import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  estimateContent,
  evaluateRules,
  rankCandidate,
  type CandidateFacts,
  type DutyInput,
  type FailureRule,
} from "../src/index.ts";

const baseDuty: DutyInput = {
  tempMaxC: null,
  loadType: "static",
  designStressMPa: null,
  cycles: null,
  medium: "atmospheric",
  chloridePpm: null,
  pH: null,
  h2sKpa: null,
  ammonia: false,
  crevices: false,
  welded: false,
  cathodicProtection: false,
  galvanicCouple: "",
  lmeContact: "none",
};

const facts: CandidateFacts = {
  uns: "S30400",
  name: "304",
  family: ["Fe", "stainless", "austenitic"],
  conditionId: "c",
  conditionName: "Annealed",
  yieldMPa: 205,
  composition: [
    { element: "Cr", min: 17.5, max: 19.5 },
    { element: "Ni", min: 8, max: 10.5 },
    { element: "Fe", balance: true },
  ],
  solidusK: 1673,
};

const tempRule: FailureRule = {
  id: "t",
  name: "temp rule",
  severity: "serious",
  when: [{ kind: "duty", field: "tempMaxC", op: ">=", value: 60, nearBand: 0.15 }],
  mechanism: "",
  citation: "",
  mitigations: [],
  reviewedBy: "test",
};

describe("rule engine mechanics", () => {
  it("hits when the threshold is met", () => {
    const [a] = evaluateRules(facts, { ...baseDuty, tempMaxC: 80 }, [tempRule]);
    expect(a?.status).toBe("hit");
    expect(a?.because.length).toBe(1);
  });

  it("near-misses inside the band (R-5.5): 55 °C vs the 60 °C anchor", () => {
    const [a] = evaluateRules(facts, { ...baseDuty, tempMaxC: 55 }, [tempRule]);
    expect(a?.status).toBe("near");
  });

  it("clears outside the band", () => {
    const [a] = evaluateRules(facts, { ...baseDuty, tempMaxC: 40 }, [tempRule]);
    expect(a?.status).toBe("clear");
  });

  it("unspecified duty fields never flag, but are reported as unchecked", () => {
    const [a] = evaluateRules(facts, baseDuty, [tempRule]);
    expect(a?.status).toBe("clear");
    expect(a?.unchecked).toContain("tempMaxC");
  });

  it("welding counts as tensile stress (residual)", () => {
    const rule: FailureRule = { ...tempRule, when: [{ kind: "tensileStress" }] };
    expect(evaluateRules(facts, baseDuty, [rule])[0]?.status).toBe("clear");
    expect(
      evaluateRules(facts, { ...baseDuty, welded: true }, [rule])[0]?.status,
    ).toBe("hit");
  });

  it("homologous temperature clause enters the creep regime", () => {
    const rule: FailureRule = {
      ...tempRule,
      when: [{ kind: "homologousTempAbove", fraction: 0.4 }],
    };
    // 0.4 × 1673 K = 669 K = 396 °C
    expect(
      evaluateRules(facts, { ...baseDuty, tempMaxC: 450 }, [rule])[0]?.status,
    ).toBe("hit");
    expect(
      evaluateRules(facts, { ...baseDuty, tempMaxC: 200 }, [rule])[0]?.status,
    ).toBe("clear");
  });
});

describe("estimateContent", () => {
  it("estimates a balance element by difference (70/30 brass → ≈30 % Zn)", () => {
    const zn = estimateContent(
      [
        { element: "Cu", min: 68.5, max: 71.5 },
        { element: "Pb", max: 0.07 },
        { element: "Zn", balance: true },
      ],
      "Zn",
    );
    expect(zn).toBeCloseTo(30, 0);
  });
});

describe("ranking", () => {
  it("eliminates when yield < design stress, with a stated reason (R-3.2)", () => {
    const r = rankCandidate(facts, { ...baseDuty, designStressMPa: 300 }, []);
    expect(r.eliminated).toBe(true);
    expect(r.eliminationReasons[0]).toMatch(/below the design stress/);
  });

  it("eliminates on a disqualifying hit, citing the rule", () => {
    const disq: FailureRule = { ...tempRule, severity: "disqualifying" };
    const audits = evaluateRules(facts, { ...baseDuty, tempMaxC: 80 }, [disq]);
    const r = rankCandidate(facts, { ...baseDuty, tempMaxC: 80 }, audits);
    expect(r.eliminated).toBe(true);
    expect(r.eliminationReasons[0]).toMatch(/temp rule/);
  });

  it("itemizes contributions and weights transparently (R-3.1)", () => {
    const r = rankCandidate(facts, { ...baseDuty, designStressMPa: 100 }, [], DEFAULT_WEIGHTS);
    expect(r.eliminated).toBe(false);
    expect(r.contributions).toHaveLength(3);
    const strength = r.contributions.find((c) => c.criterion === "strength");
    // 1 − 100/205
    expect(strength?.raw).toBeCloseTo(1 - 100 / 205, 5);
    const sum = r.contributions.reduce((s, c) => s + c.points, 0);
    const wSum = r.contributions.reduce((s, c) => s + c.weight, 0);
    expect(r.score).toBeCloseTo((sum / wSum) * 100, 5);
  });

  it("audit hits deduct from cleanliness with an itemized note", () => {
    const audits = evaluateRules(facts, { ...baseDuty, tempMaxC: 80 }, [tempRule]);
    const r = rankCandidate(facts, { ...baseDuty, tempMaxC: 80 }, audits);
    const clean = r.contributions.find((c) => c.criterion === "auditCleanliness");
    expect(clean?.raw).toBeCloseTo(0.6, 5); // serious → −0.4
    expect(clean?.note).toMatch(/temp rule/);
  });
});
