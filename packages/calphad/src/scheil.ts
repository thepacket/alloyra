import { pointEquilibrium } from "./multicomponent.ts";
import type { TdbDatabase } from "./tdb.ts";

/**
 * Scheil-Gulliver solidification (B-504): classic assumptions — complete
 * mixing in the liquid, NO diffusion in the solid. Cool in ΔT steps; at
 * each step equilibrate the CURRENT liquid, freeze out whatever solid
 * forms, and carry the equilibrium liquid composition to the next step.
 * Interstitials (C, N) really do back-diffuse in practice, so real alloys
 * finish between this curve and lever-rule equilibrium — stated, not
 * hidden.
 */

export interface ScheilStep {
  tK: number;
  /** Overall liquid fraction remaining after this step. */
  fLiquid: number;
  /** Cumulative solid fraction per phase after this step. */
  solids: Record<string, number>;
  /** Liquid composition entering the next step (mole fractions). */
  liquidX: Record<string, number>;
}

export interface ScheilResult {
  steps: ScheilStep[];
  /** First temperature at which solid appeared (ΔT resolution). */
  liquidusK?: number;
  /** Temperature at which fLiquid crossed the cutoff (Scheil solidus). */
  solidusK?: number;
  solidTotals: Record<string, number>;
  /**
   * Kou hot-cracking index: max |dT/d√fs| over √fs ∈ [0.9, 0.99]
   * (Kou, Acta Mater. 88 (2015) 366). Steeper terminal solidification =
   * more crack-susceptible. A COMPARATIVE index between candidates, not
   * an absolute verdict.
   */
  kouIndexK?: number;
  terminated: "solidified" | "floor" | "no-liquid-phase";
}

/** Kou (2015) criterion from the fs(T) curve. */
function kouIndex(steps: ScheilStep[]): number | undefined {
  const pts = steps
    .map((s) => ({ sqrtFs: Math.sqrt(1 - s.fLiquid), tK: s.tK }))
    .filter((p) => p.sqrtFs >= 0.9 && p.sqrtFs <= 0.99);
  let max = 0;
  for (let i = 1; i < pts.length; i++) {
    const dSqrt = pts[i]!.sqrtFs - pts[i - 1]!.sqrtFs;
    if (dSqrt <= 1e-6) continue;
    const slope = Math.abs(pts[i]!.tK - pts[i - 1]!.tK) / dSqrt;
    if (slope > max) max = slope;
  }
  return max > 0 ? max : undefined;
}

