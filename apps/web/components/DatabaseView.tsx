"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { alloys, type Alloy } from "@alloyra/data";
import {
  ceIIW,
  msAndrews,
  pren,
  specRange,
  type SpecRangeResult,
} from "@alloyra/core";
import { ProvenanceChip } from "./ProvenanceChip";

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

function fmtRange(r: SpecRangeResult): string {
  if (r.missing.length > 0) return "unknown";
  // "+" marks an open interval: an element has a spec minimum with no
  // maximum, so hi is a floor of the upper bound, not a bound.
  return `${r.lo.toFixed(1)} – ${r.hi.toFixed(1)}${r.openEnded.length > 0 ? "+" : ""}`;
}

function fmt(v: number | undefined, digits = 0): string {
  return v === undefined ? "—" : v.toFixed(digits);
}

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

  return (
    <aside className="detail open" aria-label="Alloy detail">
      <button type="button" className="detail-close mini" onClick={onClose}>
        ← Back to list
      </button>
      <div className="uns">{alloy.uns}</div>
      <h2>{alloy.names[0]}</h2>
      <div className="fam">
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

export function DatabaseView() {
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof familyRoots)[number]>("All");
  // The URL is the single source of truth for selection — ⌘K deep-links,
  // row clicks, and the mobile sheet's close all go through it.
  const sel = params.get("sel") ?? undefined;

  const rows = useMemo(
    () => (filter === "All" ? alloys : alloys.filter((a) => a.family[0] === filter)),
    [filter],
  );
  const selected = alloys.find((a) => a.uns === sel);

  const select = (uns: string) => {
    router.replace(`/database?sel=${uns}`, { scroll: false });
  };

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

  return (
    <>
      <div className="pane-header">
        <h1>Alloy database</h1>
        <span className="count">
          {rows.length} of {alloys.length} alloys
        </span>
        <span style={{ flex: 1 }} />
        <div className="chip-row" role="group" aria-label="Filter by base metal">
          {familyRoots.map((f) => (
            <button
              key={f}
              type="button"
              className={`fchip ${filter === f ? "on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-wrap">
        <div className="grid-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>UNS</th>
                <th>Name</th>
                <th>Family</th>
                <th className="num">σy min (MPa)</th>
                <th className="num">UTS min (MPa)</th>
                <th className="num" title="Interval permitted by the specification's composition ranges — a real heat sits at one point inside it. A trailing + means the interval is open above (spec minimum with no maximum).">
                  PREN (spec range) <span className="prov computed">COMPUTED</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const p = prenRangeFor(a);
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
                    <td className="mono">{a.uns}</td>
                    <td>{a.names[0]}</td>
                    <td className="dim">{a.family.slice(1).join(" / ") || a.family[0]}</td>
                    <td className="num mono">{fmt(specMin(a, "yield_strength"))}</td>
                    <td className="num mono">{fmt(specMin(a, "tensile_strength"))}</td>
                    <td className="num mono">{p ? fmtRange(p) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DetailPanel
          alloy={selected}
          onClose={() => router.replace("/database", { scroll: false })}
        />
      </div>
    </>
  );
}
