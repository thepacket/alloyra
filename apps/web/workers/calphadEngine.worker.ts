import {
  parseTdb,
  pointEquilibrium,
  scheilSolidify,
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
    }
  | {
      id: number;
      kind: "scheil";
      dbId: string;
      tdbUrl: string;
      compositionWt: Record<string, number>;
      tStartC: number;
      dT: number;
    }
  | {
      id: number;
      kind: "map";
      dbId: string;
      tdbUrl: string;
      /** Base composition; `varyElement` is overridden per column and the
       *  balance element absorbs the difference. */
      compositionWt: Record<string, number>;
      balanceElement: string;
      varyElement: string;
      fromWt: number;
      toWt: number;
      nX: number;
      tMinC: number;
      tMaxC: number;
      nT: number;
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
  | { id: number; kind: "step-done"; ok: boolean; error?: string; ms?: number }
  | {
      id: number;
      kind: "scheil-progress";
      point: { tC: number; fractionSolid: number; liquidX: Record<string, number> };
    }
  | {
      id: number;
      kind: "scheil-done";
      ok: boolean;
      error?: string;
      result?: {
        liquidusC?: number;
        solidusC?: number;
        solidTotals: Record<string, number>;
        kouIndexK?: number;
        terminated: string;
        ms: number;
      };
    }
  | {
      id: number;
      kind: "map-column";
      ix: number;
      xWt: number;
      /** One entry per grid temperature, ascending tC; phases sorted.
       *  Empty array = infeasible at that cell. */
      cells: { tC: number; phases: string[] }[];
    }
  | {
      id: number;
      kind: "map-refine";
      ix: number;
      /** Bisection-localized phase boundaries within this column. */
      points: { xWt: number; tC: number; below: string[]; above: string[] }[];
    }
  | { id: number; kind: "map-done"; ok: boolean; error?: string; ms?: number };

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

    if (msg.kind === "scheil") {
      const t0 = performance.now();
      const r = scheilSolidify(db, x, {
        tStartK: msg.tStartC + 273.15,
        dT: msg.dT,
        suspend,
        onProgress: (step) => {
          self.postMessage({
            id: msg.id,
            kind: "scheil-progress",
            point: {
              tC: step.tK - 273.15,
              fractionSolid: 1 - step.fLiquid,
              liquidX: step.liquidX,
            },
          } satisfies EngineResponse);
        },
      });
      self.postMessage({
        id: msg.id,
        kind: "scheil-done",
        ok: true,
        result: {
          ...(r.liquidusK !== undefined ? { liquidusC: r.liquidusK - 273.15 } : {}),
          ...(r.solidusK !== undefined ? { solidusC: r.solidusK - 273.15 } : {}),
          ...(r.kouIndexK !== undefined ? { kouIndexK: r.kouIndexK } : {}),
          solidTotals: r.solidTotals,
          terminated: r.terminated,
          ms: Math.round(performance.now() - t0),
        },
      } satisfies EngineResponse);
      return;
    }

    if (msg.kind === "map") {
      // Isopleth (vertical section, B-503): coarse phase-set grid with
      // boundary refinement. Columns sweep the varied element; each column
      // is a warm-started descent in T at a LIGHT budget (the map needs
      // phase SETS, not tight fractions), then adjacent cells with
      // different sets get two T-bisections to localize the boundary to
      // ΔT/4. Everything streams so the map fills in live.
      const t0 = performance.now();
      // Phase SET of a result. Light budgets sometimes return the same
      // phase twice with near-identical compositions (numerical duplicates)
      // — collapse those; a same-named pair with genuinely different
      // compositions (a real miscibility gap, e.g. α+α′) is kept as "×2".
      const setOf = (r: ReturnType<typeof pointEquilibrium>): string[] => {
        if (!r.feasible) return [];
        const byName = new Map<string, Record<string, number>[]>();
        for (const p of r.phases) {
          if (p.fraction <= 0.005) continue;
          const arr = byName.get(p.phase) ?? [];
          arr.push(p.composition);
          byName.set(p.phase, arr);
        }
        const out: string[] = [];
        for (const [name, comps] of byName) {
          let gap = false;
          for (let i = 1; i < comps.length && !gap; i++) {
            for (const el of new Set([...Object.keys(comps[0]!), ...Object.keys(comps[i]!)])) {
              if (Math.abs((comps[0]![el] ?? 0) - (comps[i]![el] ?? 0)) > 0.05) {
                gap = true;
                break;
              }
            }
          }
          out.push(gap ? `${name}×2` : name);
        }
        return out.sort();
      };
      const sameSet = (a: string[], b: string[]) => a.join("+") === b.join("+");
      const xs = Array.from(
        { length: msg.nX },
        (_, i) => msg.fromWt + (i / Math.max(1, msg.nX - 1)) * (msg.toWt - msg.fromWt),
      );
      const tCs = Array.from(
        { length: msg.nT },
        (_, i) => msg.tMinC + (i / Math.max(1, msg.nT - 1)) * (msg.tMaxC - msg.tMinC),
      );
      const LIGHT = { samplesPerPhase: 600, rounds: 4, zoomSamples: 250 };
      const TOP = { samplesPerPhase: 1400, rounds: 8, zoomSamples: 450 };

      let prevColumnTopSeeds: { phase: string; y: number[][] }[] | undefined;
      for (let ix = 0; ix < xs.length; ix++) {
        const wt: Record<string, number> = { ...msg.compositionWt, [msg.varyElement]: xs[ix]! };
        // Composition keys arrive in element-symbol case ("Fe"); the balance
        // element may be named in any case — match case-insensitively.
        for (const k of Object.keys(wt)) {
          if (k.toUpperCase() === msg.balanceElement.toUpperCase()) delete wt[k];
        }
        const others = Object.values(wt).reduce((s, v) => s + v, 0);
        if (others >= 99.9) throw new Error(`Varying ${msg.varyElement} to ${xs[ix]} wt% leaves no room for the ${msg.balanceElement} balance.`);
        wt[msg.balanceElement] = 100 - others;
        const xMole = wtToMoleFractions(wt);
        checkCoverage(db, msg.dbId, xMole);

        let seeds = prevColumnTopSeeds;
        const cells: { tC: number; phases: string[]; seeds?: { phase: string; y: number[][] }[] }[] = [];
        // High T → low T for warm-start quality; report ascending later.
        for (let iT = tCs.length - 1; iT >= 0; iT--) {
          const r = pointEquilibrium(db, xMole, tCs[iT]! + 273.15, {
            suspend,
            ...(seeds ? { seeds } : {}),
            ...(iT === tCs.length - 1 ? TOP : LIGHT),
          });
          if (r.feasible && r.phases.length > 0) {
            seeds = r.phases.map((p) => ({ phase: p.phase, y: p.siteFractions }));
            if (iT === tCs.length - 1) prevColumnTopSeeds = seeds;
          }
          cells[iT] = { tC: tCs[iT]!, phases: setOf(r), ...(seeds ? { seeds } : {}) };
        }
        self.postMessage({
          id: msg.id,
          kind: "map-column",
          ix,
          xWt: xs[ix]!,
          cells: cells.map((c) => ({ tC: c.tC, phases: c.phases })),
        } satisfies EngineResponse);

        // Boundary refinement: two bisections per differing adjacent pair.
        const points: { xWt: number; tC: number; below: string[]; above: string[] }[] = [];
        for (let iT = 0; iT + 1 < cells.length; iT++) {
          const lower = cells[iT]!;
          const upper = cells[iT + 1]!;
          if (lower.phases.length === 0 || upper.phases.length === 0) continue;
          if (sameSet(lower.phases, upper.phases)) continue;
          let lo = lower.tC;
          let hi = upper.tC;
          for (let b = 0; b < 2; b++) {
            const mid = (lo + hi) / 2;
            const r = pointEquilibrium(db, xMole, mid + 273.15, {
              suspend,
              ...(lower.seeds ? { seeds: lower.seeds } : {}),
              ...LIGHT,
            });
            const s = setOf(r);
            if (s.length === 0) break;
            if (sameSet(s, lower.phases)) lo = mid;
            else hi = mid;
          }
          points.push({ xWt: xs[ix]!, tC: (lo + hi) / 2, below: lower.phases, above: upper.phases });
        }
        if (points.length > 0) {
          self.postMessage({ id: msg.id, kind: "map-refine", ix, points } satisfies EngineResponse);
        }
      }
      self.postMessage({
        id: msg.id,
        kind: "map-done",
        ok: true,
        ms: Math.round(performance.now() - t0),
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
        : msg.kind === "scheil"
          ? ({ id: msg.id, kind: "scheil-done", ok: false, error } satisfies EngineResponse)
          : msg.kind === "map"
            ? ({ id: msg.id, kind: "map-done", ok: false, error } satisfies EngineResponse)
            : ({ id: msg.id, kind: "step-done", ok: false, error } satisfies EngineResponse),
    );
  }
};
