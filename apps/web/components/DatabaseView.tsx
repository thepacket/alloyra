"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { alloys, microConcepts, type Alloy, type MicroConcept } from "@alloyra/data";
import {
  MECHANISMS,
  ceIIW,
  hasMechanism,
  matchesMicroQuery,
  microstructureHaystack,
  msAndrews,
  pren,
  specRange,
  type MechanismId,
  type MechanismTag,
  type Microstructure,
  type SpecRangeResult,
} from "@alloyra/core";
import { ProvenanceChip } from "./ProvenanceChip";
import { ScatterChart, type ScatterPoint } from "./charts/Scatter";
import { FAMILY_COLOR } from "../lib/familyColors";

const familyRoots = ["All", "Fe", "Al", "Ti", "Ni", "Cu"] as const;

function specMin(a: Alloy, property: string): number | undefined {
  for (const c of a.conditions) {
    const p = c.properties.find(
      (p) => p.property === property && p.provenance === "spec-min",
    );
    if (p) return p.value;
  }
  return undefined;
}

function typicalDensity(a: Alloy): number | undefined {
  for (const c of a.conditions) {
    const p = c.properties.find((p) => p.property === "density");
    if (p) return p.value;
  }
  return undefined;
}

function isStainless(a: Alloy) {
  return a.family[1] === "stainless";
}
function isPlainSteel(a: Alloy) {
  return a.family[0] === "Fe" && !isStainless(a);
}

function prenRangeFor(a: Alloy): SpecRangeResult | undefined {
  if (!isStainless(a)) return undefined;
  return specRange(pren, a.composition);
}

function prenMid(a: Alloy): number | undefined {
  const r = prenRangeFor(a);
  if (!r || r.missing.length > 0) return undefined;
  return (r.lo + r.hi) / 2;
}

function fmtRange(r: SpecRangeResult): string {
  if (r.missing.length > 0) return "unknown";
  // "+" marks an open interval: an element has a spec minimum with no
  // maximum, so hi is a floor of the upper bound, not a bound.
  return `${r.lo.toFixed(1)} – ${r.hi.toFixed(1)}${r.openEnded.length > 0 ? "+" : ""}`;
}

function fmt(v: number | undefined, digits = 0): string {
  return v === undefined ? "—" : v.toFixed(digits);
}

/** Chart axis vocabulary (B-202). Derived axes included (σy/ρ). */
interface AxisDef {
  id: string;
  label: string;
  get: (a: Alloy) => number | undefined;
  log?: boolean;
}
const AXES: AxisDef[] = [
  { id: "density", label: "ρ, typical (g/cm³)", get: typicalDensity },
  { id: "yield", label: "σy min (MPa)", get: (a) => specMin(a, "yield_strength") },
  { id: "uts", label: "UTS min (MPa)", get: (a) => specMin(a, "tensile_strength") },
  { id: "elong", label: "Elongation min (%)", get: (a) => specMin(a, "elongation") },
  { id: "pren", label: "PREN, mid of spec range", get: prenMid },
  {
    id: "specific",
    label: "σy/ρ, specific strength (kJ/kg)",
    get: (a) => {
      const y = specMin(a, "yield_strength");
      const d = typicalDensity(a);
      return y !== undefined && d !== undefined ? y / d : undefined;
    },
  },
];

const CHART_FOOTNOTE =
  "σy / UTS / elongation are spec minimums; ρ is literature-typical (ESTIMATED); PREN is the midpoint of the spec-permitted interval (COMPUTED). Greyed rings are screened out by the active filters but kept for context.";

