"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Composition,
  EquilibriumResult,
  ProviderCapabilities,
} from "@alloyra/core";
import { calphadProvider } from "../lib/calphad";
import type { EngineResponse } from "../workers/calphadEngine.worker";

type EngineResult = NonNullable<EngineResponse["result"]>;

/**
 * Phase-equilibrium panel (M3): the studio's window onto the CALPHAD
 * bridge. Degrades honestly — offline and database-gap states say exactly
 * what is missing and how to fix it, and no number appears without its
 * database named.
 */
/** Base-metal hint from a database id (mc_fe → FE). */
function baseHint(id: string): string | undefined {
  const m = /(?:^|[_-])(fe|ni|al)(?:[_.-]|$)/i.exec(id);
  if (m) return m[1]!.toUpperCase();
  if (/solder/i.test(id)) return "SN";
  return undefined;
}

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
    const key = `${dbId}|${tempC}`;
    const onMessage = (ev: MessageEvent<EngineResponse>) => {
      if (ev.data.id !== id) return;
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
      dbId,
      tdbUrl: `/tdb/${dbId}.tdb`,
      compositionWt: comp,
      tempC,
    });
  };

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

          <div className="engine-block">
            <div className="engine-head">
              <span className="calc-label">
                In-browser engine <span className="prov engine-chip">EXPERIMENTAL · B-501</span>
              </span>
              <button
                type="button"
                className="mini"
                onClick={runEngine}
                disabled={engineRunning || missing.length > 0}
              >
                {engineRunning ? `Computing… ${engineElapsed}s` : "Run in-browser"}
              </button>
            </div>
            <div className="calc-src">
              Pure-TypeScript CALPHAD engine running in this tab (no server):
              same TDB, same phase suspensions. Validated against pycalphad on
              the shipped databases; still experimental — the hosted service
              remains authoritative, and every run here can be cross-checked
              against it.
            </div>
            {engineRunning && (
              <div className="calc-src" role="status">
                Sampling constitutions and refining the tangent plane against{" "}
                {dbId} — typically 1–10 s depending on the alloy system.
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
                    Cross-check vs hosted pycalphad ({dbId} @ {tempC} °C):{" "}
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
          </div>
        </>
      )}
    </div>
  );
}
