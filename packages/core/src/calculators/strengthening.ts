import type { CalcResult } from "./types.ts";

/**
 * Strengthening-mechanism calculators (backlog B-105, design-v2 § 2.3):
 * quantitative models attached to the E1 microstructure vocabulary. Same
 * discipline as the composition calculators — formula, citation, and
 * validity window on every result; parameters the literature cannot supply
 * generically are USER INPUTS with cited literature-typical defaults,
 * never hidden constants.
 */

/** ASTM E112 grain-size number → mean planar grain diameter, µm. */
export function astmToMicrons(g: number): number {
  // E112: n = 2^(G−1) grains per square inch at 100× ⇒ 15.5·2^(G−1) per mm²
  // actual; mean grain area A = 1/n; d = √A.
  const perMm2 = 15.5 * 2 ** (g - 1);
  return 1000 / Math.sqrt(perMm2);
}

/** Mean grain diameter (µm) → ASTM E112 grain-size number. */
export function micronsToAstm(dUm: number): number {
  const perMm2 = (1000 / dUm) ** 2;
  return Math.log2(perMm2 / 15.5) + 1;
}

/**
 * Hall-Petch grain-boundary strengthening:
 *   σy = σ0 + k_y · d^(−1/2)
 * σ0 (friction stress) and k_y (locking parameter) are material-class
 * fits — supplied by the user, seeded with cited literature-typical
 * values. d in µm, k_y in MPa·µm^1/2.
 */
export function hallPetch(inputs: {
  dUm: number;
  sigma0MPa: number;
  kyMPaSqrtUm: number;
}): CalcResult {
  const { dUm, sigma0MPa, kyMPaSqrtUm } = inputs;
  const base = {
    unit: "MPa",
    formula: "σy = σ0 + k_y·d^(−1/2)",
    source: {
      citation: "Hall (1951), Proc. Phys. Soc. B 64, 747; Petch (1953), J. Iron Steel Inst. 174, 25",
      note: "σ0 and k_y are material-class fits (literature-typical seeds — verify for your alloy and condition); classical scaling holds from ~100 µm down to ~1 µm.",
    },
  };
  const warnings: string[] = [];
  let inWindow = true;
  if (!(dUm > 0)) {
    return { ...base, value: Number.NaN, inWindow: false, warnings: ["Grain size must be positive."] };
  }
  if (dUm < 1) {
    inWindow = false;
    warnings.push("d < 1 µm — approaching the ultrafine/nano regime where classical Hall-Petch weakens and can invert.");
  }
  if (dUm > 500) {
    inWindow = false;
    warnings.push("d > 500 µm — outside the range the classical fit describes.");
  }
  const value = sigma0MPa + kyMPaSqrtUm / Math.sqrt(dUm);
  return { ...base, value, inWindow, warnings };
}

/**
 * Hollomon strain hardening + Considère necking criterion:
 *   σ_true = K·ε^n; uniform true strain ε_u = n;
 *   engineering UTS ≈ K·n^n·e^(−n).
 * K and n come from a fit to the user's tensile data (no product ships
 * this fitting — the practitioner-gap the competitive analysis found).
 */