function RangeLine({ label, r }: { label: string; r: SpecRangeResult }) {
  return (
    <div className={`calc-line ${r.inWindow ? "" : "out"}`} title={r.warnings.join(" ")}>
      <div>
        <div>
          {label} <ProvenanceChip p="computed" title="Interval permitted by the specification's composition ranges" />
        </div>
        <div className="formula">{r.formula}</div>
        {r.missing.length > 0 && (
          <div className="calc-warn">
            Unknown — spec does not regulate: {r.missing.join(", ")}
          </div>
        )}
      </div>
      <span className="val">
        {r.missing.length > 0
          ? "unknown"
          : `${r.lo.toFixed(1)} – ${r.hi.toFixed(1)}${r.openEnded.length > 0 ? "+" : ""}${r.unit ? ` ${r.unit}` : ""}`}
      </span>
    </div>
  );
}

function MechChips({ tags }: { tags: MechanismTag[] }) {
  return (
    <div className="mech-row">
      {tags.map((t) => (
        <span
          key={t.mechanism}
          className={`mech-chip ${t.role}`}
          title={`${MECHANISMS[t.mechanism].label} — ${t.role}${t.note ? ` · ${t.note}` : ""}`}
        >
          {MECHANISMS[t.mechanism].label.toLowerCase()}
          {t.role === "dominant" ? " ★" : ""}
        </span>
      ))}
    </div>
  );
}

const SERRATION_LABEL: Record<string, string> = {
  "none-documented": "serration: none documented",
  "possible-by-heat-treatment": "serration: possible by heat treatment",
  characteristic: "serration: characteristic",
};

