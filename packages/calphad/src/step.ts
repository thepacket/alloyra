import { pointEquilibrium, type MulticomponentResult } from "./multicomponent.ts";
import type { TdbDatabase } from "./tdb.ts";

/**
 * Temperature stepping (B-502): equilibrium phase fractions along a
 * temperature axis — the CALPHAD category's bread-and-butter property
 * diagram. Each step warm-starts from the previous step's winning
 * constitutions, so the sweep costs far less than independent solves and
 * tracks phase boundaries continuously.
 */

export interface StepPoint {
  tK: number;
  result: MulticomponentResult;
}

export function stepTemperature(
  db: TdbDatabase,
  composition: Record<string, number>,
  tKs: number[],
  opts?: {
    suspend?: (phaseName: string) => boolean;
    onProgress?: (done: number, total: number, tK: number) => void;
  },
): StepPoint[] {
  const out: StepPoint[] = [];
  let seeds: { phase: string; y: number[][] }[] | undefined;
  tKs.forEach((tK, i) => {
    const result = pointEquilibrium(db, composition, tK, {
      ...(opts?.suspend ? { suspend: opts.suspend } : {}),
      ...(seeds ? { seeds } : {}),
      // First point gets the full budget; warm-started steps need less.
      ...(i === 0 ? {} : { samplesPerPhase: 1200, rounds: 8, zoomSamples: 400 }),
    });
    out.push({ tK, result });
    if (result.feasible && result.phases.length > 0) {
      seeds = result.phases.map((p) => ({ phase: p.phase, y: p.siteFractions }));
    }
    opts?.onProgress?.(i + 1, tKs.length, tK);
  });
  return out;
}
