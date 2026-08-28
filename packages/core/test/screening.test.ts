import { describe, expect, it } from "vitest";
import {
  describeStage,
  screenCandidates,
  type ScreeningStage,
} from "../src/screening.ts";

/** Minimal candidate shape for the generic engine. */
interface C {
  id: string;
  family: string[];
  props: Record<string, number | undefined>;
}

const CANDIDATES: C[] = [
  { id: "steel-strong", family: ["Fe", "stainless", "duplex"], props: { yield: 550, density: 7.8 } },
  { id: "steel-weak", family: ["Fe", "stainless", "austenitic"], props: { yield: 170, density: 8.0 } },
  { id: "alu", family: ["Al", "age-hardening"], props: { yield: 503, density: 2.81 } },
  { id: "ti-unknown-density", family: ["Ti", "alpha-beta"], props: { yield: 828, density: undefined } },
];

const PROPERTIES = {
  yield: { label: "σy min", unit: "MPa" },
  density: { label: "ρ", unit: "g/cm³" },
};

const run = (stages: ScreeningStage[]) =>
  screenCandidates(CANDIDATES, stages, {
    resolve: (c, p) => c.props[p],
    familyOf: (c) => c.family,
    properties: PROPERTIES,
  });

const limit = (over: Partial<ScreeningStage> & { property: string }): ScreeningStage =>
  ({ id: over.id ?? "L", kind: "limit", unknowns: "eliminate", enabled: true, ...over }) as ScreeningStage;

describe("staged screening (B-203)", () => {
  it("limit stage eliminates with the actual values in the reason", () => {
    const r = run([limit({ property: "yield", min: 400 })]);
    const weak = r.candidates.find((c) => c.candidate.id === "steel-weak")!;
    expect(weak.eliminatedAt).toBe(1);
    expect(weak.outcomes[0]!.reason).toContain("170 MPa < 400 MPa");
    expect(r.funnel).toEqual([4, 3]);
  });

  it("unknown values follow the stage's explicit policy — and say so either way", () => {
    const elim = run([limit({ property: "density", max: 5 })]);
    const ti = elim.candidates.find((c) => c.candidate.id === "ti-unknown-density")!;
    expect(ti.eliminatedAt).toBe(1);
    expect(ti.outcomes[0]!.reason).toMatch(/unknown/);
    expect(ti.outcomes[0]!.reason).toMatch(/unknown policy/);

    const keep = run([limit({ property: "density", max: 5, unknowns: "keep" })]);
    const tiKept = keep.candidates.find((c) => c.candidate.id === "ti-unknown-density")!;
    expect(tiKept.eliminatedAt).toBeUndefined();
    expect(tiKept.outcomes[0]!.reason).toMatch(/KEPT/);
    expect(tiKept.outcomes[0]!.reason).toMatch(/not verified/);
  });

  it("stages chain progressively: a candidate killed at stage 1 never reaches stage 2", () => {
    const r = run([
      { id: "F", kind: "family", roots: ["Fe"], enabled: true },
      limit({ id: "L", property: "yield", min: 400 }),
    ]);
    const alu = r.candidates.find((c) => c.candidate.id === "alu")!;
    expect(alu.eliminatedAt).toBe(1);
    expect(alu.outcomes).toHaveLength(1); // never evaluated by stage 2
    const weak = r.candidates.find((c) => c.candidate.id === "steel-weak")!;
    expect(weak.eliminatedAt).toBe(2);
    expect(weak.outcomes).toHaveLength(2);
    expect(r.funnel).toEqual([4, 2, 1]);
  });

  it("family stage matches roots and free terms against any segment", () => {
    const r = run([{ id: "F", kind: "family", roots: [], term: "duplex", enabled: true }]);
    expect(r.candidates.filter((c) => c.eliminatedAt === undefined).map((c) => c.candidate.id))
      .toEqual(["steel-strong"]);
    const weak = r.candidates.find((c) => c.candidate.id === "steel-weak")!;
    expect(weak.outcomes[0]!.reason).toContain('does not contain "duplex"');
  });

  it("region stage checks both axes and names the violated one", () => {
    const r = run([
      {
        id: "R",
        kind: "region",
        xProperty: "density",
        yProperty: "yield",
        x0: 0,
        x1: 5,
        y0: 400,
        y1: 1000,
        unknowns: "eliminate",
        enabled: true,
      },
    ]);
    expect(
      r.candidates.filter((c) => c.eliminatedAt === undefined).map((c) => c.candidate.id),
    ).toEqual(["alu"]);
    const strong = r.candidates.find((c) => c.candidate.id === "steel-strong")!;
    expect(strong.outcomes[0]!.reason).toContain("ρ 7.8 g/cm³ > 5.0 g/cm³");
  });

  it("disabled stages are skipped and never numbered", () => {
    const r = run([
      limit({ id: "off", property: "yield", min: 9999, enabled: false } as Partial<ScreeningStage> & { property: string }),
      limit({ id: "on", property: "yield", min: 400 }),
    ]);
    expect(r.ran).toHaveLength(1);
    expect(r.funnel).toEqual([4, 3]);
    const weak = r.candidates.find((c) => c.candidate.id === "steel-weak")!;
    expect(weak.eliminatedAt).toBe(1);
    expect(weak.outcomes[0]!.stageId).toBe("on");
  });

  it("describeStage renders human-readable stage summaries", () => {
    expect(
      describeStage({ id: "F", kind: "family", roots: ["Fe", "Ni"], term: "stainless", enabled: true }, PROPERTIES),
    ).toBe('Family: base metal in {Fe, Ni} and family contains "stainless"');
    expect(
      describeStage(limit({ property: "yield", min: 400, max: 900 }), PROPERTIES),
    ).toContain("σy min ≥ 400 MPa and ≤ 900 MPa");
  });
});
