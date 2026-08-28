import {
  parseTdb,
  pointEquilibrium,
  wtToMoleFractions,
  type TdbDatabase,
} from "@alloyra/calphad";

/**
 * In-browser CALPHAD engine worker (B-501/B-502): downloads the same
 * license-vetted TDB the hosted service uses (served from /tdb/, hash-
 * synced by test), parses it once per session, and solves point equilibria
 * and temperature sweeps off the main thread. Sweeps stream each computed
 * point back so the property diagram fills in live.
 */

// Same auxiliary-phase suspension as the hosted service (main.py).
const AUX_PHASE_RE = /^(GP_|CL_)|^BCC_DISL$/;
const suspend = (name: string) => AUX_PHASE_RE.test(name);

export type EngineRequest =
  | {
      id: number;
      kind: "point";
      dbId: string;
      tdbUrl: string;
      compositionWt: Record<string, number>;
      tempC: number;
    }
  | {
      id: number;
      kind: "step";
      dbId: string;
      tdbUrl: string;
      compositionWt: Record<string, number>;
      tempsC: number[];
    };

export interface EnginePhase {
  phase: string;
  fraction: number;
  composition: Record<string, number>;
}

export type EngineResponse =
  | {
      id: number;
      kind: "point";
      ok: boolean;
      error?: string;
      result?: {
        phases: EnginePhase[];
        gPerMoleAtom: number;
        chemicalPotentials: Record<string, number>;
        rounds: number;
        samples: number;
        ms: number;
      };
    }
  | {
      id: number;
      kind: "step-progress";
      done: number;
      total: number;
      point: { tC: number; phases: { phase: string; fraction: number }[] };
    }
  | { id: number; kind: "step-done"; ok: boolean; error?: string; ms?: number };

const dbCache = new Map<string, TdbDatabase>();

async function loadDb(dbId: string, tdbUrl: string): Promise<TdbDatabase> {
  let db = dbCache.get(dbId);
  if (!db) {
    const res = await fetch(tdbUrl);
    if (!res.ok) throw new Error(`TDB download failed (HTTP ${res.status}) for ${tdbUrl}`);
    db = parseTdb(await res.text());
    dbCache.set(dbId, db);
  }
  return db;
}

function checkCoverage(db: TdbDatabase, dbId: string, x: Record<string, number>): void {
  const missing = Object.keys(x).filter((e) => !db.elements.includes(e));
  if (missing.length > 0) {
    throw new Error(`${dbId} does not cover: ${missing.join(", ")}.`);
  }
}

self.onmessage = async (ev: MessageEvent<EngineRequest>) => {
  const msg = ev.data;
  try {
    const db = await loadDb(msg.dbId, msg.tdbUrl);
    const x = wtToMoleFractions(msg.compositionWt);
    checkCoverage(db, msg.dbId, x);

    if (msg.kind === "point") {
      const t0 = performance.now();
      const r = pointEquilibrium(db, x, msg.tempC + 273.15, { suspend });
      if (!r.feasible) {
        throw new Error("The engine could not bracket this composition — infeasible sampling hull.");
      }
      self.postMessage({
        id: msg.id,
        kind: "point",
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
      } satisfies EngineResponse);
      return;
    }

    // Temperature sweep: manual warm-started loop (mirrors stepTemperature)
    // so each point streams to the UI before the next one computes.
    const t0 = performance.now();
    const tKs = msg.tempsC.map((t) => t + 273.15);
    let seeds: { phase: string; y: number[][] }[] | undefined;
    let done = 0;
    for (let i = 0; i < tKs.length; i++) {
      const r = pointEquilibrium(db, x, tKs[i]!, {
        suspend,
        ...(seeds ? { seeds } : {}),
        // First point gets the full default budget; warm-started steps need less.
        ...(i === 0 ? {} : { samplesPerPhase: 1200, rounds: 8, zoomSamples: 400 }),
      });
      if (r.feasible && r.phases.length > 0) {
        seeds = r.phases.map((p) => ({ phase: p.phase, y: p.siteFractions }));
      }
      done++;
      self.postMessage({
        id: msg.id,
        kind: "step-progress",
        done,
        total: tKs.length,
        point: {
          tC: msg.tempsC[i]!,
          phases: r.phases.map((p) => ({ phase: p.phase, fraction: p.fraction })),
        },
      } satisfies EngineResponse);
    }
    self.postMessage({
      id: msg.id,
      kind: "step-done",
      ok: true,
      ms: Math.round(performance.now() - t0),
    } satisfies EngineResponse);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    self.postMessage(
      msg.kind === "point"
        ? ({ id: msg.id, kind: "point", ok: false, error } satisfies EngineResponse)
        : ({ id: msg.id, kind: "step-done", ok: false, error } satisfies EngineResponse),
    );
  }
};
