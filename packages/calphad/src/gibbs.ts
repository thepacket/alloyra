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

  /** Product of site fractions selected by a parameter's constituent chain,
   *  including the Redlich-Kister (y_A − y_B)^order factor for the
   *  interacting sublattice. Returns 0 when inapplicable. */
  function chainWeight(param: TdbParameter, y: number[][]): number {
    let w = 1;
    let rk = 1;
    for (let s = 0; s < constituents.length; s++) {
      const specs = param.constituents[s]!;
      if (specs.length === 1) {
        const sp = specs[0]!;
        if (sp === "*") continue; // wildcard: no fraction factor
        const idx = constituents[s]!.indexOf(sp);
        if (idx < 0) return 0;
        w *= y[s]![idx]!;
      } else if (specs.length === 2) {
        const ia = constituents[s]!.indexOf(specs[0]!);
        const ib = constituents[s]!.indexOf(specs[1]!);
        if (ia < 0 || ib < 0) return 0;
        const ya = y[s]![ia]!;
        const yb = y[s]![ib]!;
        w *= ya * yb;
        rk *= (ya - yb) ** param.order;
      } else {
        // Ternary+ interactions: symmetric order-0 only (Muggianu
        // asymmetric terms are out of scope for the binary engine).
        if (param.order !== 0) {
          return 0;
        }
        for (const sp of specs) {
          const idx = constituents[s]!.indexOf(sp);
          if (idx < 0) return 0;
          w *= y[s]![idx]!;
        }
      }
    }
    return w * rk;
  }

  const gParams = params.filter((p) => p.kind === "G" || p.kind === "L");
  const tcParams = params.filter((p) => p.kind === "TC");
  const bmParams = params.filter((p) => p.kind === "BMAGN");
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

  const gm = (y: number[][], t: number): number => {
    let g = 0;
    let tc = 0;
    let bmagn = 0;
    for (const p of gParams) {
      const w = chainWeight(p, y);
      if (w !== 0) g += w * evalPiecewise(p.segments, t);
    }
    for (const p of tcParams) {
      const w = chainWeight(p, y);
      if (w !== 0) tc += w * evalPiecewise(p.segments, t);
    }
    for (const p of bmParams) {
      const w = chainWeight(p, y);
      if (w !== 0) bmagn += w * evalPiecewise(p.segments, t);
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
