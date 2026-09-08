"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readWorkspace, activeStudy, createStudy, switchStudy, exportStudyBundle, importStudyBundle, matchesCurrentData, continueWithCurrentData, STUDY_CHANGED } from "../lib/workspace";
import { studyReport, downloadStudy } from "../lib/studyReport";
import type { CalculationRecord } from "../lib/calculationHistory";
import type { SavedStudy } from "../lib/studyFormat";
export function StudiesView() {
  const [studies, setStudies] = useState<SavedStudy[]>([]), [id, setId] = useState("");
  const [name, setName] = useState(""), [error, setError] = useState(""), [preview, setPreview] = useState(false);
  const refresh = () => { try { const w = readWorkspace(); setStudies(w.studies); setId(w.activeId); } catch (e) { setError(String(e)); } };
  useEffect(() => { refresh(); window.addEventListener(STUDY_CHANGED, refresh); return () => window.removeEventListener(STUDY_CHANGED, refresh); }, []);
  const perform = (fn: () => void) => { try { fn(); setError(""); refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const study = studies.find((s) => s.id === id);
  const calculations = JSON.parse(study?.slices["alloyra.calculations.v1"] ?? "[]") as CalculationRecord[];
  const stem = `alloyra-${(study?.name ?? "study").replace(/[^a-z0-9]+/gi, "-").slice(0, 70)}`;
  return <><div className="pane-header"><h1>Saved studies</h1><span className="count">{studies.length} in this browser</span></div>
    <div className="studies-content"><p>Each study keeps its duty profiles, exact condition shortlist, screening stages, rules, measured material records, verification actions, studio inputs and recorded calculations. Export a portable bundle to move it to another browser.</p>
    <div className="study-actions"><input aria-label="New study name" placeholder="New study name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
    <button className="btn" onClick={() => perform(() => { createStudy(name); setName(""); })}>Create study</button>
    <button className="btn ghost" disabled={!study} onClick={() => perform(() => { createStudy(name || `${study!.name} copy`, true); setName(""); })}>Duplicate active study</button>
    <label className="btn ghost">Import bundle<input type="file" accept=".json,application/json" aria-label="Import study bundle" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 12_000_000) { setError("Study file exceeds the 12 MB import limit."); return; } const raw = await file.text(); perform(() => { importStudyBundle(raw); }); }} /></label></div>
    {error && <p role="alert" className="calc-warn">{error}</p>}
    <div className="study-list">{studies.map((s) => <article key={s.id}><h2>{s.name}</h2><p>Updated {new Date(s.updatedAt).toLocaleString()} · {Object.keys(s.slices).length} saved sections</p><button className="btn" disabled={s.id === id} onClick={() => perform(() => switchStudy(s.id))}>{s.id === id ? "Active study" : "Open study"}</button></article>)}</div>
    {study && <section><h2>Export {study.name}</h2>{!matchesCurrentData(study) && <p className="calc-warn">This study uses a different reference snapshot. Its records are available here for review and export; calculation panes require the current shipped references. Create an updated copy to keep your inputs and recompute with current references. The original retains its results and decisions.</p>}
    <div className="study-actions">{!matchesCurrentData(study) && <button className="btn" onClick={() => perform(() => { continueWithCurrentData(); })}>Continue in an updated copy</button>}<button className="btn" onClick={() => perform(() => downloadStudy(JSON.stringify(exportStudyBundle(), null, 2), `${stem}.json`, "application/json"))}>Export portable bundle</button>
    <button className="btn ghost" onClick={() => perform(() => downloadStudy(studyReport(activeStudy()!), `${stem}.html`, "text/html"))}>Download readable report</button>
    <button className="btn ghost" aria-expanded={preview} onClick={() => setPreview((v) => !v)}>Preview report</button><Link className="btn ghost" href="/comparisons">Open comparison →</Link></div>
    <p className="calc-src">Import validates the file before saving and creates a separate copy. Recorded calculations include their requests, outputs and engine fingerprints. Historical results remain in this report; run the live pane to recompute.</p>
    <section className="saved-calculations"><h2>Recorded calculations ({calculations.length})</h2>{calculations.length === 0 && <p>No thermodynamic calculations recorded yet.</p>}{[...calculations].reverse().map((run) => <article key={run.id}><strong>{run.request.kind === "point" ? "Point equilibrium" : run.request.kind === "step" ? "Temperature sweep" : run.request.kind === "scheil" ? "Scheil solidification" : "Isopleth map"} · {run.status === "running" ? "Incomplete — no final event saved" : run.status}</strong><p>{run.request.dbId}{run.request.kind === "point" ? ` · ${run.request.tempC} °C` : ""} · {new Date(run.startedAt).toLocaleString()}</p><p>{run.coverage}</p><details><summary>Inspect saved inputs and results ({run.events.length} events)</summary><pre>{JSON.stringify({request:run.request,events:run.events,engine:run.engine},null,2)}</pre></details></article>)}</section>
    {preview && <iframe className="study-report" title="Study report preview" sandbox="" srcDoc={studyReport(study)} />}</section>}
    </div></>;
}
