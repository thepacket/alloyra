import { evalPiecewise } from "./expr.ts";
import type { TdbDatabase, TdbParameter, TdbPhase } from "./tdb.ts";

/**
 * Compound-energy-formalism Gibbs energy (B-501): reference (endmember)
 * energies + ideal sublattice mixing + Redlich-Kister excess + the
 * Inden-Hillert-Jarl magnetic contribution. Per mole of FORMULA UNITS;
 * divide by atomsPerFormula for per-mole-atom quantities.
 */

/** SGTE/Thermo-Calc convention (8.3145), matching pycalphad — NOT the
 *  CODATA value: assessments were fitted with this constant, and a
 *  3.7e-5 difference shows up as a T·S_mix-shaped Gibbs offset. */
export const R_GAS = 8.3145;

export interface PhaseModel {
  name: string;
  sites: number[];
  /** Active species per sublattice (elements in play + VA where allowed). */
  constituents: string[][];
  /** Gibbs energy per mole formula at site fractions y (y[s][i]). */
  gm: (y: number[][], t: number) => number;
  atomsPerFormula: (y: number[][]) => number;
  /** Mole fraction of `el` among non-VA atoms. */
  moleFraction: (y: number[][], el: string) => number;
  warnings: string[];
}

function chainMatches(param: TdbParameter, model: string[][]): boolean {
  if (param.constituents.length !== model.length) return false;
  for (let s = 0; s < model.length; s++) {
    for (const sp of param.constituents[s]!) {
      if (sp !== "*" && !model[s]!.includes(sp)) return false;
    }
  }
  return true;
}

/** y·ln(y) with the correct 0·ln0 → 0 limit. */
function ylny(y: number): number {
  return y > 1e-14 ? y * Math.log(y) : 0;
}

