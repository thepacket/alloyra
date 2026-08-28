"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { alloys, DATASET_VERSION, RULESET_VERSION, type Alloy } from "@alloyra/data";
import {
  describeStage,
  screenCandidates,
  type ScreeningStage,
  type UnknownPolicy,
} from "@alloyra/core";
import { ScatterChart, type ChartRegion, type ScatterPoint } from "./charts/Scatter";
import { FAMILY_COLOR } from "../lib/familyColors";
import {
  SCREEN_PROPERTIES,
  SCREEN_PROPERTY_META,
  screenProperty,
} from "../lib/screeningProps";
import { buildScreeningReport, referencedProperties } from "../lib/screeningReport";

/**
 * Staged screening (B-203): chained stages — family tree, numeric limits,
 * chart regions — each seeing only the survivors of the previous ones,
 * with progressive grey-out in the chart and table and an auto-generated
 * rationale report documenting why every candidate was eliminated.
 */

interface StoredScreening {
  stages: ScreeningStage[];
  xAxis: string;
  yAxis: string;
  datasetVersion: string;
}

const STORE = "alloyra.screening.v1";
const FAMILY_ROOTS = ["Fe", "Al", "Ti", "Ni", "Cu"];

const defaultStored = (): StoredScreening => ({
  stages: [],
  xAxis: "density",
  yAxis: "yield",
  datasetVersion: DATASET_VERSION,
});

