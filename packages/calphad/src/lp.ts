/**
 * Dense revised-simplex LP for the equilibrium tangent-plane problem
 * (B-501 multicomponent slice):
 *
 *   minimize    Σ f_i · g_i
 *   subject to  Σ f_i · x_i^(j) = x*_j   (j = 1..C−1 composition rows)
 *               Σ f_i            = 1
 *               f_i ≥ 0
 *
 * The optimal basis has at most C columns — Gibbs' phase rule falling out
 * of LP theory. Row count is tiny (≤ ~10), column count is the sample
 * pool (10⁴–10⁵), so pricing dominates: O(N·C) per iteration.
 * Phase-1 uses artificial variables; a leftover artificial means the
 * target composition is outside the sampled hull.
 */

export interface LpSolution {
  /** Indices into the column pool with f > tolerance. */
  basis: number[];
  fractions: number[];
  objective: number;
  feasible: boolean;
  /** Row prices: plane(x) = Σ duals[j]·x_j + duals[m−1] — the tangent
   *  hyperplane (chemical-potential plane) at optimum. */
  duals: number[];
}

export function solveTangentLp(
  columns: { x: number[]; g: number }[],
  target: number[],
  opts?: { maxIter?: number },
): LpSolution {
  const m = target.length + 1; // composition rows + mole-balance row
  const n = columns.length;
  const maxIter = opts?.maxIter ?? 4000;
  const EPS = 1e-9;

  const b = [...target, 1];
  // Column access: a(i) = [x..., 1]; artificial columns follow the pool.
  const colA = (i: number, row: number): number =>
    i < n ? (row < m - 1 ? columns[i]!.x[row]! : 1) : row === i - n ? 1 : 0;

  // Big-M costs: artificials carry M >> any |g|.
  let maxAbsG = 1;
  for (const c of columns) maxAbsG = Math.max(maxAbsG, Math.abs(c.g));
  const M = maxAbsG * 1e4;
  const cost = (i: number): number => (i < n ? columns[i]!.g : M);

  // Start with the all-artificial basis.
  let basis: number[] = [];
  for (let r = 0; r < m; r++) basis.push(n + r);

  // Basis inverse by Gaussian elimination each iteration (m ≤ 10 — cheap
  // and immune to update drift).
  const invertBasis = (): number[][] | undefined => {
    const a: number[][] = [];
    for (let r = 0; r < m; r++) {
      a.push(basis.map((bi) => colA(bi, r)).concat(Array.from({ length: m }, (_, k) => (k === r ? 1 : 0))));
    }
    for (let col = 0; col < m; col++) {
      let piv = col;
      for (let r = col + 1; r < m; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[piv]![col]!)) piv = r;
      if (Math.abs(a[piv]![col]!) < 1e-13) return undefined;
      [a[col], a[piv]] = [a[piv]!, a[col]!];
      const d = a[col]![col]!;
      for (let k = 0; k < 2 * m; k++) a[col]![k]! /= d;
      for (let r = 0; r < m; r++) {
        if (r === col) continue;
        const f = a[r]![col]!;
        if (f === 0) continue;
        for (let k = 0; k < 2 * m; k++) a[r]![k]! -= f * a[col]![k]!;
      }
    }
    return a.map((row) => row.slice(m));
  };

  let stall = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const binv = invertBasis();
    if (!binv) return { basis: [], fractions: [], objective: Number.NaN, feasible: false, duals: [] };
    // xB = B^-1 b
    const xB = binv.map((row) => row.reduce((s, v, k) => s + v * b[k]!, 0));
    // y = c_B B^-1
    const y = new Array<number>(m).fill(0);
    for (let k = 0; k < m; k++) {
      const cb = cost(basis[k]!);
      for (let r = 0; r < m; r++) y[r]! += cb * binv[k]![r]!;
    }
    // Price columns: reduced cost = c_i − y·a_i. Bland's rule under stall.
    let enter = -1;
    let best = -EPS * Math.max(1, maxAbsG);
    const useBland = stall > 60;
    for (let i = 0; i < n; i++) {
      if (basis.includes(i)) continue;
      let ya = y[m - 1]!; // mole-balance row coefficient is 1
      const xi = columns[i]!.x;
      for (let r = 0; r < m - 1; r++) ya += y[r]! * xi[r]!;
      const rc = columns[i]!.g - ya;
      if (useBland) {
        if (rc < -EPS * Math.max(1, maxAbsG)) {
          enter = i;
          break;
        }
      } else if (rc < best) {
        best = rc;
        enter = i;
      }
    }
    if (enter < 0) {
      // Optimal. Feasible iff no artificial remains with weight.
      const fractions = xB;
      const feasible = basis.every((bi, k) => bi < n || Math.abs(fractions[k]!) < 1e-7);
      const keep: number[] = [];
      const f: number[] = [];
      let objective = 0;
      for (let k = 0; k < m; k++) {
        if (basis[k]! < n && fractions[k]! > 1e-9) {
          keep.push(basis[k]!);
          f.push(fractions[k]!);
          objective += fractions[k]! * columns[basis[k]!]!.g;
        }
      }
      return { basis: keep, fractions: f, objective, feasible, duals: y };
    }
    // Direction d = B^-1 a_enter; ratio test.
    const aEnter = Array.from({ length: m }, (_, r) => colA(enter, r));
    const d = binv.map((row) => row.reduce((s, v, k) => s + v * aEnter[k]!, 0));
    let leave = -1;
    let bestRatio = Number.POSITIVE_INFINITY;
    for (let k = 0; k < m; k++) {
      if (d[k]! > 1e-11) {
        const ratio = xB[k]! / d[k]!;
        if (ratio < bestRatio - 1e-12 || (Math.abs(ratio - bestRatio) < 1e-12 && basis[k]! > (leave >= 0 ? basis[leave]! : -1))) {
          bestRatio = ratio;
          leave = k;
        }
      }
    }
    if (leave < 0) {
      // Unbounded — cannot happen with Σf = 1, treat as failure.
      return { basis: [], fractions: [], objective: Number.NaN, feasible: false, duals: [] };
    }
    if (bestRatio < 1e-12) stall++;
    else stall = 0;
    basis[leave] = enter;
  }
  return { basis: [], fractions: [], objective: Number.NaN, feasible: false, duals: [] };
}
