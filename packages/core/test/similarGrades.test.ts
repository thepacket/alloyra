import { describe, expect, it } from "vitest";
import { similarGrades, type SimilarGradeInput } from "../src/analysis/similarGrades.ts";

const g = (
  uns: string,
  name: string,
  familyRoot: string,
  comp: SimilarGradeInput["composition"],
  yieldMPa?: number,
): SimilarGradeInput => ({
  uns,
  name,
  familyRoot,
  composition: comp,
  ...(yieldMPa !== undefined ? { yieldMPa } : {}),
});

const POOL: SimilarGradeInput[] = [
  g("S31603", "316L", "Fe", [
    { element: "Cr", min: 16, max: 18 },
    { element: "Ni", min: 10, max: 14 },
    { element: "Mo", min: 2, max: 3 },
    { element: "Fe", balance: true },
  ], 170),
  g("S31703", "317L", "Fe", [
    { element: "Cr", min: 18, max: 20 },
    { element: "Ni", min: 11, max: 15 },
    { element: "Mo", min: 3, max: 4 },
    { element: "Fe", balance: true },
  ], 205),
  g("S32205", "2205", "Fe", [
    { element: "Cr", min: 22, max: 23 },
    { element: "Ni", min: 4.5, max: 6.5 },
    { element: "Mo", min: 3, max: 3.5 },
    { element: "N", min: 0.14, max: 0.2 },
    { element: "Fe", balance: true },
  ], 450),
  g("S32750", "2507", "Fe", [
    { element: "Cr", min: 24, max: 26 },
    { element: "Ni", min: 6, max: 8 },
    { element: "Mo", min: 3, max: 5 },
    { element: "N", min: 0.24, max: 0.32 },
    { element: "Fe", balance: true },
  ], 550),
  g("A96061", "6061", "Al", [
    { element: "Mg", min: 0.8, max: 1.2 },
    { element: "Si", min: 0.4, max: 0.8 },
    { element: "Al", balance: true },
  ], 240),
];

describe("similarGrades (B-302)", () => {
  it("ranks the chemically closest grade first, with itemized deltas", () => {
    const r = similarGrades(POOL[2]!, POOL); // 2205
    expect(r[0]!.uns).toBe("S32750"); // 2507 before 316L/317L
    expect(r[0]!.deltas.length).toBeGreaterThan(0);
    expect(r[0]!.deltas[0]!.contribution).toBeGreaterThanOrEqual(
      r[0]!.deltas[r[0]!.deltas.length - 1]!.contribution,
    );
  });

  it("316L's closest neighbor is 317L, not a duplex", () => {
    const r = similarGrades(POOL[0]!, POOL);
    expect(r[0]!.uns).toBe("S31703");
  });

  it("never ranks across base metals, and never returns the target itself", () => {
    const r = similarGrades(POOL[0]!, POOL, 10);
    expect(r.some((m) => m.uns === "A96061")).toBe(false);
    expect(r.some((m) => m.uns === "S31603")).toBe(false);
  });

  it("includes the yield comparison only when both grades document it", () => {
    const noYield = g("X00001", "mystery", "Fe", POOL[0]!.composition);
    const r = similarGrades(noYield, POOL);
    expect(r[0]!.yieldNote).toBeUndefined();
    const r2 = similarGrades(POOL[0]!, POOL);
    expect(r2[0]!.yieldNote).toContain("MPa");
  });
});
