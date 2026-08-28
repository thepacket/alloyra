import { buildPhaseModel, type PhaseModel } from "./gibbs.ts";
import { solveTangentLp } from "./lp.ts";
import type { TdbDatabase } from "./tdb.ts";

/**
 * Multicomponent point equilibrium (B-501): global Gibbs minimization as
 * an LP over sampled phase constitutions (the tangent-plane construction),
 * tightened by adaptive log-space resampling around the LP-active points.
 * Deterministic (seeded RNG). Accuracy is set by the refinement rounds and
 * reported honestly by the caller's tolerance, not oversold.
 */

export interface MulticomponentPhase {
  phase: string;
  fraction: number;
  /** Per-phase mole fractions of the non-VA components. */
  composition: Record<string, number>;
  /** Winning constitution (site fractions per sublattice) and the model's
   *  constituent labels — the audit trail for cross-checking. */
  siteFractions: number[][];
  constituents: string[][];
  gPerMoleAtom: number;
}

export interface MulticomponentResult {
  phases: MulticomponentPhase[];
  feasible: boolean;
  /** Total Gibbs energy of the state, J per mole of atoms. */
  gPerMoleAtom: number;
  /** Chemical potentials (J/mol, SER reference) from the LP tangent plane. */
  chemicalPotentials: Record<string, number>;
  rounds: number;
  samples: number;
}

interface Sample {
  y: number[][];
  x: number[]; // constraint-row compositions (all components except dependent)
  g: number;
  phaseIdx: number;
}

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampY(v: number): number {
  return Math.min(1 - 1e-12, Math.max(1e-12, v));
}

function normalizeSub(y: number[]): number[] {
  let s = 0;
  for (const v of y) s += v;
  return y.map((v) => clampY(v / s));
}

