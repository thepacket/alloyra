import { describe, expect, it } from "vitest";
import {
  ceIIW,
  specRange,
  larsonMiller,
  midpointComposition,
  msAndrews,
  pren,
  wrc1992,
} from "../src/index.ts";

/**
 * Validation cases (blueprint N-4): known compositions → hand-checkable
 * outputs. Each expected value is arithmetic from the published formula,
 * checkable on paper.
 */

describe("PREN", () => {
  it("316L nominal (Cr 17, Mo 2.5, N 0.05) → 26.05", () => {
    const r = pren({ Cr: 17, Mo: 2.5, N: 0.05 });
    expect(r.value).toBeCloseTo(26.05, 2);
    expect(r.inWindow).toBe(true);
  });

  it("2205 nominal (Cr 22.5, Mo 3.25, N 0.17) → 35.95", () => {
    const r = pren({ Cr: 22.5, Mo: 3.25, N: 0.17 });
    expect(r.value).toBeCloseTo(35.945, 2);
  });

  it("N30 variant weights nitrogen at 30", () => {
    const r = pren({ Cr: 22.5, Mo: 3.25, N: 0.17 }, "N30");
    expect(r.value).toBeCloseTo(22.5 + 3.3 * 3.25 + 30 * 0.17, 3);
  });

  it("flags non-stainless compositions out of window", () => {
    const r = pren({ Cr: 0.8, Mo: 0.25 });
    expect(r.inWindow).toBe(false);
  });
});

describe("WRC-1992", () => {
  it("308L-type weld metal lands in the diagram window", () => {
    const r = wrc1992({ Cr: 19.5, Mo: 0.3, Ni: 10, C: 0.03, N: 0.06, Cu: 0.2 });
    expect(r.creq.value).toBeCloseTo(19.8, 2);
    expect(r.nieq.value).toBeCloseTo(12.3, 2);
    expect(r.creq.inWindow).toBe(true);
  });

  it("carbon steel is out of the diagram window", () => {
    const r = wrc1992({ C: 0.2, Mn: 1.0 });
    expect(r.creq.inWindow).toBe(false);
  });
});

describe("CE(IIW)", () => {
  it("C-Mn steel (C 0.20, Mn 1.00) → 0.367", () => {
    const r = ceIIW({ C: 0.2, Mn: 1.0 });
    expect(r.value).toBeCloseTo(0.3667, 3);
    expect(r.inWindow).toBe(true);
  });

  it("suggests Pcm below 0.12 %C", () => {
    const r = ceIIW({ C: 0.08, Mn: 1.4 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("non-ferrous-dominant compositions are out of window", () => {
    expect(ceIIW({ Al: 89, Zn: 5.6, Cu: 1.6 }).inWindow).toBe(false);
  });
});

describe("Ms (Andrews)", () => {
  it("4340 mid-spec → ≈ 302.5 °C", () => {
    const r = msAndrews({ C: 0.405, Mn: 0.7, Ni: 1.825, Cr: 0.8, Mo: 0.25 });
    expect(r.value).toBeCloseTo(302.5, 0);
    expect(r.inWindow).toBe(true);
  });

  it("austenitic stainless is out of window", () => {
    const r = msAndrews({ C: 0.03, Cr: 17, Ni: 12 });
    expect(r.inWindow).toBe(false);
  });

  it("aluminum-dominant compositions are out of window", () => {
    expect(msAndrews({ Al: 89, Zn: 5.6, Mg: 2.5 }).inWindow).toBe(false);
  });
});

describe("Larson-Miller", () => {
  it("600 °C, 100 000 h, C = 20 → 21.83", () => {
    const r = larsonMiller(600, 100_000);
    expect(r.value).toBeCloseTo((873.15 * 25) / 1000, 2);
  });
});

describe("missingness propagation", () => {
  it("CE with unspecified Mn is unknown — never a pure-iron number", () => {
    const r = ceIIW({ C: 0.2 });
    expect(Number.isNaN(r.value)).toBe(true);
    expect(r.missing).toContain("Mn");
    expect(r.inWindow).toBe(false);
  });

  it("Ms with unspecified C is unknown — 539 °C is pure iron, not a steel", () => {
    const r = msAndrews({ Mn: 1.0 });
    expect(Number.isNaN(r.value)).toBe(true);
    expect(r.missing).toContain("C");
  });

  it("absent optional elements are disclosed, not silent", () => {
    const r = pren({ Cr: 17, Mo: 2.5 }); // N, W unspecified
    expect(r.warnings.join(" ")).toMatch(/taken as 0/);
    expect(r.warnings.join(" ")).toMatch(/N/);
  });
});

describe("specRange — specification-derived intervals", () => {
  it("316L spec permits PREN ≈ 22.6–29.5", () => {
    const r = specRange(pren, [
      { element: "Cr", min: 16, max: 18 },
      { element: "Ni", min: 10, max: 14 },
      { element: "Mo", min: 2, max: 3 },
      { element: "N", max: 0.1 },
      { element: "C", max: 0.03 },
      { element: "Fe", balance: true },
    ]);
    expect(r.lo).toBeCloseTo(22.6, 1);
    expect(r.hi).toBeCloseTo(29.5, 1);
    expect(r.inWindow).toBe(true);
  });

  it("a spec that never regulates Mn yields an indeterminate CE range", () => {
    const r = specRange(ceIIW, [
      { element: "C", max: 0.26 },
      { element: "Fe", balance: true },
    ]);
    expect(r.missing).toContain("Mn");
    expect(r.inWindow).toBe(false);
  });
});

describe("midpointComposition", () => {
  it("resolves ranges to midpoints and treats ≤-max residuals as 0", () => {
    const c = midpointComposition([
      { element: "Cr", min: 16, max: 18 },
      { element: "C", max: 0.03 },
      { element: "Fe", balance: true },
    ]);
    expect(c.Cr).toBe(17);
    expect(c.C).toBe(0);
    expect(c.Fe).toBeUndefined();
  });
});
