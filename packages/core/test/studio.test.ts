import { describe, expect, it } from "vitest";
import {
  elementCost,
  md30Nohara,
  nearestGrades,
  type GradeRef,
} from "../src/index.ts";

describe("Md30 (Nohara)", () => {
  it("316L-type composition → ≈ −122 °C (stable austenite)", () => {
    const r = md30Nohara({
      C: 0.02, N: 0.04, Si: 0.5, Mn: 1.0, Cr: 17, Ni: 12, Cu: 0.2, Mo: 2.5,
    });
    // 551 − 462(0.06) − 9.2(0.5) − 8.1(1) − 13.7(17) − 29(12.2) − 18.5(2.5)
    expect(r.value).toBeCloseTo(-122.37, 1);
    expect(r.inWindow).toBe(true);
  });

  it("304-type composition is less stable than 316L-type", () => {
    const r304 = md30Nohara({
      C: 0.04, N: 0.05, Si: 0.5, Mn: 1.0, Cr: 18.5, Ni: 9.25, Cu: 0.2,
    });
    expect(r304.value).toBeGreaterThan(-40);
    expect(r304.value).toBeLessThan(0);
  });

  it("carbon steel is out of window", () => {
    expect(md30Nohara({ C: 0.2, Mn: 1 }).inWindow).toBe(false);
  });
});

describe("nearestGrades", () => {
  const grades: GradeRef[] = [
    {
      uns: "S31603",
      name: "316L",
      composition: [
        { element: "Cr", min: 16, max: 18 },
        { element: "Ni", min: 10, max: 14 },
        { element: "Mo", min: 2, max: 3 },
        { element: "Fe", balance: true },
      ],
    },
    {
      uns: "S31703",
      name: "317L",
      composition: [
        { element: "Cr", min: 18, max: 20 },
        { element: "Ni", min: 11, max: 15 },
        { element: "Mo", min: 3, max: 4 },
        { element: "Fe", balance: true },
      ],
    },
  ];

  it("mid-spec 316L matches 316L at ~zero distance", () => {
    const [best] = nearestGrades({ Cr: 17, Ni: 12, Mo: 2.5 }, grades);
    expect(best?.uns).toBe("S31603");
    expect(best?.distance).toBeCloseTo(0, 5);
  });

  it("pushing Mo up walks the match toward 317L, with the delta itemized", () => {
    const [best] = nearestGrades({ Cr: 18.5, Ni: 13, Mo: 3.6 }, grades);
    expect(best?.uns).toBe("S31703");
    const moDelta = best?.deltas.find((d) => d.element === "Mo");
    expect(moDelta?.delta).toBeCloseTo(3.6 - 3.5, 5);
  });
});

describe("elementCost", () => {
  it("rolls up Σ wt%/100 × price and reports unpriced elements", () => {
    const r = elementCost(
      { Cr: 18, Ni: 10, Mo: 2, Fe: 70 },
      { Cr: 10, Ni: 18, Fe: 0.5 },
    );
    expect(r.perKg).toBeCloseTo(0.18 * 10 + 0.1 * 18 + 0.7 * 0.5, 5);
    expect(r.unpriced).toEqual(["Mo"]);
  });
});
