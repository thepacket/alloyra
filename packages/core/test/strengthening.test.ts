import { describe, expect, it } from "vitest";
import {
  MATRIX_CONSTANTS,
  ashbyOrowan,
  astmToMicrons,
  hallPetch,
  hollomon,
  micronsToAstm,
  md30Nohara,
} from "../src/index.ts";

describe("ASTM E112 grain size conversion", () => {
  it("G 8 ≈ 22.5 µm mean diameter (E112 relationship)", () => {
    expect(astmToMicrons(8)).toBeCloseTo(22.5, 0);
  });
  it("round-trips", () => {
    for (const g of [4, 8, 12]) {
      expect(micronsToAstm(astmToMicrons(g))).toBeCloseTo(g, 6);
    }
  });
  it("finer number = smaller grains", () => {
    expect(astmToMicrons(12)).toBeLessThan(astmToMicrons(6));
  });
});

describe("Hall-Petch", () => {
  it("mild-steel-typical parameters give a sensible yield", () => {
    // σ0 = 70 MPa, k_y = 600 MPa·√µm, d = 22.5 µm (ASTM 8)
    const r = hallPetch({ dUm: 22.5, sigma0MPa: 70, kyMPaSqrtUm: 600 });
    expect(r.value).toBeCloseTo(70 + 600 / Math.sqrt(22.5), 1); // ≈ 196.5
    expect(r.inWindow).toBe(true);
  });
  it("refinement raises strength", () => {
    const coarse = hallPetch({ dUm: 100, sigma0MPa: 70, kyMPaSqrtUm: 600 });
    const fine = hallPetch({ dUm: 5, sigma0MPa: 70, kyMPaSqrtUm: 600 });
    expect(fine.value).toBeGreaterThan(coarse.value);
  });
  it("nano regime flagged out-of-window", () => {
    expect(hallPetch({ dUm: 0.5, sigma0MPa: 70, kyMPaSqrtUm: 600 }).inWindow).toBe(false);
  });
});

describe("Hollomon / Considère", () => {
  it("304-like fit (K=1400, n=0.45) predicts a plausible UTS and εu", () => {
    const r = hollomon({ kMPa: 1400, n: 0.45 });
    // UTS_eng = K·nⁿ·e^(−n) ≈ 623 MPa — inside 304's real 515–700 band.
    expect(r.utsEng.value).toBeCloseTo(1400 * 0.45 ** 0.45 * Math.exp(-0.45), 1);
    expect(r.utsEng.value).toBeGreaterThan(515);
    expect(r.utsEng.value).toBeLessThan(700);
    // engineering uniform elongation = e^n − 1 ≈ 57 %
    expect(r.uniformElongationPct).toBeCloseTo((Math.exp(0.45) - 1) * 100, 1);
    expect(r.flowStress(0.45)).toBeCloseTo(1400 * 0.45 ** 0.45, 1);
  });
  it("higher n means more uniform elongation", () => {
    expect(hollomon({ kMPa: 1000, n: 0.4 }).uniformElongationPct).toBeGreaterThan(
      hollomon({ kMPa: 1000, n: 0.1 }).uniformElongationPct,
    );
  });
  it("n beyond metal range flagged", () => {
    expect(hollomon({ kMPa: 1000, n: 0.7 }).utsEng.inWindow).toBe(false);
  });
});

describe("Ashby-Orowan", () => {
  const al = MATRIX_CONSTANTS.Al!;
  it("peak-aged-Al-like dispersion gives a ~160 MPa increment", () => {
    const r = ashbyOrowan({
      volumeFraction: 0.02,
      particleDiameterNm: 10,
      shearModulusGPa: al.shearModulusGPa,
      burgersNm: al.burgersNm,
    });
    expect(r.value).toBeGreaterThan(120);
    expect(r.value).toBeLessThan(220);
    expect(r.inWindow).toBe(true);
  });
  it("coarsening (overaging) lowers the increment at fixed fraction", () => {
    const args = { volumeFraction: 0.02, shearModulusGPa: al.shearModulusGPa, burgersNm: al.burgersNm };
    const peak = ashbyOrowan({ ...args, particleDiameterNm: 10 });
    const overaged = ashbyOrowan({ ...args, particleDiameterNm: 40 });
    expect(overaged.value).toBeLessThan(peak.value);
  });
  it("shearing-regime sizes carry the upper-bound warning", () => {
    const r = ashbyOrowan({
      volumeFraction: 0.02,
      particleDiameterNm: 3,
      shearModulusGPa: al.shearModulusGPa,
      burgersNm: al.burgersNm,
    });
    expect(r.warnings.some((w) => w.includes("shearing"))).toBe(true);
  });
  it("non-dilute fraction flagged out-of-window", () => {
    expect(
      ashbyOrowan({ volumeFraction: 0.4, particleDiameterNm: 20, shearModulusGPa: 80, burgersNm: 0.25 }).inWindow,
    ).toBe(false);
  });
});

describe("Md30 grain-size term (B-107)", () => {
  const comp316 = { C: 0.015, N: 0.05, Si: 0.375, Mn: 1.0, Cr: 17.0, Ni: 12.0, Mo: 2.5, Fe: 67.06 };
  it("ν = 8 changes nothing; finer grain lowers Md30", () => {
    const bare = md30Nohara(comp316);
    const at8 = md30Nohara(comp316, { grainSizeAstm: 8 });
    const fine = md30Nohara(comp316, { grainSizeAstm: 12 });
    expect(at8.value).toBeCloseTo(bare.value, 6);
    expect(fine.value).toBeCloseTo(bare.value - 1.42 * 4, 6);
    expect(fine.formula).toContain("1.42");
    expect(bare.source.note).toContain("omitted");
  });
});