function loadStored(): StoredScreening {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultStored();
    return { ...defaultStored(), ...(JSON.parse(raw) as StoredScreening) };
  } catch {
    return defaultStored();
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const fmtBound = (v: number): string =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(3);

function NumInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      className="el-num mono"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder ?? "—"}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => {
        const t = e.target.value.trim();
        if (t === "") return onChange(undefined);
        const n = Number(t);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function UnknownToggle({
  value,
  onChange,
}: {
  value: UnknownPolicy;
  onChange: (v: UnknownPolicy) => void;
}) {
  return (
    <label
      className="stage-unknowns"
      title="What happens to a candidate with no value on record for this property. Either way the report says so — a missing value never silently passes or fails."
    >
      unknowns
      <select
        className="hdr-select"
        value={value}
        onChange={(e) => onChange(e.target.value as UnknownPolicy)}
      >
        <option value="eliminate">eliminate (strict)</option>
        <option value="keep">keep (unverified)</option>
      </select>
    </label>
  );
}

export function ScreeningView() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredScreening>(defaultStored());
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStored(loadStored());
    setLoaded(true);
  }, []);

  const update = (mut: (s: StoredScreening) => StoredScreening) => {
    setStored((s) => {
      const next = mut(s);
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* session-only */
      }
      return next;
    });
  };

  const patchStage = (id: string, patch: Partial<ScreeningStage>) =>
    update((s) => ({
      ...s,
      stages: s.stages.map((st) => (st.id === id ? ({ ...st, ...patch } as ScreeningStage) : st)),
    }));

  // min/max are OPTIONAL bounds: clearing one deletes the key (this
  // codebase never stores an explicit undefined — exactOptionalPropertyTypes).
  const setLimitBound = (id: string, key: "min" | "max", v: number | undefined) =>
    update((s) => ({
      ...s,
      stages: s.stages.map((st) => {
        if (st.id !== id || st.kind !== "limit") return st;
        const next = { ...st };
        if (v === undefined) delete next[key];
        else next[key] = v;
        return next;
      }),
    }));

  // Toggle computed inside the functional update — two fast clicks must
  // not clobber each other through a stale render-scope closure.
  const toggleRoot = (id: string, root: string) =>
    update((s) => ({
      ...s,
      stages: s.stages.map((st) =>
        st.id === id && st.kind === "family"
          ? {
              ...st,
              roots: st.roots.includes(root)
                ? st.roots.filter((r) => r !== root)
                : [...st.roots, root],
            }
          : st,
      ),
    }));

  const removeStage = (id: string) =>
    update((s) => ({ ...s, stages: s.stages.filter((st) => st.id !== id) }));

  const moveStage = (id: string, dir: -1 | 1) =>
    update((s) => {
      const i = s.stages.findIndex((st) => st.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.stages.length) return s;
      const stages = [...s.stages];
      const [st] = stages.splice(i, 1);
      stages.splice(j, 0, st!);
      return { ...s, stages };
    });

  const addStage = (stage: ScreeningStage) =>
    update((s) => ({ ...s, stages: [...s.stages, stage] }));

  const result = useMemo(
    () =>
      screenCandidates(alloys, stored.stages, {
        resolve: (a: Alloy, pid: string) => screenProperty(pid)?.get(a),
        familyOf: (a: Alloy) => a.family,
        properties: SCREEN_PROPERTY_META,
      }),
    [stored.stages],
  );
  const byUns = useMemo(
    () => new Map(result.candidates.map((c) => [c.candidate.uns, c])),
    [result],
  );
  const survivors = result.candidates.filter((c) => c.eliminatedAt === undefined);
  const propIds = referencedProperties(stored.stages);

  const xDef = screenProperty(stored.xAxis) ?? SCREEN_PROPERTIES[0]!;
  const yDef = screenProperty(stored.yAxis) ?? SCREEN_PROPERTIES[1]!;

  const chartPoints: ScatterPoint[] = useMemo(
    () =>
      alloys
        .map((a): ScatterPoint | undefined => {
          const x = xDef.get(a);
          const y = yDef.get(a);
          if (x === undefined || y === undefined) return undefined;
          const c = byUns.get(a.uns);
          return {
            id: a.uns,
            label: a.names[0] ?? a.uns,
            sub: a.uns,
            x,
            y,
            color: FAMILY_COLOR[a.family[0] ?? ""] ?? "var(--accent)",
            muted: c?.eliminatedAt !== undefined,
          };
        })
        .filter((p): p is ScatterPoint => p !== undefined),
    [byUns, xDef, yDef],
  );

  // Region stages drawn on the chart when their axes match the current view.
  const chartRegions: ChartRegion[] = useMemo(() => {
    const regions: ChartRegion[] = [];
    let n = 0;
    for (const s of stored.stages) {
      if (!s.enabled) continue;
      n++;
      if (s.kind === "region" && s.xProperty === xDef.id && s.yProperty === yDef.id) {
        regions.push({ x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1, label: `S${n}` });
      }
    }
    return regions;
  }, [stored.stages, xDef.id, yDef.id]);

  const onBrush = (r: ChartRegion) =>
    addStage({
      id: newId(),
      kind: "region",
      xProperty: xDef.id,
      yProperty: yDef.id,
      x0: Number(r.x0.toPrecision(4)),
      x1: Number(r.x1.toPrecision(4)),
      y0: Number(r.y0.toPrecision(4)),
      y1: Number(r.y1.toPrecision(4)),
      unknowns: "eliminate",
      enabled: true,
    });

  const report = useMemo(
    () => buildScreeningReport(result, DATASET_VERSION),
    [result],
  );

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alloyra-screening-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handoff: survivors become comparison slots (first documented condition
  // of each — the comparison shows and lets you change the condition).
  const sendToComparison = () => {
    const picks = survivors.slice(0, 6);
    try {
      const raw = localStorage.getItem("alloyra.comparison.v1");
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const slots = picks
        .map((c) => {
          const cond = c.candidate.conditions[0];
          return cond
            ? { uns: c.candidate.uns, conditionId: cond.id, pinned: false, excluded: false }
            : undefined;
        })
        .filter((s) => s !== undefined);
      const overrideLog = [
        ...((existing.overrideLog as string[] | undefined) ?? []),
        `${new Date().toISOString()} — loaded ${slots.length} screening survivors (first documented condition of each; change conditions as needed)`,
      ];
      localStorage.setItem(
        "alloyra.comparison.v1",
        JSON.stringify({
          datasetVersion: DATASET_VERSION,
          rulesetVersion: RULESET_VERSION,
          ...existing,
          slots,
          overrideLog,
        }),
      );
    } catch {
      /* session-only */
    }
    router.push("/comparisons");
  };

  if (!loaded) return null;

  let stageNumber = 0;

  return (
    <>
      <div className="pane-header">
        <h1>Staged screening</h1>
        <span className="count">
          {survivors.length} of {alloys.length} survive · data {DATASET_VERSION}
        </span>
        <span style={{ flex: 1 }} />
        <div className="funnel mono" aria-label="Screening funnel">
          {result.funnel.map((n, i) => (
            <span key={i} className="funnel-step">
              {i > 0 && <span className="funnel-arrow">→</span>}
              <span className={`funnel-n ${i === result.funnel.length - 1 ? "last" : ""}`}>{n}</span>
              {i > 0 && <span className="funnel-s">S{i}</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="screen-wrap">
        <aside className="stage-rail" aria-label="Screening stages">
          <div className="stage-rail-head">
            Stages run top-to-bottom; each sees only the previous stage's
            survivors. Eliminations grey out in place — nothing vanishes.
          </div>

          {stored.stages.map((s, i) => {
            if (s.enabled) stageNumber++;
            const num = s.enabled ? stageNumber : undefined;
            return (
              <div key={s.id} className={`stage-card ${s.enabled ? "" : "off"}`}>
                <div className="stage-head">
                  <span className="stage-num mono">{num !== undefined ? `S${num}` : "off"}</span>
                  <span className="stage-kind">
                    {s.kind === "family" ? "Family" : s.kind === "limit" ? "Numeric limit" : "Chart region"}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="mini" onClick={() => moveStage(s.id, -1)} disabled={i === 0} aria-label="Move stage up">↑</button>
                  <button type="button" className="mini" onClick={() => moveStage(s.id, 1)} disabled={i === stored.stages.length - 1} aria-label="Move stage down">↓</button>
                  <button type="button" className="mini" onClick={() => patchStage(s.id, { enabled: !s.enabled })}>
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" className="mini" onClick={() => removeStage(s.id)} aria-label="Remove stage">✕</button>
                </div>

                {s.kind === "family" && (
                  <div className="stage-body">
                    <div className="chip-row" role="group" aria-label="Allowed base metals">
                      {FAMILY_ROOTS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`fchip ${s.roots.includes(f) ? "on" : ""}`}
                          style={{ "--fam-c": FAMILY_COLOR[f] } as CSSProperties}
                          onClick={() => toggleRoot(s.id, f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <input
                      className="el-num mono stage-term"
                      placeholder='family term, e.g. "stainless", "duplex"'
                      aria-label="Family term"
                      value={s.term ?? ""}
                      onChange={(e) => patchStage(s.id, { term: e.target.value })}
                    />
                    <div className="stage-desc">{describeStage(s, SCREEN_PROPERTY_META)}</div>
                  </div>
                )}

                {s.kind === "limit" && (
                  <div className="stage-body">
                    <select
                      className="hdr-select"
                      value={s.property}
                      aria-label="Limited property"
                      onChange={(e) => patchStage(s.id, { property: e.target.value })}
                    >
                      {SCREEN_PROPERTIES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                          {p.unit ? ` (${p.unit})` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="stage-bounds">
                      <label>min <NumInput label="Stage minimum" value={s.min} onChange={(v) => setLimitBound(s.id, "min", v)} /></label>
                      <label>max <NumInput label="Stage maximum" value={s.max} onChange={(v) => setLimitBound(s.id, "max", v)} /></label>
                    </div>
                    <UnknownToggle value={s.unknowns} onChange={(v) => patchStage(s.id, { unknowns: v })} />
                    <div className="stage-desc">{describeStage(s, SCREEN_PROPERTY_META)}</div>
                  </div>
                )}

                {s.kind === "region" && (
                  <div className="stage-body">
                    <div className="stage-desc mono">
                      {screenProperty(s.xProperty)?.label ?? s.xProperty}: {fmtBound(s.x0)} – {fmtBound(s.x1)}
                      <br />
                      {screenProperty(s.yProperty)?.label ?? s.yProperty}: {fmtBound(s.y0)} – {fmtBound(s.y1)}
                    </div>
                    <div className="stage-bounds">
                      <label>x₀ <NumInput label="Region x minimum" value={s.x0} onChange={(v) => v !== undefined && patchStage(s.id, { x0: v })} /></label>
                      <label>x₁ <NumInput label="Region x maximum" value={s.x1} onChange={(v) => v !== undefined && patchStage(s.id, { x1: v })} /></label>
                      <label>y₀ <NumInput label="Region y minimum" value={s.y0} onChange={(v) => v !== undefined && patchStage(s.id, { y0: v })} /></label>
                      <label>y₁ <NumInput label="Region y maximum" value={s.y1} onChange={(v) => v !== undefined && patchStage(s.id, { y1: v })} /></label>
                    </div>
                    <UnknownToggle value={s.unknowns} onChange={(v) => patchStage(s.id, { unknowns: v })} />
                    {(s.xProperty !== xDef.id || s.yProperty !== yDef.id) && (
                      <div className="stage-desc">
                        Drawn on other axes ({screenProperty(s.xProperty)?.label} vs{" "}
                        {screenProperty(s.yProperty)?.label}) — switch the chart to see the box.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="stage-add">
            <button
              type="button"
              className="btn ghost"
              onClick={() => addStage({ id: newId(), kind: "family", roots: [], enabled: true })}
            >
              + Family stage
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                addStage({ id: newId(), kind: "limit", property: "yield", min: 200, unknowns: "eliminate", enabled: true })
              }
            >
              + Numeric limit
            </button>
            <div className="stage-hint">
              + Chart region: drag a box on the chart — the brush becomes a
              stage.
            </div>
          </div>
        </aside>

        <div className="screen-main">
          <div className="chart-pane">
            <div className="chart-controls">
              <label>
                X{" "}
                <select className="hdr-select" value={xDef.id} onChange={(e) => update((s) => ({ ...s, xAxis: e.target.value }))}>
                  {SCREEN_PROPERTIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.unit ? ` (${p.unit})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Y{" "}
                <select className="hdr-select" value={yDef.id} onChange={(e) => update((s) => ({ ...s, yAxis: e.target.value }))}>
                  {SCREEN_PROPERTIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.unit ? ` (${p.unit})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <span className="stage-hint">drag a box to add a region stage</span>
            </div>
            <ScatterChart
              points={chartPoints}
              xAxis={{ label: `${xDef.label}${xDef.unit ? ` (${xDef.unit})` : ""}` }}
              yAxis={{ label: `${yDef.label}${yDef.unit ? ` (${yDef.unit})` : ""}` }}
              onPick={(uns) => router.push(`/database?sel=${uns}`)}
              regions={chartRegions}
              onBrush={onBrush}
              height={380}
              footnote="Greyed rings are eliminated by the active stages but kept for context (progressive grey-out). Points without values on both axes cannot be drawn — they are still screened and appear in the table and report. Click a point to open it in the database."
            />
          </div>

          <table className="data screen-table">
            <thead>
              <tr>
                <th>UNS</th>
                <th>Name</th>
                <th>Family</th>
                {propIds.map((id) => {
                  const p = screenProperty(id)!;
                  return (
                    <th key={id} className="num">
                      {p.label}
                      {p.unit ? ` (${p.unit})` : ""}
                    </th>
                  );
                })}
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((c) => {
                const a = c.candidate;
                const out = c.eliminatedAt !== undefined;
                const last = c.outcomes[c.outcomes.length - 1];
                return (
                  <tr key={a.uns} className={out ? "screened-out" : ""}>
                    <td className="mono">
                      <span className="fam-dot" style={{ background: FAMILY_COLOR[a.family[0] ?? ""] ?? "var(--accent)" }} />
                      {a.uns}
                    </td>
                    <td>{a.names[0]}</td>
                    <td className="dim">{a.family.join(" / ")}</td>
                    {propIds.map((id) => {
                      const v = screenProperty(id)!.get(a);
                      return (
                        <td key={id} className="num mono">
                          {v === undefined ? "—" : fmtBound(v)}
                        </td>
                      );
                    })}
                    <td className={out ? "outcome-out" : "outcome-in"}>
                      {out ? (
                        <span title={last?.reason}>
                          ✕ S{c.eliminatedAt} — {last?.reason}
                        </span>
                      ) : result.ran.length > 0 ? (
                        `✓ survives all ${result.ran.length} stage${result.ran.length === 1 ? "" : "s"}`
                      ) : (
                        "no stages yet"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="report-block">
            <div className="engine-head">
              <span className="calc-label">Rationale report</span>
              <button type="button" className="mini" onClick={copyReport}>
                {copied ? "Copied ✓" : "Copy Markdown"}
              </button>
              <button type="button" className="mini" onClick={downloadReport}>
                Download .md
              </button>
              <button
                type="button"
                className="mini"
                onClick={sendToComparison}
                disabled={survivors.length === 0 || survivors.length > 6}
                title={
                  survivors.length > 6
                    ? "The comparison holds up to 6 candidates — add a stage to narrow further."
                    : survivors.length === 0
                      ? "No survivors to send."
                      : "Replace the comparison's candidates with these survivors (first documented condition of each)."
                }
              >
                Send {survivors.length} survivor{survivors.length === 1 ? "" : "s"} to comparison
              </button>
            </div>
            <div className="calc-src">
              Auto-generated from the stages above: parameters, funnel, every
              elimination with its stated reason, unknown-policy disclosures,
              and value provenance. Screening informs expert judgment — it is
              not design approval.
            </div>
            <details className="report-details">
              <summary>Preview the report ({result.candidates.length} candidates, {result.ran.length} stages)</summary>
              <pre className="report-md mono">{report}</pre>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}
