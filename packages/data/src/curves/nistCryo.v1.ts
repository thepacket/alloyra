import type { CurveRecord } from "../types.ts";

/**
 * NIST cryogenic material property curves (B-301/B-204). The shipped
 * artifact is NIST's PUBLISHED FIT — coefficients below are verbatim from
 * the NIST Cryogenic Material Properties database (trc.nist.gov/cryogenics,
 * public domain); the points are deterministic evaluations of those fits,
 * never hand-typed data. Each record cites the fit error NIST states.
 *
 * Fit forms:
 *  - log10poly:  log10(y) = Σ aᵢ·(log10 T)ᵢ
 *  - poly:       y = Σ aᵢ·Tᵢ, with an optional low-T plateau
 */

interface Log10PolyFit {
  kind: "log10poly";
  coeffs: readonly number[];
  rangeK: readonly [number, number];
}
interface PolyFit {
  kind: "poly";
  coeffs: readonly number[];
  rangeK: readonly [number, number];
  plateau?: { belowK: number; value: number };
}
type Fit = Log10PolyFit | PolyFit;

const evalFit = (f: Fit, tK: number): number => {
  if (f.kind === "log10poly") {
    const lt = Math.log10(tK);
    return 10 ** f.coeffs.reduce((s, c, i) => s + c * lt ** i, 0);
  }
  if (f.plateau && tK < f.plateau.belowK) return f.plateau.value;
  return f.coeffs.reduce((s, c, i) => s + c * tK ** i, 0);
};

/** Piecewise fit: segments in ascending order, chosen by upper bound. */
const evalPiecewise = (segments: readonly Fit[], tK: number): number => {
  for (const s of segments) {
    if (tK <= s.rangeK[1]) return evalFit(s, tK);
  }
  return evalFit(segments[segments.length - 1]!, tK);
};

const logspace = (lo: number, hi: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) =>
    Number((10 ** (Math.log10(lo) + (i / (n - 1)) * (Math.log10(hi) - Math.log10(lo)))).toPrecision(4)),
  );
const linspace = (lo: number, hi: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => Number((lo + (i / (n - 1)) * (hi - lo)).toPrecision(4)));

const pts = (
  xs: number[],
  segments: readonly Fit[],
): readonly (readonly [number, number])[] =>
  xs.map((x) => [x, Number(evalPiecewise(segments, x).toPrecision(4))] as const);

const NIST = "NIST Cryogenic Material Properties database (trc.nist.gov/cryogenics), public domain";

// ---- 304 stainless -------------------------------------------------------
const SS304_K: Fit[] = [
  { kind: "log10poly", coeffs: [-1.4087, 1.3982, 0.2543, -0.626, 0.2334, 0.4256, -0.4658, 0.165, -0.0199], rangeK: [1, 300] },
];
const SS304_CP: Fit[] = [
  { kind: "log10poly", coeffs: [22.0061, -127.5528, 303.647, -381.0098, 274.0328, -112.9212, 24.7593, -2.239153], rangeK: [4, 300] },
];
const SS304_E: Fit[] = [
  { kind: "poly", coeffs: [2.098145e2, 1.217019e-1, -1.146999e-2, 3.60543e-4, -3.0179e-6], rangeK: [5, 57] },
  { kind: "poly", coeffs: [2.100593e2, 1.534883e-1, -1.61739e-3, 5.11706e-6, -6.1546e-9], rangeK: [57, 293] },
];
const SS304_DL: Fit[] = [
  { kind: "poly", coeffs: [-2.9554e2, -3.9811e-1, 9.2683e-3, -2.0261e-5, 1.7127e-8], rangeK: [4, 300], plateau: { belowK: 23, value: -300.04 } },
];

