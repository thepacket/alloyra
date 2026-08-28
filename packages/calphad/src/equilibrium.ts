import { buildPhaseModel, type PhaseModel } from "./gibbs.ts";
import type { TdbDatabase } from "./tdb.ts";

/**
 * Binary point equilibrium (B-501 first slice): global minimization by
 * dense constitution sampling + lower convex hull in (x, G) — the same
 * hull-of-sampled-compositions idea pycalphad seeds its solver with,
 * without the local refinement stage. Composition resolution is the grid
 * step; the engine reports it rather than pretending to more.
 */

export interface EquilibriumPhase {
  phase: string;
  fraction: number;
  /** Mole fraction of component B in this phase. */
  x: number;
}

export interface BinaryEquilibriumResult {
  phases: EquilibriumPhase[];
  /** True when the state sits on a two-phase tie-line. */
  tieLine: boolean;
  /** Composition resolution of the sampling grid (mole fraction). */
  resolution: number;
  gridPointCount: number;
}

interface SamplePoint {
  x: number;
  g: number;
  phase: string;
}

/** Simplex grid over k site fractions summing to 1. */
function* simplexGrid(k: number, steps: number): Generator<number[]> {
  if (k === 1) {
    yield [1];
    return;
  }
  if (k === 2) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      yield [clamp01(1 - t), clamp01(t)];
    }
    return;
  }
  // k ≥ 3: coarser recursive grid.
  const coarse = Math.max(8, Math.floor(steps / 8));
  function* rec(remaining: number, left: number): Generator<number[]> {
    if (remaining === 1) {
      yield [clamp01(left)];
      return;
    }
    for (let i = 0; i <= coarse; i++) {
      const v = (i / coarse) * left;
      for (const rest of rec(remaining - 1, left - v)) {
        yield [clamp01(v), ...rest];
      }
    }
  }
  yield* rec(k, 1);
}

function clamp01(v: number): number {
  return Math.min(1 - 1e-12, Math.max(1e-12, v));
}

function samplePhase(model: PhaseModel, elB: string, t: number, steps: number): SamplePoint[] {
  const out: SamplePoint[] = [];
  const grids = model.constituents.map((sub) => [...simplexGrid(sub.length, steps)]);
  // Cartesian product with a hard cap to keep pathological phases bounded.
  const cap = 60_000;
  const idx = new Array(grids.length).fill(0);
  let count = 0;
  for (;;) {
    const y = grids.map((g, s) => g[idx[s]!]!);
    const atoms = model.atomsPerFormula(y);
    if (atoms > 1e-9) {
      out.push({
        x: model.moleFraction(y, elB),
        g: model.gm(y, t) / atoms,
        phase: model.name,
      });
    }
    if (++count >= cap) break;
    let s = 0;
    for (; s < grids.length; s++) {
      if (++idx[s]! < grids[s]!.length) break;
      idx[s] = 0;
    }
    if (s === grids.length) break;
  }
  return out;
}

/** Andrew's monotone chain, lower hull only, over (x, g). */
function lowerHull(points: SamplePoint[]): SamplePoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.g - b.g);
  const hull: SamplePoint[] = [];
  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2]!;
      const b = hull[hull.length - 1]!;
      // Keep b only if it turns clockwise (stays below the a→p chord).
      if ((b.x - a.x) * (p.g - a.g) - (b.g - a.g) * (p.x - a.x) <= 0) hull.pop();
      else break;
    }
    // Deduplicate identical x (keep the lower g, already ensured by sort).
    if (hull.length > 0 && Math.abs(hull[hull.length - 1]!.x - p.x) < 1e-12) continue;
    hull.push(p);
  }
  return hull;
}

export function binaryPointEquilibrium(
  db: TdbDatabase,
  components: [string, string],
  xB: number,
  tK: number,
  opts?: {
    steps?: number;
    /** Phase suspension (standard CALPHAD practice — e.g. MatCalc's GP_/CL_
     *  auxiliary phases duplicate matrix energetics and belong suspended
     *  in plain equilibrium). */
    suspend?: (phaseName: string) => boolean;
  },
): BinaryEquilibriumResult {
  const [, elB] = components;
  const steps = opts?.steps ?? 800;
  const points: SamplePoint[] = [];
  for (const phase of db.phases.values()) {
    if (opts?.suspend?.(phase.name)) continue;
    const model = buildPhaseModel(db, phase, components);
    if (!model) continue;
    points.push(...samplePhase(model, elB, tK, steps));
  }
  if (points.length === 0) {
    throw new Error(`No phase of this database can exist in the ${components.join("-")} system.`);
  }
  const hull = lowerHull(points);
  const target = Math.min(Math.max(xB, hull[0]!.x), hull[hull.length - 1]!.x);
  let seg = 0;
  for (let i = 0; i < hull.length - 1; i++) {
    if (target >= hull[i]!.x && target <= hull[i + 1]!.x) {
      seg = i;
      break;
    }
  }
  const a = hull[seg]!;
  const b = hull[Math.min(seg + 1, hull.length - 1)]!;
  const resolution = 1 / steps;

  // Single-phase vs tie-line: on a strictly convex single-phase G(x) curve
  // every sample is a hull vertex, so hull edges span one grid step; a
  // wide edge means the hull skipped over a hump — a genuine tie-line.
  // (An interior-gap test fails here: near the tangent points the
  // curve-chord gap vanishes quadratically, so shallow miscibility gaps
  // read as zero gap. Two-phase regions narrower than ~5 grid steps are
  // below this engine's resolution and report as single-phase.)
  const width = b.x - a.x;
  const tieLine = width > 5 * resolution;

  if (!tieLine || width < 1e-9) {
    const nearest = Math.abs(target - a.x) <= Math.abs(target - b.x) ? a : b;
    return {
      phases: [{ phase: nearest.phase, fraction: 1, x: target }],
      tieLine: false,
      resolution,
      gridPointCount: points.length,
    };
  }
  const fB = (target - a.x) / width;
  const phases: EquilibriumPhase[] = [
    { phase: a.phase, fraction: 1 - fB, x: a.x },
    { phase: b.phase, fraction: fB, x: b.x },
  ].sort((p, q) => p.x - q.x);
  return { phases, tieLine: true, resolution, gridPointCount: points.length };
}
