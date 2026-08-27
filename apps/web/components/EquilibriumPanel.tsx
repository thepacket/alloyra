"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Composition,
  EquilibriumResult,
  ProviderCapabilities,
} from "@alloyra/core";
import { calphadProvider } from "../lib/calphad";

/**
 * Phase-equilibrium panel (M3): the studio's window onto the CALPHAD
 * bridge. Degrades honestly — offline and database-gap states say exactly
 * what is missing and how to fix it, and no number appears without its
 * database named.
 */
export function EquilibriumPanel({ comp }: { comp: Composition }) {
  const [caps, setCaps] = useState<ProviderCapabilities | null>(null);
  const [dbId, setDbId] = useState("");
  const [tempC, setTempC] = useState(500);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EquilibriumResult | null>(null);
  const [error, setError] = useState("");

  const refresh = () => {
    setCaps(null);
    calphadProvider.capabilities().then((c) => {
      setCaps(c);
      const first = c.systems[0];
      if (first && !c.systems.some((s) => s.id === dbId)) setDbId(first.id);
    });
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

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await calphadProvider.equilibrium({ databaseId: dbId, compositionWt: comp, tempC }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

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
              <select className="hdr-select" value={dbId} onChange={(e) => setDbId(e.target.value)}>
                {caps.systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} ({s.elements.join("-")})
                  </option>
                ))}
              </select>
            </label>
            <label>T (°C)
              <input className="el-num mono" inputMode="decimal" value={tempC}
                onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setTempC(n); }} />
            </label>
            <button type="button" className="btn" onClick={run} disabled={running || missing.length > 0}>
              {running ? "Running…" : "Run equilibrium"}
            </button>
          </div>
          {missing.length > 0 && (
            <div className="calc-warn">
              {selected?.id} does not cover {missing.join(", ")} — this composition
              can't be computed against it. Pick a covering database or study a
              composition within {selected?.elements.join("-")}.
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
    </div>
  );
}
