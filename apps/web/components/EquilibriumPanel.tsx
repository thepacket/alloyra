"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Composition } from "@alloyra/core";
import { ENGINE_DBS, baseHint } from "../lib/engine";
import type { EngineResponse } from "../workers/calphadEngine.worker";
import { LineChart } from "./charts/Line";
import { IsoplethChart, type IsoplethBoundary } from "./charts/Isopleth";

type EngineResult = NonNullable<Extract<EngineResponse, { kind: "point" }>["result"]>;
type SweepPointUi = { tC: number; phases: { phase: string; fraction: number }[] };

/**
 * Phase-equilibrium panel. All computation is the in-browser CALPHAD
 * engine (B-501, cross-checked — docs/engine-validation.md): a worker in
 * THIS tab, nothing leaves the browser, no service to abuse or pay for.
 * The former hosted pycalphad bridge is retired from the product; the
 * pycalphad service under services/calphad remains as the offline
 * validation oracle and an optional self-host.
 */

export function EquilibriumPanel({
  comp,
  onRegisterRunAll,
}: {
  comp: Composition;
  /** Hands the parent a "queue every computation" trigger (Compute all). */
  onRegisterRunAll?: (fn: () => void) => void;
}) {
  const [tempC, setTempC] = useState(500);
  // One dedicated worker PER computation kind: point, sweep, Scheil, and
  // the isopleth map run on separate cores, so "Compute all" is the MAX of
  // the four runtimes, not the sum. Each worker parses the TDB once
  // (per-worker cache) — a few hundred ms, paid once per session.
  const workersRef = useRef<Map<string, Worker>>(new Map());
  const reqIdRef = useRef(0);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineElapsed, setEngineElapsed] = useState(0);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [engineError, setEngineError] = useState("");
  const [engineDbId, setEngineDbId] = useState(ENGINE_DBS[0]!);
  // Staleness keys (honesty): engine results are run-on-demand snapshots.
  // Each run records the inputs it was computed WITH; when the live inputs
  // drift, the result stays visible (before/after comparison is useful)
  // but is flagged stale instead of silently posing as current.
  const [engineRunKey, setEngineRunKey] = useState("");
  const [sweepRunKey, setSweepRunKey] = useState("");
  const [scheilRunKey, setScheilRunKey] = useState("");
  const [mapRunKey, setMapRunKey] = useState("");
  // Property diagram (B-502): T sweep streamed from the worker.
  const [sweepFrom, setSweepFrom] = useState(400);
  const [sweepTo, setSweepTo] = useState(1500);
  const [sweepStep, setSweepStep] = useState(100);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepProgress, setSweepProgress] = useState<{ done: number; total: number } | null>(null);
  const [sweepPoints, setSweepPoints] = useState<SweepPointUi[]>([]);
  const [sweepError, setSweepError] = useState("");
  const [sweepDb, setSweepDb] = useState("");
  // Scheil solidification (B-504).
  const [scheilStart, setScheilStart] = useState(1550);
  const [scheilDT, setScheilDT] = useState(5);
  const [scheilRunning, setScheilRunning] = useState(false);
  const [scheilPoints, setScheilPoints] = useState<
    { tC: number; fractionSolid: number; liquidX: Record<string, number> }[]
  >([]);
  const [scheilResult, setScheilResult] = useState<{
    liquidusC?: number;
    solidusC?: number;
    solidTotals: Record<string, number>;
    kouIndexK?: number;
    terminated: string;
    ms: number;
  } | null>(null);
  const [scheilError, setScheilError] = useState("");
  const [scheilDb, setScheilDb] = useState("");
  // Isopleth map (B-503): sampled phase-set grid vs composition & T.
  const [mapEl, setMapEl] = useState("");
  const [mapFrom, setMapFrom] = useState(0);
  const [mapTo, setMapTo] = useState(4);
  const [mapTMin, setMapTMin] = useState(600);
  const [mapTMax, setMapTMax] = useState(1500);
  const [mapNX, setMapNX] = useState(13);
  const [mapNT, setMapNT] = useState(19);
  const [mapRunning, setMapRunning] = useState(false);
  const [mapCols, setMapCols] = useState(0);
  const [mapData, setMapData] = useState<{
    xs: number[];
    tCs: number[];
    columns: (string[][] | undefined)[];
    boundaries: IsoplethBoundary[];
  } | null>(null);
  const [mapError, setMapError] = useState("");
  const [mapDb, setMapDb] = useState("");
  const [mapMs, setMapMs] = useState<number | null>(null);

  const dominant = useMemo(() => {
    let best: string | undefined;
    let bestV = -1;
    for (const [el, v] of Object.entries(comp)) {
      if ((v as number) > bestV) {
        bestV = v as number;
        best = el.toUpperCase();
      }
    }
    return best;
  }, [comp]);

  const compKey = useMemo(() => JSON.stringify(comp), [comp]);

  // Database auto-pick by base metal; the user's own selection stands
  // until the base changes. Coverage gaps surface as the worker's honest
  // per-run error ("<db> does not cover: X"), never a silent disable.
  const engineDb = engineDbId;

  const engineNowKey = `${compKey}|${engineDb}|${tempC}`;
  const sweepNowKey = `${compKey}|${engineDb}|${sweepFrom}|${sweepTo}|${sweepStep}`;
  const scheilNowKey = `${compKey}|${engineDb}|${scheilStart}|${scheilDT}`;
  const mapNowKey = `${compKey}|${engineDb}|${mapEl}|${mapFrom}|${mapTo}|${mapTMin}|${mapTMax}|${mapNX}|${mapNT}`;

  const StaleNote = ({ what }: { what: string }) => (
    <div className="stale-note" role="status">
      Inputs changed since this {what} was computed — it shows the PREVIOUS
      composition/settings. Run again to refresh.
    </div>
  );
  useEffect(() => {
    const pick = ENGINE_DBS.find((id) => baseHint(id) === dominant);
    if (pick) setEngineDbId(pick);
  }, [dominant]);

  useEffect(() => {
    if (!engineRunning) return;
    const t0 = Date.now();
    setEngineElapsed(0);
    const iv = setInterval(() => setEngineElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [engineRunning]);

  const getWorker = (kind: string): Worker => {
    let w = workersRef.current.get(kind);
    if (!w) {
      w = new Worker(new URL("../workers/calphadEngine.worker.ts", import.meta.url));
      workersRef.current.set(kind, w);
    }
    return w;
  };

  useEffect(
    () => () => {
      for (const w of workersRef.current.values()) w.terminate();
    },
    [],
  );

  const runEngine = () => {
    if (typeof Worker === "undefined") {
      setEngineError("This browser does not support Web Workers.");
      return;
    }
    const worker = getWorker("point");
    const id = ++reqIdRef.current;
    setEngineRunning(true);
    setEngineError("");
    setEngineResult(null);
    setEngineRunKey(engineNowKey);
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      if (ev.data.id !== id || ev.data.kind !== "point") return;
      worker.removeEventListener("message", onMessage);
      setEngineRunning(false);
      if (ev.data.ok && ev.data.result) {
        setEngineResult(ev.data.result);
      } else {
        setEngineError(ev.data.error ?? "Engine failed.");
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      id,
      kind: "point",
      dbId: engineDb,
      tdbUrl: `/tdb/${engineDb}.tdb`,
      compositionWt: comp,
      tempC,
    });
  };

  const runSweep = () => {
    if (typeof Worker === "undefined") {
      setSweepError("This browser does not support Web Workers.");
      return;
    }
    const worker = getWorker("step");
    const id = ++reqIdRef.current;
    const tempsC: number[] = [];
    const step = Math.max(10, sweepStep);
    for (let t = Math.min(sweepFrom, sweepTo); t <= Math.max(sweepFrom, sweepTo); t += step) {
      tempsC.push(t);
    }
    if (tempsC.length < 2 || tempsC.length > 60) {
      setSweepError("Choose a range giving between 2 and 60 temperature points.");
      return;
    }
    setSweepRunning(true);
    setSweepError("");
    setSweepPoints([]);
    setSweepProgress({ done: 0, total: tempsC.length });
    setSweepDb(engineDb);
    setSweepRunKey(sweepNowKey);
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      if (ev.data.id !== id) return;
      if (ev.data.kind === "step-progress") {
        setSweepProgress({ done: ev.data.done, total: ev.data.total });
        const point = ev.data.point;
        setSweepPoints((prev) => [...prev, point]);
        return;
      }
      if (ev.data.kind === "step-done") {
        worker.removeEventListener("message", onMessage);
        setSweepRunning(false);
        if (!ev.data.ok) setSweepError(ev.data.error ?? "Sweep failed.");
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      id,
      kind: "step",
      dbId: engineDb,
      tdbUrl: `/tdb/${engineDb}.tdb`,
      compositionWt: comp,
      tempsC,
    });
  };

  // Microsegregation (B-504 follow-through): solute enrichment in the
  // remaining liquid, x_L/x_0 per element vs fraction solid — the Scheil
  // segregation signature. The first streamed point's liquid IS the
  // nominal composition, so enrichment is self-referenced.
  const segregationSeries = useMemo(() => {
    const withSolid = scheilPoints.filter((p) => p.fractionSolid > 1e-6);
    if (withSolid.length < 2 || scheilPoints.length === 0) return [];
    const x0 = scheilPoints[0]!.liquidX;
    const PALETTE = [
      "var(--fam-cu)", "var(--fam-ni)", "var(--viol)", "var(--fam-al)",
      "var(--accent)", "var(--crit)", "var(--good)", "var(--warn)",
    ];
    const base = Object.entries(x0).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    return Object.keys(x0)
      .filter((el) => el !== base && (x0[el] ?? 0) > 5e-4)
      .map((el, i) => ({
        name: el,
        color: PALETTE[i % PALETTE.length]!,
        points: withSolid.map((p) => ({
          x: p.fractionSolid,
          y: (p.liquidX[el] ?? 0) / (x0[el] || 1),
        })),
      }));
  }, [scheilPoints]);

  const runScheil = () => {
    if (typeof Worker === "undefined") {
      setScheilError("This browser does not support Web Workers.");
      return;
    }
    const worker = getWorker("scheil");
    const id = ++reqIdRef.current;
    setScheilRunning(true);
    setScheilError("");
    setScheilPoints([]);
    setScheilResult(null);
    setScheilDb(engineDb);
    setScheilRunKey(scheilNowKey);
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      if (ev.data.id !== id) return;
      if (ev.data.kind === "scheil-progress") {
        const point = ev.data.point;
        setScheilPoints((prev) => [...prev, point]);
        return;
      }
      if (ev.data.kind === "scheil-done") {
        worker.removeEventListener("message", onMessage);
        setScheilRunning(false);
        if (ev.data.ok && ev.data.result) setScheilResult(ev.data.result);
        else setScheilError(ev.data.error ?? "Scheil simulation failed.");
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      id,
      kind: "scheil",
      dbId: engineDb,
      tdbUrl: `/tdb/${engineDb}.tdb`,
      compositionWt: comp,
      tStartC: scheilStart,
      dT: Math.max(1, scheilDT),
    });
  };

  // Isopleth vary-element candidates: everything present except the base.
  const mapCandidates = useMemo(
    () =>
      Object.entries(comp)
        .filter(([el, v]) => (v as number) > 0 && el.toUpperCase() !== dominant)
        .map(([el]) => el)
        .sort(),
    [comp, dominant],
  );
  useEffect(() => {
    if (mapCandidates.includes(mapEl)) return;
    const pick = [...mapCandidates].sort(
      (a, b) => ((comp as Record<string, number>)[b] ?? 0) - ((comp as Record<string, number>)[a] ?? 0),
    )[0];
    if (pick) {
      setMapEl(pick);
      const cur = (comp as Record<string, number>)[pick] ?? 1;
      setMapFrom(0);
      setMapTo(Math.max(1, Math.ceil(cur * 1.8)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCandidates.join(","), mapEl]);

  const runMap = () => {
    if (typeof Worker === "undefined") {
      setMapError("This browser does not support Web Workers.");
      return;
    }
    const nX = Math.max(4, Math.min(30, Math.round(mapNX)));
    const nT = Math.max(4, Math.min(40, Math.round(mapNT)));
    if (nX * nT > 900) {
      setMapError(`${nX}×${nT} = ${nX * nT} cells — keep the grid at or under 900 cells (the map refines boundaries on top of that).`);
      return;
    }
    if (!(mapTMin < mapTMax) || !(mapFrom < mapTo) || !mapEl) {
      setMapError("Check the ranges: the varied element and both ranges need lo < hi.");
      return;
    }
    const worker = getWorker("map");
    const id = ++reqIdRef.current;
    const xs = Array.from({ length: nX }, (_, i) => mapFrom + (i / (nX - 1)) * (mapTo - mapFrom));
    const tCs = Array.from({ length: nT }, (_, i) => mapTMin + (i / (nT - 1)) * (mapTMax - mapTMin));
    setMapRunning(true);
    setMapError("");
    setMapCols(0);
    setMapMs(null);
    setMapDb(engineDb);
    setMapRunKey(mapNowKey);
    setMapData({ xs, tCs, columns: Array.from({ length: nX }, () => undefined), boundaries: [] });
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      const d = ev.data;
      if (d.id !== id) return;
      if (d.kind === "map-column") {
        setMapCols(d.ix + 1);
        setMapData((m) => {
          if (!m) return m;
          const columns = [...m.columns];
          columns[d.ix] = d.cells.map((c) => c.phases);
          return { ...m, columns };
        });
        return;
      }
      if (d.kind === "map-refine") {
        setMapData((m) => (m ? { ...m, boundaries: [...m.boundaries, ...d.points] } : m));
        return;
      }
      if (d.kind === "map-done") {
        worker.removeEventListener("message", onMessage);
        setMapRunning(false);
        if (!d.ok) setMapError(d.error ?? "Isopleth mapping failed.");
        else if (d.ms !== undefined) setMapMs(d.ms);
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      id,
      kind: "map",
      dbId: engineDb,
      tdbUrl: `/tdb/${engineDb}.tdb`,
      compositionWt: comp,
      balanceElement: dominant ?? "",
      varyElement: mapEl,
      fromWt: mapFrom,
      toWt: mapTo,
      nX,
      tMinC: mapTMin,
      tMaxC: mapTMax,
      nT,
    });
  };

  // "Compute all": fire every engine computation for the current inputs.
  // Each kind has its own worker, so all four run IN PARALLEL on separate
  // cores — wall time is the slowest job (the isopleth map), not the sum.
  // Sections already running are left alone.
  const runAll = () => {
    if (!engineRunning) runEngine();
    if (!sweepRunning) runSweep();
    if (!scheilRunning) runScheil();
    if (!mapRunning && mapEl) runMap();
  };
  useEffect(() => {
    onRegisterRunAll?.(runAll);
  });

  // Property-diagram series: phases in order of appearance, stable colors,
  // absent-at-T rendered as zero so solvus crossings read as lines hitting
  // the axis. Trace phases (< 0.5 % everywhere) are dropped from the plot.
  const sweepSeries = useMemo(() => {
    const PALETTE = [
      "var(--fam-fe)", "var(--fam-cu)", "var(--viol)", "var(--fam-ni)",
      "var(--straw)", "var(--fam-al)", "var(--crit)", "var(--accent)",
      "var(--good)", "var(--warn)",
    ];
    const names: string[] = [];
    for (const pt of sweepPoints) {
      for (const p of pt.phases) if (!names.includes(p.phase)) names.push(p.phase);
    }
    return names
      .map((name, i) => ({
        name,
        color: PALETTE[i % PALETTE.length]!,
        points: sweepPoints
          .slice()
          .sort((a, b) => a.tC - b.tC)
          .map((pt) => ({
            x: pt.tC,
            y: pt.phases.find((p) => p.phase === name)?.fraction ?? 0,
          })),
      }))
      .filter((s2) => s2.points.some((p) => p.y > 0.005));
  }, [sweepPoints]);

  return (
    <div className="calc-card eq-card">
      <div className="calc-top">
        <span className="calc-label">
          Phase equilibrium <span className="prov computed">COMPUTED</span>{" "}
          <span
            className="prov engine-chip"
            title="52-equilibrium battery vs pycalphad across all 4 shipped databases — see docs/engine-validation.md in the repository"
          >
            IN-BROWSER · CROSS-CHECKED
          </span>
        </span>
      </div>

          <div className="engine-block">
            <div className="eq-controls">
              <label>Database
                <select
                  className="hdr-select"
                  value={engineDbId}
                  onChange={(e) => setEngineDbId(e.target.value)}
                  aria-label="Thermodynamic database"
                >
                  {ENGINE_DBS.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </label>
              <label>T (°C)
                <input className="el-num mono" inputMode="decimal" value={tempC} aria-label="Equilibrium temperature, °C"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setTempC(n); }} />
              </label>
              <button type="button" className="btn" onClick={runEngine} disabled={engineRunning}>
                {engineRunning ? `Computing… ${engineElapsed}s` : "Run equilibrium"}
              </button>
            </div>
            <div className="calc-src">
              Pure-TypeScript CALPHAD engine running in THIS tab — your
              composition never leaves the browser and there is no server
              behind this button. Cross-checked against pycalphad on a
              52-equilibrium battery over the dataset's mid-specs across all
              four shipped databases: 44 identical phase sets at ≈0 fraction
              difference, and every disagreement repriced and documented
              (docs/engine-validation.md) — two are exact energy
              degeneracies, the worst genuine engine miss is 50 J/mol-atom
              in a five-phase 500 °C assemblage, and in three Alloy-718
              cases the engine found DEEPER minima than the reference
              solver.
            </div>
            {engineRunning && (
              <div className="calc-src" role="status">
                Sampling constitutions and refining the tangent plane against{" "}
                {engineDb} — typically 1–5 s depending on the alloy system.
              </div>
            )}
            {engineError && <div className="calc-warn">{engineError}</div>}
            {engineResult && !engineRunning && engineRunKey !== engineNowKey && (
              <StaleNote what="equilibrium" />
            )}
            {engineResult && (
              <div className={`eq-result ${!engineRunning && engineRunKey !== engineNowKey ? "stale" : ""}`}>
                {engineResult.phases.map((p) => (
                  <div className="eq-phase" key={p.phase + p.fraction.toFixed(6)}>
                    <span className="mono eq-phase-name">{p.phase}</span>
                    <div className="eq-bar engine-bar">
                      <span style={{ width: `${(p.fraction * 100).toFixed(1)}%` }} />
                    </div>
                    <span className="mono eq-frac">{(p.fraction * 100).toFixed(1)} %</span>
                  </div>
                ))}
                <div className="calc-src mono engine-meta">
                  G = {engineResult.gPerMoleAtom.toFixed(1)} J/mol-atom ·{" "}
                  {engineResult.samples.toLocaleString()} sampled constitutions ·{" "}
                  {engineResult.rounds} refinement rounds · {engineResult.ms} ms
                </div>
                <details className="eq-howto">
                  <summary>Chemical potentials (SER reference)</summary>
                  <div className="calc-src mono">
                    {Object.entries(engineResult.chemicalPotentials)
                      .map(([el, mu]) => `μ(${el}) = ${mu.toFixed(0)} J/mol`)
                      .join(" · ")}
                  </div>
                </details>
              </div>
            )}

            <div className="sweep-panel">
              <div className="engine-head">
                <span className="calc-label">Property diagram — phase fractions vs T</span>
                <button
                  type="button"
                  className="mini"
                  onClick={runSweep}
                  disabled={sweepRunning}
                >
                  {sweepRunning && sweepProgress
                    ? `Computing ${sweepProgress.done}/${sweepProgress.total}…`
                    : "Compute sweep"}
                </button>
              </div>
              <div className="lmp-inputs">
                <label>From (°C)
                  <input className="el-num mono" inputMode="decimal" value={sweepFrom} aria-label="Sweep start temperature, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setSweepFrom(n); }} />
                </label>
                <label>To (°C)
                  <input className="el-num mono" inputMode="decimal" value={sweepTo} aria-label="Sweep end temperature, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setSweepTo(n); }} />
                </label>
                <label>Step (°C)
                  <input className="el-num mono" inputMode="decimal" value={sweepStep} aria-label="Sweep temperature step, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setSweepStep(n); }} />
                </label>
              </div>
              {sweepError && <div className="calc-warn">{sweepError}</div>}
              {sweepPoints.length > 0 && !sweepRunning && sweepRunKey !== sweepNowKey && (
                <StaleNote what="property diagram" />
              )}
              {sweepPoints.length > 0 && (
                <>
                  <LineChart
                    series={sweepSeries}
                    xLabel="T (°C)"
                    yLabel="equilibrium phase fraction"
                    yMin={0}
                    yMax={1}
                    height={300}
                    footnote={`EQUILIBRIUM fractions vs ${sweepDb} — each point is a full in-browser minimization${sweepRunning ? " (filling in live…)" : ""}. The manufactured microstructure depends on kinetics and process history: an equilibrium sigma field at low T does not mean sigma forms in service time. Phases under 0.5 % everywhere are omitted.`}
                  />
                </>
              )}
            </div>

            <div className="sweep-panel">
              <div className="engine-head">
                <span className="calc-label">Scheil solidification — fraction solid vs T</span>
                <button
                  type="button"
                  className="mini"
                  onClick={runScheil}
                  disabled={scheilRunning}
                >
                  {scheilRunning ? "Solidifying…" : "Run Scheil"}
                </button>
              </div>
              <div className="lmp-inputs">
                <label>Start (°C)
                  <input className="el-num mono" inputMode="decimal" value={scheilStart} aria-label="Scheil start temperature, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setScheilStart(n); }} />
                </label>
                <label>ΔT (°C)
                  <input className="el-num mono" inputMode="decimal" value={scheilDT} aria-label="Scheil temperature step, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setScheilDT(n); }} />
                </label>
              </div>
              {scheilError && <div className="calc-warn">{scheilError}</div>}
              {scheilPoints.length > 0 && !scheilRunning && scheilRunKey !== scheilNowKey && (
                <StaleNote what="Scheil result" />
              )}
              {scheilRunning && scheilPoints.length > 0 && (
                <div className="calc-src mono" role="status">
                  cooling… T = {scheilPoints[scheilPoints.length - 1]!.tC.toFixed(0)} °C ·
                  fraction solid {(scheilPoints[scheilPoints.length - 1]!.fractionSolid * 100).toFixed(1)} %
                </div>
              )}
              {scheilPoints.some((p) => p.fractionSolid > 0) && (
                <LineChart
                  series={[{
                    name: "fraction solid",
                    color: "var(--straw)",
                    points: (() => {
                      const liqTc = Math.max(...scheilPoints.filter((p) => p.fractionSolid > 0).map((p) => p.tC));
                      return scheilPoints
                        .filter((p) => p.tC <= liqTc + 25)
                        .map((p) => ({ x: p.tC, y: p.fractionSolid }));
                    })(),
                  }]}
                  xLabel="T (°C)"
                  yLabel="fraction solid (Scheil)"
                  yMin={0}
                  yMax={1}
                  height={260}
                  footnote={`Scheil-Gulliver vs ${scheilDb}: complete liquid mixing, NO diffusion in the solid — the segregation-limited bound. Fast-diffusing interstitials (C, N) violate the no-back-diffusion assumption, so real alloys finish between this curve and lever-rule equilibrium.`}
                />
              )}
              {scheilResult && (
                <div className="eq-result">
                  <div className="calc-src mono engine-meta">
                    {scheilResult.liquidusC !== undefined ? `liquidus ≈ ${scheilResult.liquidusC.toFixed(0)} °C` : "no solid formed above the floor"}
                    {scheilResult.solidusC !== undefined ? ` · Scheil solidus ≈ ${scheilResult.solidusC.toFixed(0)} °C` : ""}
                    {scheilResult.liquidusC !== undefined && scheilResult.solidusC !== undefined
                      ? ` · freezing range ≈ ${(scheilResult.liquidusC - scheilResult.solidusC).toFixed(0)} K`
                      : ""}
                    {scheilResult.kouIndexK !== undefined
                      ? ` · Kou hot-cracking index ≈ ${scheilResult.kouIndexK.toFixed(0)} K`
                      : ""}
                    {` · ${scheilResult.ms} ms`}
                  </div>
                  {Object.entries(scheilResult.solidTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([phase, fraction]) => (
                      <div className="eq-phase" key={phase}>
                        <span className="mono eq-phase-name">{phase}</span>
                        <div className="eq-bar engine-bar"><span style={{ width: `${(fraction * 100).toFixed(1)}%` }} /></div>
                        <span className="mono eq-frac">{(fraction * 100).toFixed(1)} %</span>
                      </div>
                    ))}
                  {scheilResult.kouIndexK !== undefined && (
                    <div className="calc-src">
                      Kou index = max |dT/d√fs| over √fs 0.90–0.99 (Kou, Acta
                      Mater. 88 (2015) 366): steeper terminal solidification is
                      more hot-cracking-susceptible. Compare candidates with
                      it — it is not an absolute pass/fail.
                    </div>
                  )}
                </div>
              )}
              {segregationSeries.length > 0 && (
                <LineChart
                  series={segregationSeries}
                  xLabel="fraction solid"
                  yLabel="liquid enrichment x_L / x_0"
                  height={240}
                  footnote="Scheil microsegregation: solute enrichment of the remaining liquid as solidification proceeds. Ratios > 1 mean the element piles up in the last liquid (interdendritic regions, weld centerlines) — where Laves, sigma, and low-melting films nucleate. No back-diffusion assumed."
                />
              )}
            </div>

            <div className="sweep-panel">
              <div className="engine-head">
                <span className="calc-label">
                  Isopleth — phase-set map vs composition &amp; T{" "}
                  <span className="prov engine-chip">SAMPLED · B-503</span>
                </span>
                <button
                  type="button"
                  className="mini"
                  onClick={runMap}
                  disabled={mapRunning || !mapEl}
                >
                  {mapRunning ? `Column ${mapCols}/${mapData?.xs.length ?? 0}…` : "Compute map"}
                </button>
              </div>
              <div className="lmp-inputs">
                <label>Vary
                  <select
                    className="hdr-select"
                    value={mapEl}
                    aria-label="Element varied along the x axis"
                    onChange={(e) => {
                      const el = e.target.value;
                      setMapEl(el);
                      const cur = (comp as Record<string, number>)[el] ?? 1;
                      setMapFrom(0);
                      setMapTo(Math.max(1, Math.ceil(cur * 1.8)));
                    }}
                  >
                    {mapCandidates.map((el) => (
                      <option key={el} value={el}>{el}</option>
                    ))}
                  </select>
                </label>
                <label>From (wt%)
                  <input className="el-num mono" inputMode="decimal" value={mapFrom} aria-label="Vary-element lower bound, wt%"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapFrom(n); }} />
                </label>
                <label>To (wt%)
                  <input className="el-num mono" inputMode="decimal" value={mapTo} aria-label="Vary-element upper bound, wt%"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapTo(n); }} />
                </label>
                <label>T min (°C)
                  <input className="el-num mono" inputMode="decimal" value={mapTMin} aria-label="Map minimum temperature, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapTMin(n); }} />
                </label>
                <label>T max (°C)
                  <input className="el-num mono" inputMode="decimal" value={mapTMax} aria-label="Map maximum temperature, °C"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapTMax(n); }} />
                </label>
                <label>Columns
                  <input className="el-num mono" inputMode="numeric" value={mapNX} aria-label="Composition grid columns"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapNX(n); }} />
                </label>
                <label>Rows
                  <input className="el-num mono" inputMode="numeric" value={mapNT} aria-label="Temperature grid rows"
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setMapNT(n); }} />
                </label>
              </div>
              <div className="calc-src">
                Coarse-grid design: every cell is an independent light-budget
                minimization ({mapNX}×{mapNT} = {Math.round(mapNX * mapNT)}{" "}
                cells, warm-started down each column), then boundaries between
                differing cells are bisected to ΔT/4. Budget a minute or
                three: an 8-component steel runs ~0.3–1.5 s per cell (simpler
                systems are faster). The map fills in column by column and the
                rest of the studio stays responsive.
              </div>
              {mapError && <div className="calc-warn">{mapError}</div>}
              {mapData && mapData.columns.some((c) => c !== undefined) && !mapRunning && mapRunKey !== mapNowKey && (
                <StaleNote what="isopleth map" />
              )}
              {mapRunning && mapCols === 0 && (
                <div className="calc-src" role="status">Compiling the first column (largest budget)…</div>
              )}
              {mapData && mapData.columns.some((c) => c !== undefined) && (
                <IsoplethChart
                  xs={mapData.xs}
                  tCs={mapData.tCs}
                  columns={mapData.columns}
                  boundaries={mapData.boundaries}
                  xLabel={`${mapEl} (wt%, balance ${dominant ?? "?"} absorbs)`}
                  footnote={`SAMPLED vertical section vs ${mapDb}: phase SETS at grid resolution, not computed phase boundaries — a region narrower than one cell can be missed, and light budgets can misread a near-degenerate cell (verify any surprising cell with a full point equilibrium above). Dots mark T-bisected set changes (±${(((mapData.tCs[1] ?? 0) - (mapData.tCs[0] ?? 0)) / 8).toFixed(0)} °C). Phases under 0.5 % are ignored. Equilibrium only — no kinetics.${mapMs !== null ? ` Computed in ${(mapMs / 1000).toFixed(0)} s.` : ""}`}
                />
              )}
            </div>
          </div>
    </div>
  );
}