// ---- 316 stainless (NIST publishes the same conductivity/expansion fit
// family as 304; specific heat and modulus have their own segments) -------
const SS316_CP: Fit[] = [
  { kind: "log10poly", coeffs: [12.2486, -80.6422, 218.743, -308.854, 239.5296, -89.9982, 3.15315, 8.44996, -1.91368], rangeK: [4, 50] },
  { kind: "log10poly", coeffs: [-1879.464, 3643.198, 76.70125, -6176.028, 7437.6247, -4305.7217, 1382.4627, -237.22704, 17.05262], rangeK: [50, 300] },
];
const SS316_E: Fit[] = [
  { kind: "poly", coeffs: [2.084729e2, -1.358965e-1, 8.368629e-3, -1.3817e-4, 6.8319e-7], rangeK: [8, 50] },
  { kind: "poly", coeffs: [2.079488e2, 7.394241e-2, -9.6272e-4, 2.84556e-6, -3.2408e-9], rangeK: [50, 294] },
];

// ---- 6061-T6 aluminum ----------------------------------------------------
const AL6061_K: Fit[] = [
  { kind: "log10poly", coeffs: [0.07918, 1.0957, -0.07277, 0.08084, 0.02803, -0.09464, 0.04179, -0.00571], rangeK: [1, 300] },
];
const AL6061_CP: Fit[] = [
  { kind: "log10poly", coeffs: [46.6467, -314.292, 866.662, -1298.3, 1162.27, -637.795, 210.351, -38.3094, 2.96344], rangeK: [4, 300] },
];
const AL6061_E: Fit[] = [
  { kind: "poly", coeffs: [77.71221, 0.01030646, -2.9241e-4, 8.9936e-7, -1.0709e-9], rangeK: [2, 295] },
];
const AL6061_DL: Fit[] = [
  { kind: "poly", coeffs: [-412.77, -0.30389, 0.0087696, -9.9821e-6, 0], rangeK: [4, 300], plateau: { belowK: 18, value: -415.45 } },
];

// ---- 5083 aluminum (NIST publishes shared Al cp/expansion fits — noted) --
const AL5083_K: Fit[] = [
  { kind: "log10poly", coeffs: [-0.90933, 5.751, -11.112, 13.612, -9.3977, 3.6873, -0.77295, 0.067336], rangeK: [1, 300] },
];
const AL5083_E: Fit[] = [
  { kind: "poly", coeffs: [8.083212e1, 1.061708e-2, -3.0161e-4, 7.56134e-7, -6.9948e-10], rangeK: [2, 295] },
];

// ---- Ti-6Al-4V -----------------------------------------------------------
const TI64_K: Fit[] = [
  { kind: "log10poly", coeffs: [-5107.8774, 19240.422, -30789.064, 27134.756, -14226.379, 4438.2154, -763.07767, 55.796592], rangeK: [20, 300] },
];
const TI64_DL: Fit[] = [
  { kind: "poly", coeffs: [-1.711e2, -2.14e-1, 4.807e-3, -7.111e-6, 0], rangeK: [4, 300], plateau: { belowK: 24, value: -173.61 } },
];

// ---- Inconel 718 ---------------------------------------------------------
const IN718_K: Fit[] = [
  { kind: "log10poly", coeffs: [-8.28921, 39.447, -83.4353, 98.169, -67.2088, 26.7082, -5.7205, 0.51115], rangeK: [4, 300] },
];
const IN718_DL: Fit[] = [
  { kind: "poly", coeffs: [-2.368e2, -2.12e-1, 5.497e-3, -6.882e-6, 0], rangeK: [4, 300], plateau: { belowK: 20, value: -238.87 } },
];

// ---- Cartridge brass (NIST states UNS C26000; conductivity only, 5–110 K)
const BRASS_K: Fit[] = [
  { kind: "log10poly", coeffs: [0.021035, -1.01835, 4.54083, -5.03374, 3.20536, -1.12933, 0.174057, -0.0038151], rangeK: [5, 110] },
];

const curve = (
  id: string,
  property: CurveRecord["property"],
  unit: string,
  segments: readonly Fit[],
  xs: number[],
  fitError: string,
  opts?: { log?: boolean; note?: string },
): CurveRecord => ({
  id,
  property,
  x: { quantity: "temperature", unit: "K", ...(opts?.log ? { log: true } : {}) },
  unit,
  points: pts(xs, segments),
  provenance: "estimated",
  source: `${NIST}; log-polynomial fit, stated fit error ${fitError}`,
  ...(opts?.note ? { note: opts.note } : {}),
});

const LOG_T = logspace(4, 300, 26);