export function scheilSolidify(
  db: TdbDatabase,
  composition: Record<string, number>,
  opts?: {
    tStartK?: number;
    tFloorK?: number;
    dT?: number;
    /** Liquid fraction below which the remainder is deemed solidified. */
    cutoff?: number;
    suspend?: (phaseName: string) => boolean;
    liquidPhase?: string;
    onProgress?: (step: ScheilStep) => void;
  },
): ScheilResult {
  const tStart = opts?.tStartK ?? 2000;
  const tFloor = opts?.tFloorK ?? 400;
  const dT = opts?.dT ?? 5;
  const cutoff = opts?.cutoff ?? 0.01;
  const liquidName = (opts?.liquidPhase ?? "LIQUID").toUpperCase();

  let liquidX: Record<string, number> = { ...composition };
  let fLiquid = 1;
  const solidTotals: Record<string, number> = {};
  const steps: ScheilStep[] = [];
  let liquidusK: number | undefined;
  let solidusK: number | undefined;
  let seeds: { phase: string; y: number[][] }[] | undefined;
  let terminated: ScheilResult["terminated"] = "floor";

  // Coarse liquid descent: above the liquidus every step is "still all
  // liquid" — stride 4·ΔT with a light budget, then back up and refine at
  // ΔT once solid first appears, so the liquidus keeps ΔT resolution
  // without paying full price for the superheat range.
  let scheilStartK = tStart;
  {
    const stride = dT * 4;
    let prevAllLiquid = tStart;
    for (let tK = tStart; tK >= tFloor; tK -= stride) {
      const probe = pointEquilibrium(db, liquidX, tK, {
        ...(opts?.suspend ? { suspend: opts.suspend } : {}),
        ...(seeds ? { seeds } : {}),
        ...(tK === tStart ? {} : { samplesPerPhase: 700, rounds: 5, zoomSamples: 250 }),
      });
      if (!probe.feasible) continue;
      seeds = probe.phases.map((p) => ({ phase: p.phase, y: p.siteFractions }));
      const solid = probe.phases.some((p) => p.phase !== liquidName);
      if (solid) {
        scheilStartK = prevAllLiquid - dT;
        break;
      }
      steps.push({ tK, fLiquid: 1, solids: {}, liquidX: { ...liquidX } });
      opts?.onProgress?.(steps[steps.length - 1]!);
      prevAllLiquid = tK;
      scheilStartK = tK - stride;
    }
  }

  for (let tK = scheilStartK; tK >= tFloor; tK -= dT) {
    const eq = pointEquilibrium(db, liquidX, tK, {
      ...(opts?.suspend ? { suspend: opts.suspend } : {}),
      ...(seeds ? { seeds } : {}),
      // Scheil steps are small perturbations of the previous state — a
      // reduced budget converges once warm-started.
      ...(steps.length === 0 && liquidusK === undefined
        ? {}
        : { samplesPerPhase: 900, rounds: 7, zoomSamples: 350 }),
    });
    if (!eq.feasible) continue;
    seeds = eq.phases.map((p) => ({ phase: p.phase, y: p.siteFractions }));

    const liquid = eq.phases.find((p) => p.phase === liquidName);
    const solidsHere = eq.phases.filter((p) => p.phase !== liquidName);

    if (solidsHere.length === 0) {
      // Fully liquid at this temperature — keep cooling.
      steps.push({ tK, fLiquid, solids: { ...solidTotals }, liquidX: { ...liquidX } });
      opts?.onProgress?.(steps[steps.length - 1]!);
      continue;
    }
    if (liquidusK === undefined) liquidusK = tK;

    if (!liquid) {
      // Remaining liquid solidifies entirely at this step (eutectic-like
      // finish at ΔT resolution): distribute it over the solid phases.
      for (const p of solidsHere) {
        solidTotals[p.phase] = (solidTotals[p.phase] ?? 0) + fLiquid * p.fraction;
      }
      fLiquid = 0;
      solidusK = tK;
      terminated = "solidified";
      steps.push({ tK, fLiquid, solids: { ...solidTotals }, liquidX: { ...liquidX } });
      opts?.onProgress?.(steps[steps.length - 1]!);
      break;
    }

    // Freeze the solids formed from the current liquid; the liquid phase's
    // equilibrium composition becomes the next step's system.
    for (const p of solidsHere) {
      solidTotals[p.phase] = (solidTotals[p.phase] ?? 0) + fLiquid * p.fraction;
    }
    fLiquid *= liquid.fraction;
    liquidX = { ...liquid.composition };
    // Seeds from this step describe the OLD composition's phases; the
    // liquid seed is still an excellent warm start for the new system.
    steps.push({ tK, fLiquid, solids: { ...solidTotals }, liquidX: { ...liquidX } });
    opts?.onProgress?.(steps[steps.length - 1]!);

    if (fLiquid < cutoff) {
      // Below the cutoff the Scheil construction is over: the residual
      // liquid is assigned to the last-formed solid set proportionally.
      const lastFractionSum = solidsHere.reduce((s, p) => s + p.fraction, 0);
      for (const p of solidsHere) {
        solidTotals[p.phase] =
          (solidTotals[p.phase] ?? 0) + fLiquid * (p.fraction / (lastFractionSum || 1));
      }
      fLiquid = 0;
      solidusK = tK;
      terminated = "solidified";
      break;
    }
  }

  const hasLiquidPhase = [...db.phases.keys()].includes(liquidName);
  if (!hasLiquidPhase) terminated = "no-liquid-phase";
  // Normalize totals against accumulated rounding.
  const total = Object.values(solidTotals).reduce((s, v) => s + v, 0) + fLiquid;
  if (total > 0) {
    for (const k of Object.keys(solidTotals)) solidTotals[k]! /= total;
  }
  const out: ScheilResult = { steps, solidTotals, terminated };
  if (liquidusK !== undefined) out.liquidusK = liquidusK;
  if (solidusK !== undefined) out.solidusK = solidusK;
  const kou = kouIndex(steps);
  if (kou !== undefined) out.kouIndexK = kou;
  return out;
}
