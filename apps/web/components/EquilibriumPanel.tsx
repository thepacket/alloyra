"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Composition,
  EquilibriumResult,
  ProviderCapabilities,
} from "@alloyra/core";
import { calphadProvider } from "../lib/calphad";
import { ENGINE_DBS, baseHint } from "../lib/engine";
import type { EngineResponse } from "../workers/calphadEngine.worker";
import { LineChart } from "./charts/Line";

type EngineResult = NonNullable<Extract<EngineResponse, { kind: "point" }>["result"]>;
type SweepPointUi = { tC: number; phases: { phase: string; fraction: number }[] };

/**
 * Phase-equilibrium panel (M3): the studio's window onto the CALPHAD
 * bridge. Degrades honestly — offline and database-gap states say exactly
 * what is missing and how to fix it, and no number appears without its
 * database named.
 */

export function EquilibriumPanel({ comp }: { comp: Composition }) {
  const [caps, setCaps] = useState<ProviderCapabilities | null>(null);
  const [dbId, setDbId] = useState("");
  const [autoNote, setAutoNote] = useState("");
  const [tempC, setTempC] = useState(500);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<EquilibriumResult | null>(null);
  const [error, setError] = useState("");
  // In-browser engine (B-501, experimental) — runs in a worker off the
  // main thread; cross-checked against the hosted result when comparable.
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineElapsed, setEngineElapsed] = useState(0);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [engineError, setEngineError] = useState("");
  const [engineKey, setEngineKey] = useState("");
  const [hostedKey, setHostedKey] = useState("");
  const [engineDbId, setEngineDbId] = useState(ENGINE_DBS[0]!);
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

  const refresh = () => {
    setCaps(null);
    calphadProvider.capabilities().then(setCaps);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const compElements = useMemo(
    () =>
      Object.entries(comp)
        .filter(([, v]) => (v as number) > 0)
        .map(([el]) => el.toUpperCase()),
    [comp],
  );

  const coverage = (systemElements: string[]) =>
    compElements.filter((el) => !systemElements.includes(el));
  const covers = (systemElements: string[]) => coverage(systemElements).length === 0;

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

  // The engine runs with the hosted panel's database when the service is
  // up (shared selection, shared coverage check); offline it stands alone
  // with its own catalog, auto-picked by base metal.
  const engineDb = caps?.available ? dbId : engineDbId;
  useEffect(() => {
    if (caps?.available) return;
    const pick = ENGINE_DBS.find((id) => baseHint(id) === dominant);
    if (pick) setEngineDbId(pick);
  }, [caps, dominant]);

  // Database auto-selection: keep the user's choice while it covers the
  // composition; otherwise pick a covering database (base-metal match
  // first, then the most specific one) and say why. Never silently leave
  // "Run" disabled on an incompatible default.
  useEffect(() => {
    if (!caps?.available || compElements.length === 0) return;
    const current = caps.systems.find((s) => s.id === dbId);
    if (current && covers(current.elements)) return;
    const covering = caps.systems.filter((s) => covers(s.elements));
    if (covering.length === 0) {
      if (!current && caps.systems[0]) setDbId(caps.systems[0].id);
      setAutoNote("");
      return;
    }
    const pick =
      covering.find((s) => baseHint(s.id) === dominant) ??
      [...covering].sort((a, b) => a.elements.length - b.elements.length)[0]!;
    setDbId(pick.id);
    setAutoNote(
      `Auto-selected ${pick.id} — covers all ${compElements.length} elements of this composition` +
        (baseHint(pick.id) === dominant ? ` (base ${dominant} match).` : "."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps, compElements.join(","), dominant]);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await calphadProvider.equilibrium({ databaseId: dbId, compositionWt: comp, tempC }),
      );
      setHostedKey(`${dbId}|${tempC}`);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : String(e)} — if the service was idle, it may have been waking up and compiling models; running again usually succeeds within a few seconds.`,
      );
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!engineRunning) return;
    const t0 = Date.now();
    setEngineElapsed(0);
    const iv = setInterval(() => setEngineElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [engineRunning]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const runEngine = () => {
    if (typeof Worker === "undefined") {
      setEngineError("This browser does not support Web Workers.");
      return;
    }
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/calphadEngine.worker.ts", import.meta.url),
      );
    }
    const worker = workerRef.current;
    const id = ++reqIdRef.current;
    setEngineRunning(true);
    setEngineError("");
    setEngineResult(null);
    const key = `${engineDb}|${tempC}`;
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      if (ev.data.id !== id || ev.data.kind !== "point") return;
      worker.removeEventListener("message", onMessage);
      setEngineRunning(false);
      if (ev.data.ok && ev.data.result) {
        setEngineResult(ev.data.result);
        setEngineKey(key);
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
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/calphadEngine.worker.ts", import.meta.url),
      );
    }
    const worker = workerRef.current;
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
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/calphadEngine.worker.ts", import.meta.url),
      );
    }
    const worker = workerRef.current;
    const id = ++reqIdRef.current;
    setScheilRunning(true);
    setScheilError("");
    setScheilPoints([]);
    setScheilResult(null);
    setScheilDb(engineDb);
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

  // Cross-check: comparable only when both results came from the same
  // database + temperature. Reports the honest disagreement, not a verdict.
  const crossCheck = useMemo(() => {
    if (!result || !engineResult || engineKey === "" || engineKey !== hostedKey) return null;
    const hosted = new Map(result.phases.map((p) => [p.phase, p.fraction]));
    const engine = new Map(engineResult.phases.map((p) => [p.phase, p.fraction]));
    const names = new Set([...hosted.keys(), ...engine.keys()]);
    let maxDelta = 0;
    let samePhaseSet = true;
    for (const n of names) {
      const a = hosted.get(n) ?? 0;
      const b = engine.get(n) ?? 0;
      if (!hosted.has(n) || !engine.has(n)) {
        if (Math.max(a, b) > 0.005) samePhaseSet = false;
      }
      maxDelta = Math.max(maxDelta, Math.abs(a - b));
    }
    return { samePhaseSet, maxDelta };
  }, [result, engineResult, engineKey, hostedKey]);

  const selected = caps?.systems.find((s) => s.id === dbId);
  const missing = selected ? coverage(selected.elements) : [];

  return (
    <div className="calc-card eq-card">
      <div className="calc-top">
        <span className="calc-label">
          Phase equilibrium{" "}
          {caps === null ? (
            <span className="prov estimated">CHECKING…</span>
          ) : caps.available ? (
            <span className="prov computed">COMPUTED</span>
          ) : (
            <span className="prov estimated">SERVICE OFFLINE</span>
          )}
        </span>
        <button type="button" className="mini" onClick={refresh}>
          {caps === null ? "Checking…" : "Retry"}
        </button>
      </div>

      {caps === null && <div className="calc-src">Checking for a CALPHAD bridge…</div>}

      {caps !== null && !caps.available && (
        <div className="eq-offline">
          <div className="eq-offline-title">Phase calculation unavailable</div>
          <div className="calc-src">
            {caps.reason === "request failed"
              ? "The calculation service isn't reachable right now — it may be waking up. Hit Retry in a few seconds. Everything else in the studio works without it."
              : caps.reason}
          </div>
          <details className="eq-howto">
            <summary>Developers: run a local service instead</summary>
            <div className="calc-src mono">
              cd services/calphad && .venv/bin/uvicorn main:app --port 8791
            </div>
            <div className="calc-src">
              When the app runs on localhost it prefers a local bridge at
              127.0.0.1:8791; deployed visitors use the hosted service
              automatically and install nothing.
            </div>
          </details>
        </div>
      )}

      {caps?.available && (
        <>
          <div className="eq-controls">
            <label>Database
              <select
                className="hdr-select"
                value={dbId}
                onChange={(e) => {
                  setDbId(e.target.value);
                  setAutoNote("");
                }}
              >
                {caps.systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} ({s.elements.join("-")})
                  </option>
                ))}
              </select>
            </label>
            <label>T (°C)
              <input className="el-num mono" inputMode="decimal" value={tempC} aria-label="Equilibrium temperature, °C"
                onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setTempC(n); }} />
            </label>
            <button type="button" className="btn" onClick={run} disabled={running || missing.length > 0}>
              {running ? `Computing… ${elapsed}s` : "Run equilibrium"}
            </button>
          </div>
          {autoNote && <div className="calc-src">{autoNote} Your own selection is kept as long as it stays compatible.</div>}
          {running && (
            <div className="calc-src" role="status">
              Computing equilibrium at {tempC} °C against {selected?.id}… The
              first calculation for a new alloy system compiles thermodynamic
              models (up to ~60 s on the hosted service, longer if it was
              asleep); repeat calculations answer in about a second.
            </div>
          )}
          {missing.length > 0 && (
            <div className="calc-warn">
              {selected?.id} does not cover {missing.join(", ")}.{" "}
              {(() => {
                const covering = caps.systems.filter((s) => covers(s.elements));
                return covering.length > 0
                  ? `A covering database is available: ${covering.map((s) => s.id).join(", ")}.`
                  : "No loaded database covers this composition — drop a covering .tdb into the service.";
              })()}
            </div>
          )}
          {error && <div className="calc-warn">{error}</div>}
          {result && (
            <div className="eq-result">
              {result.phases.map((p) => (
                <div className="eq-phase" key={p.phase}>
                  <span className="mono eq-phase-name">{p.phase}</span>
                  <div className="eq-bar"><span style={{ width: `${(p.fraction * 100).toFixed(1)}%` }} /></div>
                  <span className="mono eq-frac">{(p.fraction * 100).toFixed(1)} %</span>
                </div>
              ))}
              <div className="calc-src">
                {result.source.citation} @ {result.tempC} °C — {result.note} {result.source.note}
              </div>
            </div>
          )}

        </>
      )}

          <div className="engine-block">
            <div className="engine-head">
              <span className="calc-label">
                In-browser engine <span className="prov engine-chip">EXPERIMENTAL · B-501</span>
              </span>
              <button
                type="button"
                className="mini"
                onClick={runEngine}
                disabled={engineRunning || (caps?.available === true && missing.length > 0)}
              >
                {engineRunning ? `Computing… ${engineElapsed}s` : "Run in-browser"}
              </button>
            </div>
            {!caps?.available && (
              <div className="eq-controls">
                <label>Database
                  <select
                    className="hdr-select"
                    value={engineDbId}
                    onChange={(e) => setEngineDbId(e.target.value)}
                    aria-label="In-browser engine database"
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
              </div>
            )}
            <div className="calc-src">
              Pure-TypeScript CALPHAD engine running in this tab (no server):
              same TDB, same phase suspensions. Validated against pycalphad on
              the shipped databases; still experimental — the hosted service
              remains authoritative when reachable — and this engine keeps
              working when it is not.
            </div>
            {engineRunning && (
              <div className="calc-src" role="status">
                Sampling constitutions and refining the tangent plane against{" "}
                {engineDb} — typically 1–10 s depending on the alloy system.
              </div>
            )}
            {engineError && <div className="calc-warn">{engineError}</div>}
            {engineResult && (
              <div className="eq-result">
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
                {crossCheck && (
                  <div className={crossCheck.samePhaseSet && crossCheck.maxDelta < 0.01 ? "engine-check ok" : "engine-check warn"}>
                    Cross-check vs hosted pycalphad ({engineDb} @ {tempC} °C):{" "}
                    {crossCheck.samePhaseSet
                      ? `same phase set, max phase-fraction difference ${(crossCheck.maxDelta * 100).toFixed(2)} %.`
                      : `PHASE SETS DIFFER — trust the hosted service and treat this engine result as a bug report.`}
                  </div>
                )}
                {!crossCheck && (
                  <div className="calc-src">
                    Run the hosted service at the same database and temperature
                    to cross-check this result.
                  </div>
                )}
              </div>
            )}

            <div className="sweep-panel">
              <div className="engine-head">
                <span className="calc-label">Property diagram — phase fractions vs T</span>
                <button
                  type="button"
                  className="mini"
                  onClick={runSweep}
                  disabled={sweepRunning || (caps?.available === true && missing.length > 0)}
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
                  disabled={scheilRunning || (caps?.available === true && missing.length > 0)}
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
          </div>
    </div>
  );
}