export function hollomon(inputs: { kMPa: number; n: number }): {
  utsEng: CalcResult;
  uniformElongationPct: number;
  flowStress: (trueStrain: number) => number;
} {
  const { kMPa, n } = inputs;
  const base = {
    unit: "MPa",
    formula: "σ = K·εⁿ; ε_u = n (Considère); UTS_eng = K·nⁿ·e^(−n)",
    source: {
      citation: "Hollomon (1945), Trans. AIME 162, 268; Dieter, Mechanical Metallurgy, 3rd ed. (1986), ch. 8",
      note: "K, n are fits to YOUR tensile data over a stated strain range; the power law rarely holds below ~1 % or beyond necking. Considère assumes rate-insensitive, uniform deformation.",
    },
  };
  const warnings: string[] = [];
  let inWindow = true;
  if (!(kMPa > 0) || !(n > 0)) {
    return {
      utsEng: { ...base, value: Number.NaN, inWindow: false, warnings: ["K and n must be positive."] },
      uniformElongationPct: Number.NaN,
      flowStress: () => Number.NaN,
    };
  }
  if (n > 0.6) {
    inWindow = false;
    warnings.push("n > 0.6 — beyond the range Hollomon fits describe for metals; check the fit.");
  }
  if (n < 0.02) {
    warnings.push("n < 0.02 — nearly non-hardening; necking is immediate and the UTS estimate degenerates to K·εⁿ at yield.");
  }
  const utsEng = kMPa * n ** n * Math.exp(-n);
  // Engineering uniform elongation from true uniform strain ε_u = n.
  const uniformElongationPct = (Math.exp(n) - 1) * 100;
  return {
    utsEng: { ...base, value: utsEng, inWindow, warnings },
    uniformElongationPct,
    flowStress: (trueStrain: number) => kMPa * trueStrain ** n,
  };
}

/** Literature-typical matrix constants for the Orowan calculation. */
export const MATRIX_CONSTANTS: Record<
  string,
  { shearModulusGPa: number; burgersNm: number; note: string }
> = {
  Al: { shearModulusGPa: 26.2, burgersNm: 0.286, note: "FCC Al, room temperature" },
  Fe: { shearModulusGPa: 81.6, burgersNm: 0.248, note: "BCC ferrite, room temperature" },
  Ni: { shearModulusGPa: 76.0, burgersNm: 0.249, note: "FCC Ni, room temperature" },
  Cu: { shearModulusGPa: 48.3, burgersNm: 0.256, note: "FCC Cu, room temperature" },
  Ti: { shearModulusGPa: 45.6, burgersNm: 0.295, note: "HCP α-Ti (a-type), room temperature" },
};

/**
 * Ashby-Orowan precipitation strengthening (non-shearable particles):
 *   Δσ(MPa) = 0.538·G·b·√f / X · ln(X / 2b)
 * with G in MPa and b, X in consistent length units (Gladman's form;
 * X = mean planar-intercept particle diameter). Below the shearing↔looping
 * transition this is an UPPER BOUND — shearing constants are
 * system-specific and are not invented here.
 */
export function ashbyOrowan(inputs: {
  volumeFraction: number;
  particleDiameterNm: number;
  shearModulusGPa: number;
  burgersNm: number;
}): CalcResult {
  const { volumeFraction: f, particleDiameterNm, shearModulusGPa, burgersNm } = inputs;
  const base = {
    unit: "MPa",
    formula: "Δσ = 0.538·G·b·√f/X · ln(X/2b)",
    source: {
      citation: "Gladman (1999), Mater. Sci. Technol. 15, 30 (Ashby-Orowan form)",
      note: "Non-shearable (looping) regime. Below the shearing transition (system-specific, typically a few nm) the real increment is LOWER — treat this as an upper bound there. Increment superposes on the matrix strength non-linearly.",
    },
  };
  const warnings: string[] = [];
  let inWindow = true;
  if (!(f > 0) || !(particleDiameterNm > 0)) {
    return { ...base, value: Number.NaN, inWindow: false, warnings: ["Volume fraction and particle diameter must be positive."] };
  }
  if (f > 0.3) {
    inWindow = false;
    warnings.push("f > 0.3 — dilute-dispersion assumption broken (this is a composite, not a dispersion).");
  }
  if (particleDiameterNm < 2 * burgersNm * 2) {
    inWindow = false;
    warnings.push("Particle diameter approaches the dislocation core scale — the continuum picture fails.");
  }
  if (particleDiameterNm < 5) {
    warnings.push("X < 5 nm — likely inside the shearing regime for most systems; Orowan is an upper bound here.");
  }
  const gMPa = shearModulusGPa * 1000;
  const bMm = burgersNm * 1e-6;
  const xMm = particleDiameterNm * 1e-6;
  const value = ((0.538 * gMPa * bMm * Math.sqrt(f)) / xMm) * Math.log(xMm / (2 * bMm));
  return { ...base, value, inWindow, warnings };
}
