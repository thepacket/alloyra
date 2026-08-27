"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { alloys, type Alloy } from "@alloyra/data";
import {
  ceIIW,
  midpointComposition,
  msAndrews,
  pren,
  wrc1992,
  type CalcResult,
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

function prenFor(a: Alloy): CalcResult | undefined {
  if (!isStainless(a)) return undefined;
  return pren(midpointComposition(a.composition));
}

function fmt(v: number | undefined, digits = 0): string {
  return v === undefined ? "—" : v.toFixed(digits);
}

function CalcLine({ label, r }: { label: string; r: CalcResult }) {
  return (
    <div className={`calc-line ${r.inWindow ? "" : "out"}`} title={r.warnings.join(" ")}>
      <div>
        <div>
          {label} <ProvenanceChip p="computed" title={r.source.citation} />
        </div>
        <div className="formula">{r.formula}</div>
      </div>
      <span className="val">
        {r.inWindow ? `${r.value.toFixed(1)}${r.unit ? ` ${r.unit}` : ""}` : "n/a"}
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
  const mid = midpointComposition(alloy.composition);
  const calcs: { label: string; r: CalcResult }[] = [];
  if (isStainless(alloy)) {
    calcs.push({ label: "PREN (mid-spec)", r: pren(mid) });
    const w = wrc1992(mid);
    calcs.push({ label: "WRC-1992 Creq", r: w.creq });
    calcs.push({ label: "WRC-1992 Nieq", r: w.nieq });
  }
  if (isPlainSteel(alloy)) {
    calcs.push({ label: "CE(IIW) (mid-spec)", r: ceIIW(mid) });
    calcs.push({ label: "Ms, Andrews (mid-spec)", r: msAndrews(mid) });
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
          <h3>Computed (hover for source)</h3>
          {calcs.map((c) => (
            <CalcLine key={c.label} label={c.label} r={c.r} />
          ))}
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
                <th className="num" title="Pitting resistance equivalent, computed at mid-spec composition">
                  PREN (mid-spec) <span className="prov computed">COMPUTED</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const p = prenFor(a);
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
                    <td className="num mono">{p ? p.value.toFixed(1) : "—"}</td>
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
