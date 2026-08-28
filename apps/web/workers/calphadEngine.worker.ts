import {
  parseTdb,
  pointEquilibrium,
  wtToMoleFractions,
  type TdbDatabase,
} from "@alloyra/calphad";

/**
 * In-browser CALPHAD engine worker (B-501): downloads the same
 * license-vetted TDB the hosted service uses (served from /tdb/, hash-
 * synced by test), parses it once per session, and solves multicomponent
 * point equilibria off the main thread. Experimental — results are
 * cross-checked against the hosted pycalphad service in the UI.
 */

// Same auxiliary-phase suspension as the hosted service (main.py).
const AUX_PHASE_RE = /^(GP_|CL_)|^BCC_DISL$/;

export interface EngineRequest {
  id: number;
  dbId: string;
  tdbUrl: string;
  compositionWt: Record<string, number>;
  tempC: number;
}

export interface EngineResponse {
  id: number;
  ok: boolean;
  error?: string;
  result?: {
    phases: { phase: string; fraction: number; composition: Record<string, number> }[];
    gPerMoleAtom: number;
    chemicalPotentials: Record<string, number>;
    rounds: number;
    samples: number;
    ms: number;
  };
}

const dbCache = new Map<string, TdbDatabase>();

self.onmessage = async (ev: MessageEvent<EngineRequest>) => {
  const { id, dbId, tdbUrl, compositionWt, tempC } = ev.data;
  try {
    let db = dbCache.get(dbId);
    if (!db) {
      const res = await fetch(tdbUrl);
      if (!res.ok) throw new Error(`TDB download failed (HTTP ${res.status}) for ${tdbUrl}`);
      db = parseTdb(await res.text());
      dbCache.set(dbId, db);
    }
    const x = wtToMoleFractions(compositionWt);
    const missing = Object.keys(x).filter((e) => !db.elements.includes(e));
    if (missing.length > 0) {
      throw new Error(`${dbId} does not cover: ${missing.join(", ")}.`);
    }
    const t0 = performance.now();
    const r = pointEquilibrium(db, x, tempC + 273.15, {
      suspend: (name) => AUX_PHASE_RE.test(name),
    });
    if (!r.feasible) {
      throw new Error("The engine could not bracket this composition — infeasible sampling hull.");
    }
    const response: EngineResponse = {
      id,
      ok: true,
      result: {
        phases: r.phases.map((p) => ({
          phase: p.phase,
          fraction: p.fraction,
          composition: p.composition,
        })),
        gPerMoleAtom: r.gPerMoleAtom,
        chemicalPotentials: r.chemicalPotentials,
        rounds: r.rounds,
        samples: r.samples,
        ms: Math.round(performance.now() - t0),
      },
    };
    self.postMessage(response);
  } catch (e) {
    self.postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    } satisfies EngineResponse);
  }
};