/** Curve records keyed by condition id, merged into the dataset at load. */
export const nistCryoCurves: Record<string, CurveRecord[]> = {
  "s30400-annealed-plate": [
    curve("s30400-nist-k", "thermal_conductivity", "W/(m·K)", SS304_K, LOG_T, "2 %", { log: true }),
    curve("s30400-nist-cp", "specific_heat", "J/(kg·K)", SS304_CP, LOG_T, "5 %", { log: true }),
    curve("s30400-nist-e", "elastic_modulus", "GPa", SS304_E, linspace(5, 293, 25), "1 %"),
    curve("s30400-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", SS304_DL, linspace(4, 300, 25), "5 %"),
  ],
  "s31603-annealed-plate": [
    curve("s31603-nist-k", "thermal_conductivity", "W/(m·K)", SS304_K, LOG_T, "2 %", {
      log: true,
      note: "NIST fit published for 316 stainless (shared 304/316 conductivity fit); applied to 316L — the L-grade carbon difference is negligible for thermal transport.",
    }),
    curve("s31603-nist-cp", "specific_heat", "J/(kg·K)", SS316_CP, LOG_T, "2 %", {
      log: true,
      note: "NIST fit for 316 stainless applied to 316L.",
    }),
    curve("s31603-nist-e", "elastic_modulus", "GPa", SS316_E, linspace(8, 294, 25), "1 %", {
      note: "NIST fit for 316 stainless applied to 316L.",
    }),
    curve("s31603-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", SS304_DL, linspace(4, 300, 25), "5 %", {
      note: "NIST publishes one austenitic-stainless expansion fit (304 family); applied to 316L.",
    }),
  ],
  "a96061-t6-plate": [
    curve("a96061-nist-k", "thermal_conductivity", "W/(m·K)", AL6061_K, LOG_T, "0.5 %", { log: true }),
    curve("a96061-nist-cp", "specific_heat", "J/(kg·K)", AL6061_CP, LOG_T, "5 %", { log: true }),
    curve("a96061-nist-e", "elastic_modulus", "GPa", AL6061_E, linspace(4, 295, 25), "1 %"),
    curve("a96061-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", AL6061_DL, linspace(4, 300, 25), "4 %"),
  ],
  "a95083-h116-plate": [
    curve("a95083-nist-k", "thermal_conductivity", "W/(m·K)", AL5083_K, LOG_T, "1 %", { log: true }),
    curve("a95083-nist-cp", "specific_heat", "J/(kg·K)", AL6061_CP, LOG_T, "5 %", {
      log: true,
      note: "NIST publishes one aluminum-alloy specific-heat fit (shared with 6061); applied to 5083.",
    }),
    curve("a95083-nist-e", "elastic_modulus", "GPa", AL5083_E, linspace(4, 295, 25), "1 %"),
    curve("a95083-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", AL6061_DL, linspace(4, 300, 25), "4 %", {
      note: "NIST publishes one aluminum-alloy expansion fit (shared with 6061); applied to 5083.",
    }),
  ],
  "r56400-annealed-sheet": [
    curve("r56400-nist-k", "thermal_conductivity", "W/(m·K)", TI64_K, logspace(23, 300, 22), "2 %", {
      log: true,
      note: "NIST fit valid 20–300 K (data 23–300 K) — no extrapolation below.",
    }),
    curve("r56400-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", TI64_DL, linspace(4, 300, 25), "1.5 %"),
  ],
  "n07718-sta": [
    curve("n07718-nist-k", "thermal_conductivity", "W/(m·K)", IN718_K, LOG_T, "2 %", { log: true }),
    curve("n07718-nist-dl", "thermal_contraction", "10⁻⁵·ΔL/L₂₉₃", IN718_DL, linspace(4, 300, 25), "1.1 %"),
  ],
  "c26000-annealed": [
    curve("c26000-nist-k", "thermal_conductivity", "W/(m·K)", BRASS_K, logspace(5, 110, 20), "1.5 %", {
      log: true,
      note: "NIST fit for UNS C26000, valid 5–110 K only — room-temperature conductivity is NOT covered by this curve.",
    }),
  ],
};