function MicroSection({ m }: { m: Microstructure }) {
  return (
    <div className="micro-block">
      <div className="micro-line">
        <span className="micro-k">matrix</span>
        <span>{m.matrix}</span>
      </div>
      <div className="micro-line">
        <span className="micro-k">strengthening</span>
        <MechChips tags={m.strengthening} />
      </div>
      {m.constituents && m.constituents.length > 0 && (
        <div className="micro-line">
          <span className="micro-k">constituents</span>
          <div className="micro-consts">
            {m.constituents.map((c) => (
              <div key={c.phase} title={c.note}>
                <span className={`const-role ${c.role}`}>{c.role}</span> {c.phase}
                {c.note ? <span className="dim2"> — {c.note}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}
      {m.grainBoundaries && (
        <div className="micro-line">
          <span className="micro-k">grain bnds</span>
          <span>
            <span
              className={`gb-serr ${m.grainBoundaries.serration === "none-documented" ? "" : "on"}`}
            >
              {SERRATION_LABEL[m.grainBoundaries.serration]}
            </span>
            {m.grainBoundaries.note ? <span className="dim2"> — {m.grainBoundaries.note}</span> : null}
          </span>
        </div>
      )}
      {m.twinning && (
        <div className="micro-line">
          <span className="micro-k">twinning</span>
          <span>
            annealing twins {m.twinning.annealingTwins}
            {m.twinning.deformationNote ? (
              <span className="dim2"> — {m.twinning.deformationNote}</span>
            ) : null}
          </span>
        </div>
      )}
      {m.texture && (
        <div className="micro-line">
          <span className="micro-k">texture</span>
          <span>{m.texture}</span>
        </div>
      )}
      <div className="calc-src">
        Literature-typical descriptors <ProvenanceChip p="estimated" title={m.source} /> —{" "}
        {m.source}. Not measured characterization of any specific heat.
      </div>
    </div>
  );
}

function ConceptCard({ c, matches }: { c: MicroConcept; matches: number }) {
  return (
    <div className="concept-card">
      <div className="concept-head">
        <span className="concept-name">{c.name}</span>
        <span className="concept-count mono">
          {matches > 0
            ? `${matches} matching condition${matches === 1 ? "" : "s"} in dataset`
            : "0 matches in current dataset — a dataset gap (BACKLOG B-305), not evidence of absence"}
        </span>
      </div>
      <div className="concept-body">
        <p>{c.definition}</p>
        <p>
          <b>Produced by:</b> {c.producedBy}
        </p>
        <p>
          <b>Effects:</b> {c.effects}
        </p>
      </div>
      <div className="calc-src">{c.source}</div>
    </div>
  );
}

function DetailPanel({
  alloy,
  onClose,
}: {
  alloy: Alloy | undefined;
  onClose: () => void;
}) {
  if (!alloy) {
    return (
      <aside className="detail">
        <div className="empty-detail">
          Select an alloy — or press <span className="mono">⌘K</span>
        </div>
      </aside>
    );
  }
  // Specification-derived INTERVALS — what the spec permits, not a
  // fabricated nominal point. Actual heat chemistry goes in the studio.
  const calcs: { label: string; r: SpecRangeResult }[] = [];
  if (isStainless(alloy)) {
    calcs.push({ label: "PREN (spec range)", r: specRange(pren, alloy.composition) });
  }
  if (isPlainSteel(alloy)) {
    calcs.push({ label: "CE(IIW) (spec range)", r: specRange(ceIIW, alloy.composition) });
    calcs.push({ label: "Ms, Andrews (spec range)", r: specRange(msAndrews, alloy.composition) });
  }
  const famColor = FAMILY_COLOR[alloy.family[0] ?? ""] ?? "var(--accent)";

  return (
    <aside className="detail open" aria-label="Alloy detail">
      <button type="button" className="detail-close mini" onClick={onClose}>
        ← Back to list
      </button>
      <div className="uns" style={{ color: famColor }}>
        {alloy.uns}
      </div>
      <h2>{alloy.names[0]}</h2>
      <div className="fam">
        <span className="fam-dot" style={{ background: famColor }} />
        {alloy.family.join(" → ")}
        {alloy.names.length > 1 ? ` · ${alloy.names.slice(1).join(", ")}` : ""}
      </div>

      <section>
        <h3>Standards</h3>
        <div className="note-text">{alloy.standards.join(" · ")}</div>
      </section>

      <section>
        <h3>Composition (wt %)</h3>
        <table className="kv">
          <tbody>
            {alloy.composition.map((r) => (
              <tr key={r.element}>
                <td>
                  {r.element}
                  {r.note ? ` (${r.note})` : ""}
                </td>
                <td className="num">
                  {r.balance
                    ? "bal."
                    : r.min !== undefined && r.max !== undefined
                      ? `${r.min} – ${r.max}`
                      : r.min !== undefined
                        ? `≥ ${r.min}`
                        : `≤ ${r.max}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Conditions &amp; properties</h3>
        {alloy.conditions.map((c) => (
          <div className="cond" key={c.id}>
            <div className="cname">{c.name}</div>
            <div className="cform">{c.form}</div>
            {c.properties.map((p) => (
              <div className="propline" key={p.property}>
                <span>
                  {p.property.replace(/_/g, " ")}{" "}
                  <ProvenanceChip p={p.provenance} title={`${p.source}${p.note ? ` — ${p.note}` : ""}`} />
                </span>
                <span className="val">
                  {p.value} {p.unit}
                </span>
              </div>
            ))}
            {c.microstructure && <MicroSection m={c.microstructure} />}
            {c.note && <div className="note-text">{c.note}</div>}
          </div>
        ))}
      </section>

      {calcs.length > 0 && (
        <section>
          <h3>Computed — spec-permitted intervals</h3>
          {calcs.map((c) => (
            <RangeLine key={c.label} label={c.label} r={c.r} />
          ))}
          <div className="note-text">
            Ranges span the specification's composition limits; a real heat
            sits at one point inside them. A trailing "+" means the interval
            is open above (an element has a spec minimum but no maximum, so
            the upper value is a floor, not a bound). Enter heat chemistry
            in the Composition studio for point values.
          </div>
        </section>
      )}

      {alloy.notes && (
        <section>
          <h3>Metallurgist's notes</h3>
          <div className="note-text">{alloy.notes}</div>
        </section>
      )}
    </aside>
  );
}

/** Per-alloy microstructure match against mechanism + free-text query. */
function microMatches(a: Alloy, mech: MechanismId | "", q: string): boolean {
  if (!mech && !q.trim()) return true;
  return a.conditions.some((c) => {
    const m = c.microstructure;
    if (!m) return false;
    if (mech && !hasMechanism(m, mech)) return false;
    if (q.trim() && !matchesMicroQuery(microstructureHaystack(m), q)) return false;
    return true;
  });
}

export function DatabaseView() {
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof familyRoots)[number]>("All");
  const [view, setView] = useState<"table" | "chart">("table");
  const [xAxis, setXAxis] = useState("density");
  const [yAxis, setYAxis] = useState("yield");
  // The URL is the single source of truth for selection and the micro
  // search — ⌘K deep-links, row clicks, and the mobile sheet all go
  // through it (?sel=, ?q=, ?mech=).
  const sel = params.get("sel") ?? undefined;
  const urlQ = params.get("q") ?? "";
  const urlMech = (params.get("mech") ?? "") as MechanismId | "";
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);

  const setParams = (next: { sel?: string; q?: string; mech?: string }) => {
    const p = new URLSearchParams();
    const merged = {
      sel: next.sel !== undefined ? next.sel : (sel ?? ""),
      q: next.q !== undefined ? next.q : urlQ,
      mech: next.mech !== undefined ? next.mech : urlMech,
    };
    if (merged.sel) p.set("sel", merged.sel);
    if (merged.q) p.set("q", merged.q);
    if (merged.mech) p.set("mech", merged.mech);
    const qs = p.toString();
    router.replace(`/database${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const familyRows = useMemo(
    () => (filter === "All" ? alloys : alloys.filter((a) => a.family[0] === filter)),
    [filter],
  );
  const rows = useMemo(
    () => familyRows.filter((a) => microMatches(a, urlMech, urlQ)),
    [familyRows, urlMech, urlQ],
  );
  const selected = alloys.find((a) => a.uns === sel);

  // Concept cards: shown when the query names a documented concept.
  const concepts = useMemo(() => {
    const query = urlQ.trim().toLowerCase();
    if (query.length < 3) return [];
    return microConcepts
      .filter((c) =>
        [c.name, ...c.synonyms].some(
          (s) => s.toLowerCase().includes(query) || query.includes(s.toLowerCase()),
        ),
      )
      .slice(0, 2);
  }, [urlQ]);

  const conceptMatchCount = (c: MicroConcept) =>
    alloys
      .flatMap((a) => a.conditions)
      .filter(
        (cond) =>
          cond.microstructure &&
          matchesMicroQuery(microstructureHaystack(cond.microstructure), c.probe),
      ).length;

  const select = (uns: string) => setParams({ sel: uns });

  // Keyboard row navigation (U-2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const idx = rows.findIndex((a) => a.uns === sel);
      const next =
        e.key === "ArrowDown"
          ? rows[Math.min(idx + 1, rows.length - 1)]
          : rows[Math.max(idx - 1, 0)];
      if (next) select(next.uns);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sel]);

  const xDef = AXES.find((a) => a.id === xAxis)!;
  const yDef = AXES.find((a) => a.id === yAxis)!;
  // Chart shows the family-filtered set; micro-screened-out alloys stay
  // visible but greyed (Granta grey-out grammar, B-202).
  const chartPoints = familyRows
    .map((a): ScatterPoint | undefined => {
      const x = xDef.get(a);
      const y = yDef.get(a);
      if (x === undefined || y === undefined) return undefined;
      const matched = rows.includes(a);
      return {
        id: a.uns,
        label: a.names[0] ?? a.uns,
        sub: a.uns,
        x,
        y,
        color: FAMILY_COLOR[a.family[0] ?? ""] ?? "var(--accent)",
        muted: !matched,
        selected: a.uns === sel,
      };
    })
    .filter((p): p is ScatterPoint => p !== undefined);

  return (
    <>
      <div className="pane-header">
        <h1>Alloy database</h1>
        <span className="count">
          {rows.length} of {alloys.length} alloys
        </span>
        <input
          className="micro-search mono"
          placeholder="microstructure: serrated, twins, age hardening…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setParams({ q: e.target.value });
          }}
          aria-label="Search microstructural features"
        />
        <select
          className="hdr-select"
          value={urlMech}
          onChange={(e) => setParams({ mech: e.target.value })}
          aria-label="Filter by strengthening mechanism"
        >
          <option value="">Mechanism: any</option>
          {(Object.keys(MECHANISMS) as MechanismId[]).map((m) => (
            <option key={m} value={m}>
              {MECHANISMS[m].label}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <div className="chip-row" role="group" aria-label="Filter by base metal">
          {familyRoots.map((f) => (
            <button
              key={f}
              type="button"
              className={`fchip ${filter === f ? "on" : ""}`}
              style={f !== "All" ? ({ "--fam-c": FAMILY_COLOR[f] } as CSSProperties) : undefined}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="View mode">
          <button
            type="button"
            className={`fchip ${view === "table" ? "on" : ""}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={`fchip ${view === "chart" ? "on" : ""}`}
            onClick={() => setView("chart")}
          >
            Chart
          </button>
        </div>
      </div>
      <div className="grid-wrap">
        <div className="grid-scroll">
          {concepts.map((c) => (
            <ConceptCard key={c.id} c={c} matches={conceptMatchCount(c)} />
          ))}
          {view === "chart" ? (
            <div className="chart-pane">
              <div className="chart-controls">
                <label>
                  X{" "}
                  <select className="hdr-select" value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
                    {AXES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Y{" "}
                  <select className="hdr-select" value={yAxis} onChange={(e) => setYAxis(e.target.value)}>
                    {AXES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ScatterChart
                points={chartPoints}
                xAxis={{ label: xDef.label }}
                yAxis={{ label: yDef.label }}
                onPick={select}
                footnote={CHART_FOOTNOTE}
              />
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>UNS</th>
                  <th>Name</th>
                  <th>Family</th>
                  <th>Dominant mechanism</th>
                  <th className="num">σy min (MPa)</th>
                  <th className="num">UTS min (MPa)</th>
                  <th className="num">ρ (g/cm³)</th>
                  <th className="num" title="Interval permitted by the specification's composition ranges — a real heat sits at one point inside it. A trailing + means the interval is open above (spec minimum with no maximum).">
                    PREN (spec range) <span className="prov computed">COMPUTED</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const p = prenRangeFor(a);
                  const dom = a.conditions[0]?.microstructure?.strengthening.find(
                    (t) => t.role === "dominant",
                  );
                  return (
                    <tr
                      key={a.uns}
                      className={a.uns === sel ? "selected" : ""}
                      onClick={() => select(a.uns)}
                      tabIndex={0}
                      aria-selected={a.uns === sel}
                      aria-label={`${a.names[0]} ${a.uns}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(a.uns);
                        }
                      }}
                    >
                      <td className="mono">
                        <span
                          className="fam-dot"
                          style={{ background: FAMILY_COLOR[a.family[0] ?? ""] ?? "var(--accent)" }}
                        />
                        {a.uns}
                      </td>
                      <td>{a.names[0]}</td>
                      <td className="dim">{a.family.slice(1).join(" / ") || a.family[0]}</td>
                      <td className="dim">
                        {dom ? (
                          <span className="mech-chip dominant sm">
                            {MECHANISMS[dom.mechanism].label.toLowerCase()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num mono">{fmt(specMin(a, "yield_strength"))}</td>
                      <td className="num mono">{fmt(specMin(a, "tensile_strength"))}</td>
                      <td className="num mono">{fmt(typicalDensity(a), 2)}</td>
                      <td className="num mono">{p ? fmtRange(p) : "—"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="dim" style={{ textAlign: "center", padding: 24 }}>
                      No alloy in the current dataset documents this feature —
                      an honest zero, not proof of absence. Dataset expansion
                      is BACKLOG B-305.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <DetailPanel alloy={selected} onClose={() => setParams({ sel: "" })} />
      </div>
    </>
  );
}