export function pointEquilibrium(
  db: TdbDatabase,
  composition: Record<string, number>,
  tK: number,
  opts?: {
    suspend?: (phaseName: string) => boolean;
    samplesPerPhase?: number;
    rounds?: number;
    zoomSamples?: number;
    seed?: number;
    /** Warm-start constitutions (e.g. the neighboring temperature step's
     *  winners) — injected into the pool and refined like any candidate. */
    seeds?: { phase: string; y: number[][] }[];
  },
): MulticomponentResult {
  const comps = Object.keys(composition).map((e) => e.toUpperCase());
  const total = comps.reduce((s, e) => s + composition[e]!, 0);
  const x0: Record<string, number> = {};
  for (const e of comps) x0[e] = composition[e]! / total;
  // Dependent component: the largest (its balance is implied by Σx = 1).
  const dependent = comps.reduce((a, b) => (x0[a]! >= x0[b]! ? a : b));
  const rows = comps.filter((e) => e !== dependent);
  const target = rows.map((e) => x0[e]!);

  const models: PhaseModel[] = [];
  for (const phase of db.phases.values()) {
    if (opts?.suspend?.(phase.name)) continue;
    const model = buildPhaseModel(db, phase, comps);
    if (model) models.push(model);
  }
  if (models.length === 0) {
    throw new Error(`No phase of this database can exist in the ${comps.join("-")} system.`);
  }

  const rand = rng(opts?.seed ?? 0xa110);
  const pool: Sample[] = [];

  const pushSample = (model: PhaseModel, phaseIdx: number, y: number[][]) => {
    const atoms = model.atomsPerFormula(y);
    if (atoms < 1e-9) return;
    pool.push({
      y,
      x: rows.map((e) => model.moleFraction(y, e)),
      g: model.gm(y, tK) / atoms,
      phaseIdx,
    });
  };

  const dirichlet = (k: number): number[] => {
    const v: number[] = [];
    for (let i = 0; i < k; i++) v.push(-Math.log(1 - rand()));
    return normalizeSub(v);
  };

  // Initial sampling: endmembers, Dirichlet interior, and log-uniform
  // dilute points (equilibria live at 1e-4 solute levels; uniform sampling
  // never finds those corners).
  models.forEach((model, phaseIdx) => {
    const mixDims = model.constituents.reduce((s, sub) => s + (sub.length - 1), 0);
    // Endmember lattice (cap the combinatorics).
    const emCounts = model.constituents.map((sub) => sub.length);
    const emTotal = emCounts.reduce((a, b) => a * b, 1);
    if (emTotal <= 4096) {
      const idx = new Array(emCounts.length).fill(0);
      for (;;) {
        pushSample(
          model,
          phaseIdx,
          model.constituents.map((sub, s) => sub.map((_, i) => (i === idx[s] ? 1 - 1e-12 : 1e-12))),
        );
        let s = 0;
        for (; s < emCounts.length; s++) {
          if (++idx[s]! < emCounts[s]!) break;
          idx[s] = 0;
        }
        if (s === emCounts.length) break;
      }
    }
    // Mixed sampling per sublattice: Dirichlet interior, or dominant-mode
    // (one species at 1−δ, the REST sharing δ, δ log-uniform) — the mode
    // real solutions live in: an austenite interstitial sublattice is
    // VA ≈ 0.999 with C AND N simultaneously dilute, a corner plain
    // Dirichlet never visits.
    const subSample = (k: number): number[] => {
      if (k === 1) return [1];
      if (rand() < 0.45) return dirichlet(k);
      const dom = Math.floor(rand() * k);
      const delta = 10 ** (-4.5 + 4.35 * rand());
      const rest = dirichlet(k - 1).map((v) => v * delta);
      const y: number[] = [];
      let j = 0;
      for (let i = 0; i < k; i++) y.push(i === dom ? 1 - delta : rest[j++]!);
      return normalizeSub(y);
    };
    const nBase = opts?.samplesPerPhase ?? Math.min(6000, 600 + 600 * mixDims);
    for (let i = 0; i < nBase; i++) {
      pushSample(model, phaseIdx, model.constituents.map((sub) => subSample(sub.length)));
    }
  });

  // Defaults sized for the hard cases (multi-phase low-T states need the
  // budget: 316L at 773 K converges to pycalphad's G to the decimal at
  // 16/600 but sits ~30 J high at 8/320); the early-exit below keeps easy
  // cases fast.
  // Warm-start seeds join the pool before the first LP. A seed is only
  // usable when its site-fraction vectors match this system's sublattice
  // dimensions — a seed from a run with a different element set (e.g. an
  // isopleth column where a solute hits zero) has differently-sized
  // constituent lists, and pushing it would poison the pool with garbage
  // energies. Mismatched seeds are skipped, never trusted.
  if (opts?.seeds) {
    for (const seed of opts.seeds) {
      const idx = models.findIndex((m) => m.name === seed.phase);
      if (idx < 0) continue;
      const m = models[idx]!;
      const dimsOk =
        seed.y.length === m.constituents.length &&
        seed.y.every((row, s) => row.length === m.constituents[s]!.length);
      if (dimsOk) pushSample(m, idx, seed.y);
    }
  }

  const rounds = opts?.rounds ?? 16;
  const zoomSamples = opts?.zoomSamples ?? 600;
  let lastObjective = Number.POSITIVE_INFINITY;
  let sol = solveTangentLp(pool, target);
  let roundsUsed = 0;

  for (let round = 0; round < rounds; round++) {
    roundsUsed = round + 1;
    if (!sol.feasible) break;
    // Zoom candidates: the LP-active points PLUS each phase's best point
    // within a reduced-cost window of the tangent plane — a phase that
    // narrowly loses at this sampling density (its true optimum unsampled)
    // must be refined too, or the solver locks into the wrong basin.
    const plane = (x: number[]): number => {
      let v = sol.duals[sol.duals.length - 1] ?? 0;
      for (let j = 0; j < x.length; j++) v += (sol.duals[j] ?? 0) * x[j]!;
      return v;
    };
    const rcWindow = 4000; // J/mol-atom
    const zoomSeeds = new Set<number>(sol.basis);
    const bestByPhase = new Map<number, { idx: number; rc: number }>();
    pool.forEach((p, idx) => {
      const rc = p.g - plane(p.x);
      const cur = bestByPhase.get(p.phaseIdx);
      if (!cur || rc < cur.rc) bestByPhase.set(p.phaseIdx, { idx, rc });
    });
    for (const { idx, rc } of bestByPhase.values()) {
      if (rc < rcWindow) zoomSeeds.add(idx);
    }
    // Deterministic polish: multiplicative pattern search descending the
    // reduced cost rc(y) = g(y) − plane(x(y)) — converges each seed to its
    // phase's local tangent optimum far faster than random zoom alone.
    const polish = (model: PhaseModel, y0: number[][]): number[][] => {
      let y = y0.map((sub) => [...sub]);
      const rcOf = (yy: number[][]): number => {
        const atoms = model.atomsPerFormula(yy);
        if (atoms < 1e-9) return Number.POSITIVE_INFINITY;
        return model.gm(yy, tK) / atoms - plane(rows.map((e) => model.moleFraction(yy, e)));
      };
      let best = rcOf(y);
      let h = 0.4;
      let evals = 0;
      while (h > 3e-4 && evals < 900) {
        let improved = false;
        for (let s = 0; s < y.length; s++) {
          if (y[s]!.length < 2) continue;
          for (let i = 0; i < y[s]!.length; i++) {
            for (const dir of [1 + h, 1 / (1 + h)]) {
              const cand = y.map((sub, ss) =>
                ss === s ? normalizeSub(sub.map((v, j) => (j === i ? clampY(v * dir) : v))) : sub,
              );
              const rc = rcOf(cand);
              evals++;
              if (rc < best - 1e-10) {
                best = rc;
                y = cand;
                improved = true;
              }
            }
          }
        }
        if (!improved) h *= 0.45;
      }
      return y;
    };

    const sigma = 0.6 * 0.55 ** round;
    for (const bi of zoomSeeds) {
      const base = pool[bi]!;
      const model = models[base.phaseIdx]!;
      pushSample(model, base.phaseIdx, polish(model, base.y));
      for (let i = 0; i < zoomSamples; i++) {
        const y = base.y.map((sub) =>
          normalizeSub(
            sub.map((v) => {
              const u1 = Math.max(rand(), 1e-12);
              const u2 = rand();
              const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
              return clampY(v * Math.exp(sigma * gauss));
            }),
          ),
        );
        pushSample(model, base.phaseIdx, y);
      }
    }
    const next = solveTangentLp(pool, target);
    if (next.feasible) {
      const improved = lastObjective - next.objective;
      sol = next;
      if (improved < 1e-4 && round >= 2) break;
      lastObjective = next.objective;
    }
  }

  if (!sol.feasible) {
    return {
      phases: [],
      feasible: false,
      gPerMoleAtom: Number.NaN,
      chemicalPotentials: {},
      rounds: roundsUsed,
      samples: pool.length,
    };
  }

  // Tangent plane = chemical potentials: G(x) = Σ duals[j]·x_j + duals[m−1],
  // so μ_row = duals[j] + duals[m−1] and μ_dependent = duals[m−1].
  const mu: Record<string, number> = {};
  const muBase = sol.duals[sol.duals.length - 1] ?? Number.NaN;
  mu[dependent] = muBase;
  rows.forEach((e, j) => {
    mu[e] = (sol.duals[j] ?? 0) + muBase;
  });

  // Merge basis points of the same phase with (numerically) identical
  // composition — LP degeneracy, not a miscibility gap.
  const merged: MulticomponentPhase[] = [];
  sol.basis.forEach((bi, k) => {
    const s = pool[bi]!;
    const model = models[s.phaseIdx]!;
    const compRec: Record<string, number> = {};
    for (const e of comps) compRec[e] = model.moleFraction(s.y, e);
    const fraction = sol.fractions[k]!;
    const existing = merged.find(
      (mp) =>
        mp.phase === model.name &&
        comps.every((e) => Math.abs(mp.composition[e]! - compRec[e]!) < 5e-3),
    );
    if (existing) {
      const fTot = existing.fraction + fraction;
      for (const e of comps) {
        existing.composition[e] =
          (existing.composition[e]! * existing.fraction + compRec[e]! * fraction) / fTot;
      }
      existing.fraction = fTot;
    } else {
      merged.push({
        phase: model.name,
        fraction,
        composition: compRec,
        siteFractions: s.y.map((sub) => [...sub]),
        constituents: model.constituents.map((sub) => [...sub]),
        gPerMoleAtom: s.g,
      });
    }
  });
  merged.sort((a, b) => b.fraction - a.fraction);
  // Drop LP-degeneracy slivers below the engine's honest resolution and
  // renormalize — a 6e-5 "phase" is numerical residue, not a prediction.
  const kept = merged.filter((p) => p.fraction >= 2e-4);
  const fSum = kept.reduce((s, p) => s + p.fraction, 0);
  for (const p of kept) p.fraction /= fSum;

  return {
    phases: kept,
    feasible: true,
    gPerMoleAtom: sol.objective,
    chemicalPotentials: mu,
    rounds: roundsUsed,
    samples: pool.length,
  };
}
