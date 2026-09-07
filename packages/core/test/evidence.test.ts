import { describe, expect, it } from "vitest";
import { rankCandidate, prenForFamily, blankStrengthInputs, restoreStrengthInputs, strengthInputsReady, setStrengthValue,
  weightSensitivity, hallPetch, hollomon, ashbyOrowan, type CandidateFacts, type DutyInput } from "../src/index.ts";
const facts: CandidateFacts = { uns: "test", name: "test", family: ["Fe", "stainless", "austenitic"], conditionId: "annealed", conditionName: "Annealed",
  yieldMPa: 200, yieldTestTempC: 23, composition: [{ element: "Cr", min: 17, max: 19 }, { element: "Ni", min: 8, max: 10 }, { element: "Fe", balance: true }] };
const duty: DutyInput = { tempMaxC: 23, designStressMPa: 100, loadType: "static", cycles: null, medium: "immersion", chloridePpm: 100,
  pH: 7, h2sKpa: 0, ammonia: "no", crevices: "no", welded: "no", cathodicProtection: "no", galvanicCouple: "", lmeContact: "none" };
const weights = { strength: 1, corrosion: 1, auditCleanliness: 0 };
describe("applicability and coverage", () => {
  it("high chromium does not make a nickel alloy eligible for stainless PREN", () => {
    expect(prenForFamily({ Cr: 22, Mo: 9, Ni: 60 }, ["Ni", "solid-solution"]).inWindow).toBe(false);
    const r = rankCandidate({ ...facts, family: ["Ni", "solid-solution"] }, duty, [], weights);
    const corrosion = r.contributions.find((c) => c.criterion === "corrosion")!;
    expect(corrosion.included).toBe(false);
    expect(corrosion.raw).toBeNaN();
    expect(r.coveragePercent).toBe(50);
    expect(r.scoreComplete).toBe(false);
  });
  it("matched yield temperatures support scoring and elimination", () => {
    expect(rankCandidate(facts, duty, [], weights).scoreComplete).toBe(true);
    expect(rankCandidate(facts, { ...duty, designStressMPa: 250 }, [], weights).eliminated).toBe(true);
  });
  it.each([null, 45, 500, -100])("does not extrapolate a 23 °C record to %s °C", (tempMaxC) => {
    const r = rankCandidate(facts, { ...duty, tempMaxC, designStressMPa: 250 }, [], weights);
    expect(r.eliminated).toBe(false);
    expect(r.contributions[0]?.included).toBe(false);
    expect(r.scoreComplete).toBe(false);
    expect(r.evidenceGaps.join(" ")).toMatch(/temperature|°C/);
  });
  it("retains no false certainty when yield metadata is absent", () => {
    const { yieldTestTempC: _, ...legacy } = facts;
    expect(rankCandidate(legacy, duty, [], weights).coveragePercent).toBe(50);
  });
  it("all-zero weights yield no numeric score or complete ranking", () => {
    const r = rankCandidate(facts, duty, [], { strength: 0, corrosion: 0, auditCleanliness: 0 });
    expect(r.score).toBeNaN(); expect(r.scoreComplete).toBe(false); expect(r.coveragePercent).toBe(0);
  });
  it("non-finite optional results cannot poison the aggregate", () => {
    const r = rankCandidate(facts, duty, [], weights, [{ id: "castability", label: "Kou", raw: Number.NaN, weight: 1, included: true, note: "Unavailable result" }]);
    expect(Number.isFinite(r.score)).toBe(true); expect(r.scoreComplete).toBe(false);
  });
});
describe("strength input provenance", () => {
  it("starts without fictitious fitted or particle parameters", () => {
    const s = blankStrengthInputs();
    expect(s.holl).toEqual({ K: null, n: null });
    expect(s.orowan.matrix).toBe("");
    expect(strengthInputsReady(s, ["K", "n"])).toBe(false);
  });
  it("preserves legacy values without silently trusting their origins", () => {
    const s = restoreStrengthInputs({ holl: { K: 1400, n: 0.45 } });
    expect(s.holl.K).toBe(1400); expect(strengthInputsReady(s, ["K", "n"])).toBe(false);
  });
  it("requires every input and preserves verified values on reload", () => {
    let s = setStrengthValue(blankStrengthInputs(), "K", 1000);
    expect(strengthInputsReady(s, ["K", "n"])).toBe(false);
    s = setStrengthValue(s, "n", 0.2);
    expect(strengthInputsReady(restoreStrengthInputs(s), ["K", "n"])).toBe(true);
    expect(strengthInputsReady(setStrengthValue(s, "K", null), ["K", "n"])).toBe(false);
  });
  it("assumed presets require review", () => {
    const s = setStrengthValue(blankStrengthInputs(), "G", 26.2);
    s.origins.G = "assumed";
    expect(strengthInputsReady(s, ["G"])).toBe(false);
  });
  it.each([Number.NaN, Infinity, -1])("invalid material parameters (%s) never generate valid output", (value) => {
    expect(hallPetch({ dUm: 20, sigma0MPa: value, kyMPaSqrtUm: 600 }).inWindow).toBe(false);
    expect(hollomon({ kMPa: value, n: 0.2 }).utsEng.inWindow).toBe(false);
    expect(ashbyOrowan({ volumeFraction: 0.02, particleDiameterNm: 10, shearModulusGPa: value, burgersNm: 0.286 }).inWindow).toBe(false);
  });
});

describe("weight sensitivity", () => {
  it("shows trade-off crossovers when strength and corrosion weights change", () => {
    const candidates=[{id:"strong",name:"Strong",facts:{...facts,yieldMPa:600},audits:[]}, {id:"corrosion",name:"Corrosion",facts:{...facts,yieldMPa:160,composition:[{element:"Cr" as const,min:30,max:30},{element:"Mo" as const,min:6,max:6}]},audits:[]}];
    const slices=weightSensitivity(candidates,duty,weights,"strength");
    expect(slices[0]!.leaders).toEqual(["corrosion"]);
    expect(slices.at(-1)!.leaders).toEqual(["strong"]);
  });
  it("does not infer a preferred candidate from incomplete evidence", () => {
    const slices=weightSensitivity([{id:"x",name:"x",facts,audits:[]}],{...duty,tempMaxC:500},weights,"corrosion");
    expect(slices.every((s)=>s.leaders.length===0)).toBe(true);
  });
  it("reports ties and handles a non-finite sampling request", () => {
    const candidates=["a","b"].map((id)=>({id,name:id,facts,audits:[]}));
    expect(weightSensitivity(candidates,duty,weights,"strength",Number.NaN).at(-1)!.leaders).toEqual(["a","b"]);
  });
});