export function buildPhaseModel(
  db: TdbDatabase,
  phase: TdbPhase,
  activeElements: string[],
): PhaseModel | undefined {
  const active = new Set([...activeElements.map((e) => e.toUpperCase()), "VA"]);
  const constituents = phase.constituents.map((sub) => sub.filter((sp) => active.has(sp)));
  if (constituents.some((sub) => sub.length === 0)) return undefined; // phase can't exist in this system
  // Phases whose every sublattice is VA-only are meaningless here.
  if (constituents.every((sub) => sub.every((sp) => sp === "VA"))) return undefined;

  const warnings: string[] = [];
  const params = db.parameters.filter(
    (p) => p.phase === phase.name && chainMatches(p, constituents),
  );

  /**
   * Hot-loop compilation: every parameter's constituent chain resolves to
   * FIXED sublattice indices for this model — do the string searches once
   * here, never per evaluation. A parameter whose chain cannot resolve
   * would weigh 0 forever, so it is dropped outright.
   */
  type CompiledTerm =
    | { kind: 1; s: number; i: number } // single species factor
    | { kind: 2; s: number; ia: number; ib: number; order: number } // binary R-K
    | { kind: 3; s: number; ia: number; ib: number; ic: number; order: number; lone: boolean }
    | { kind: 4; s: number; idx: number[] }; // quaternary+ symmetric
  interface CompiledParam {
    terms: CompiledTerm[];
    segments: TdbParameter["segments"];
  }

  const compileParam = (p: TdbParameter, lone: boolean): CompiledParam | undefined => {
    const terms: CompiledTerm[] = [];
    for (let s = 0; s < constituents.length; s++) {
      const specs = p.constituents[s]!;
      if (specs.length === 1) {
        const sp = specs[0]!;
        if (sp === "*") continue;
        const i = constituents[s]!.indexOf(sp);
        if (i < 0) return undefined;
        terms.push({ kind: 1, s, i });
      } else if (specs.length === 2) {
        const ia = constituents[s]!.indexOf(specs[0]!);
        const ib = constituents[s]!.indexOf(specs[1]!);
        if (ia < 0 || ib < 0) return undefined;
        terms.push({ kind: 2, s, ia, ib, order: p.order });
      } else if (specs.length === 3) {
        const ia = constituents[s]!.indexOf(specs[0]!);
        const ib = constituents[s]!.indexOf(specs[1]!);
        const ic = constituents[s]!.indexOf(specs[2]!);
        if (ia < 0 || ib < 0 || ic < 0) return undefined;
        if (!lone && p.order > 2) return undefined;
        terms.push({ kind: 3, s, ia, ib, ic, order: p.order, lone });
      } else {
        if (p.order !== 0) return undefined;
        const idx: number[] = [];
        for (const sp of specs) {
          const i = constituents[s]!.indexOf(sp);
          if (i < 0) return undefined;
          idx.push(i);
        }
        terms.push({ kind: 4, s, idx });
      }
    }
    return { terms, segments: p.segments };
  };

  const weightOf = (cp: CompiledParam, y: number[][]): number => {
    let w = 1;
    for (const t of cp.terms) {
      if (t.kind === 1) {
        w *= y[t.s]![t.i]!;
      } else if (t.kind === 2) {
        const ya = y[t.s]![t.ia]!;
        const yb = y[t.s]![t.ib]!;
        w *= ya * yb * (ya - yb) ** t.order;
      } else if (t.kind === 3) {
        const ya = y[t.s]![t.ia]!;
        const yb = y[t.s]![t.ib]!;
        const yc = y[t.s]![t.ic]!;
        w *= ya * yb * yc;
        if (!t.lone) {
          const yi = t.order === 0 ? ya : t.order === 1 ? yb : yc;
          w *= yi + (1 - ya - yb - yc) / 3;
        }
      } else {
        for (const i of t.idx) w *= y[t.s]![i]!;
      }
    }
    return w;
  };

  const gParams = params.filter((p) => p.kind === "G" || p.kind === "L");
  const tcParams = params.filter((p) => p.kind === "TC");
  const bmParams = params.filter((p) => p.kind === "BMAGN");

  // Thermo-Calc ternary convention: a LONE degree-0 ternary parameter is
  // symmetric (weight y_A·y_B·y_C, no Muggianu factor); the v_i =
  // y_i + (1−Σy)/3 weights apply only when multiple degrees are assessed
  // for the triple. Count parameters per (kind, constituent chain).
  const ternaryGroupSize = new Map<string, number>();
  for (const p of params) {
    if (p.constituents.some((sub) => sub.length === 3)) {
      const key = p.kind + "|" + p.constituents.map((c) => c.join(",")).join(":");
      ternaryGroupSize.set(key, (ternaryGroupSize.get(key) ?? 0) + 1);
    }
  }
  const isLoneSymmetricTernary = (p: TdbParameter): boolean =>
    p.order === 0 &&
    (ternaryGroupSize.get(p.kind + "|" + p.constituents.map((c) => c.join(",")).join(":")) ?? 0) === 1;
  for (const p of db.parameters) {
    if (p.phase === phase.name && p.constituents.some((sub) => sub.some((sp) => sp.length > 2 && !active.has(sp) && sp !== "*"))) {
      // parameter involving species outside the active set — correctly excluded
    }
  }

  const atomsPerFormula = (y: number[][]): number => {
    let n = 0;
    for (let s = 0; s < constituents.length; s++) {
      for (let i = 0; i < constituents[s]!.length; i++) {
        if (constituents[s]![i] !== "VA") n += phase.sites[s]! * y[s]![i]!;
      }
    }
    return n;
  };

  const moleFraction = (y: number[][], el: string): number => {
    const target = el.toUpperCase();
    let n = 0;
    let total = 0;
    for (let s = 0; s < constituents.length; s++) {
      for (let i = 0; i < constituents[s]!.length; i++) {
        const sp = constituents[s]![i]!;
        if (sp === "VA") continue;
        const amt = phase.sites[s]! * y[s]![i]!;
        total += amt;
        if (sp === target) n += amt;
      }
    }
    return total > 0 ? n / total : 0;
  };

  const magnetic = phase.magnetic;

  const compile = (list: TdbParameter[]): CompiledParam[] => {
    const out: CompiledParam[] = [];
    for (const p of list) {
      const cp = compileParam(p, isLoneSymmetricTernary(p));
      if (cp) out.push(cp);
    }
    return out;
  };
  const gEntries = compile(gParams);
  const tcEntries = compile(tcParams);
  const bmEntries = compile(bmParams);

  // Per-T parameter values: T is constant across an entire equilibrium
  // solve (millions of gm calls), so the piecewise/expression-tree
  // evaluation collapses to one cached number per parameter per T.
  let cachedT = Number.NaN;
  const gVals = new Float64Array(gEntries.length);
  const tcVals = new Float64Array(tcEntries.length);
  const bmVals = new Float64Array(bmEntries.length);
  const refreshT = (t: number): void => {
    for (let i = 0; i < gEntries.length; i++) gVals[i] = evalPiecewise(gEntries[i]!.segments, t);
    for (let i = 0; i < tcEntries.length; i++) tcVals[i] = evalPiecewise(tcEntries[i]!.segments, t);
    for (let i = 0; i < bmEntries.length; i++) bmVals[i] = evalPiecewise(bmEntries[i]!.segments, t);
    cachedT = t;
  };

  const gm = (y: number[][], t: number): number => {
    if (t !== cachedT) refreshT(t);
    let g = 0;
    let tc = 0;
    let bmagn = 0;
    for (let i = 0; i < gEntries.length; i++) {
      const w = weightOf(gEntries[i]!, y);
      if (w !== 0) g += w * gVals[i]!;
    }
    for (let i = 0; i < tcEntries.length; i++) {
      const w = weightOf(tcEntries[i]!, y);
      if (w !== 0) tc += w * tcVals[i]!;
    }
    for (let i = 0; i < bmEntries.length; i++) {
      const w = weightOf(bmEntries[i]!, y);
      if (w !== 0) bmagn += w * bmVals[i]!;
    }
    // Ideal sublattice mixing.
    let ideal = 0;
    for (let s = 0; s < constituents.length; s++) {
      let sub = 0;
      for (let i = 0; i < constituents[s]!.length; i++) sub += ylny(y[s]![i]!);
      ideal += phase.sites[s]! * sub;
    }
    g += R_GAS * t * ideal;
    // Inden-Hillert-Jarl magnetic contribution.
    if (magnetic && (tc !== 0 || bmagn !== 0)) {
      const f = magnetic.antiferromagneticFactor;
      if (tc < 0) {
        tc /= f;
        bmagn /= f;
      }
      if (tc > 0 && bmagn > -1) {
        const p = magnetic.structureFactor;
        const d = 518 / 1125 + (11692 / 15975) * (1 / p - 1);
        const tau = t / tc;
        let gTau: number;
        if (tau < 1) {
          gTau =
            1 -
            ((79 / (140 * p)) / tau +
              (474 / 497) * (1 / p - 1) * (tau ** 3 / 6 + tau ** 9 / 135 + tau ** 15 / 600)) /
              d;
        } else {
          gTau = -(tau ** -5 / 10 + tau ** -15 / 315 + tau ** -25 / 1500) / d;
        }
        g += R_GAS * t * Math.log(bmagn + 1) * gTau;
      }
    }
    return g;
  };

  return {
    name: phase.name,
    sites: phase.sites,
    constituents,
    gm,
    atomsPerFormula,
    moleFraction,
    warnings,
  };
}
