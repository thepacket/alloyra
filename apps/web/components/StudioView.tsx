"use client";

import { useEffect, useMemo, useState } from "react";
import { alloys, DATASET_VERSION } from "@alloyra/data";
import { EquilibriumPanel } from "./EquilibriumPanel";
import {
  ceIIW,
  elementCost,
  larsonMiller,
  md30Nohara,
  midpointComposition,
  msAndrews,
  nearestGrades,
  pren,
  wrc1992,
  type CalcResult,
  type Composition,
  type ElementSymbol,
} from "@alloyra/core";

/**
 * Composition studio (blueprint § 4.3 / § 5, milestone M2).
 * Every derived quantity shows its formula, source, and validity window
 * inline (R-4.2); out-of-window outputs grey out instead of extrapolating
 * (R-4.3). All outputs are COMPUTED — straw, everywhere.
 */

const STORE = "alloyra.studio.v1";

const ADDABLE: ElementSymbol[] = [
  "C", "N", "Mn", "Si", "Cr", "Ni", "Mo", "Cu", "W", "Nb", "Ti", "Al", "V", "Co", "Mg", "Zn",
];

/**
 * PLACEHOLDER element prices, USD/kg — order-of-magnitude seeds so the
 * roll-up works out of the box. Not market data; the user owns this table
 * (R-4.5) and the UI says so.
 */
const PLACEHOLDER_PRICES: Partial<Record<ElementSymbol, number>> = {
  Fe: 0.5, C: 0.5, Si: 2, Mn: 2, P: 0, S: 0, Cr: 10, Ni: 18, Mo: 40,
  N: 0, Cu: 9, W: 40, Nb: 45, Ti: 12, Al: 2.5, V: 25, Zn: 3, Mg: 4,
  Co: 35, Sn: 30, Pb: 2, Zr: 40, B: 5, O: 0, H: 0, Ta: 150,
};

interface StudioState {
  baseUns: string;
  comp: Partial<Record<ElementSymbol, number>>;
  prices: Partial<Record<ElementSymbol, number>>;
  lmp: { tempC: number; hours: number; C: number };
}

function seedFromBase(uns: string): Partial<Record<ElementSymbol, number>> {
  const alloy = alloys.find((a) => a.uns === uns);
  if (!alloy) return {};
  const mid = midpointComposition(alloy.composition, {
    includeResidualsAtHalfMax: true,
  });
  const out: Partial<Record<ElementSymbol, number>> = {};
  for (const [el, v] of Object.entries(mid) as [ElementSymbol, number][]) {
    out[el] = Number(v.toFixed(3));
  }
  return out;
}

function defaultState(): StudioState {
  return {
    baseUns: "S31603",
    comp: seedFromBase("S31603"),
    prices: { ...PLACEHOLDER_PRICES },
    lmp: { tempC: 600, hours: 100_000, C: 20 },
  };
}

function loadState(): StudioState {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    return { ...defaultState(), ...(JSON.parse(raw) as StudioState) };
  } catch {
    return defaultState();
  }
}

function balanceElement(uns: string): ElementSymbol | undefined {
  return alloys.find((a) => a.uns === uns)?.composition.find((r) => r.balance)
    ?.element;
}

function sliderMax(el: ElementSymbol, uns: string): number {
  const r = alloys
    .find((a) => a.uns === uns)
    ?.composition.find((x) => x.element === el);
  const anchor = r?.max ?? r?.min ?? 0;
  return Math.max(1, Math.ceil(anchor * 2));
}

function CalcCard({ label, r }: { label: string; r: CalcResult }) {
  return (
    <div className={`calc-card ${r.inWindow ? "" : "out"}`}>
      <div className="calc-top">
        <span className="calc-label">
          {label} <span className="prov computed">COMPUTED</span>
        </span>
        <span className="calc-value">
          {r.inWindow ? `${r.value.toFixed(1)}${r.unit ? ` ${r.unit}` : ""}` : "n/a"}
        </span>
      </div>
      <div className="calc-formula mono">{r.formula}</div>
      <div className="calc-src">
        {r.source.citation}
        {r.source.note ? ` — ${r.source.note}` : ""}
      </div>
      {r.warnings.map((w) => (
        <div className="calc-warn" key={w}>{w}</div>
      ))}
    </div>
  );
}

function WrcDiagram({ creq, nieq, inWindow }: { creq: number; nieq: number; inWindow: boolean }) {
  const X0 = 44, Y0 = 14, W = 268, H = 168;
  const x = (v: number) => X0 + ((v - 17) / (31 - 17)) * W;
  const y = (v: number) => Y0 + H - ((v - 9) / (18 - 9)) * H;
  const px = Math.max(X0, Math.min(X0 + W, x(creq)));
  const py = Math.max(Y0, Math.min(Y0 + H, y(nieq)));
  const xs = [];
  for (let v = 17; v <= 31; v += 2) xs.push(v);
  const ys = [];
  for (let v = 9; v <= 18; v += 1) ys.push(v);
  return (
    <div className={`wrc-wrap ${inWindow ? "" : "out"}`}>
      <svg viewBox="0 0 340 224" role="img" aria-label={`WRC-1992 placement: Creq ${creq.toFixed(1)}, Nieq ${nieq.toFixed(1)}`}>
        <rect x={X0} y={Y0} width={W} height={H} className="wrc-frame" />
        {xs.map((v) => (
          <g key={`x${v}`}>
            <line x1={x(v)} y1={Y0} x2={x(v)} y2={Y0 + H} className="wrc-grid" />
            <text x={x(v)} y={Y0 + H + 14} className="wrc-tick" textAnchor="middle">{v}</text>
          </g>
        ))}
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line x1={X0} y1={y(v)} x2={X0 + W} y2={y(v)} className="wrc-grid" />
            <text x={X0 - 6} y={y(v) + 3} className="wrc-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        <text x={X0 + W / 2} y={220} className="wrc-axis" textAnchor="middle">
          Creq = Cr + Mo + 0.7·Nb
        </text>
        <text x={12} y={Y0 + H / 2} className="wrc-axis" textAnchor="middle" transform={`rotate(-90 12 ${Y0 + H / 2})`}>
          Nieq = Ni + 35·C + 20·N + 0.25·Cu
        </text>
        <circle cx={px} cy={py} r={5} className="wrc-point" />
        <circle cx={px} cy={py} r={9} className="wrc-halo" />
      </svg>
      <div className="wrc-note">
        Placement on the WRC-1992 frame (Kotecki &amp; Siewert, WRC Bull. 342).
        FN iso-lines not yet digitized — no ferrite number is claimed.
        {!inWindow && " Point outside the diagram window — prediction not valid."}
      </div>
    </div>
  );
}

export function StudioView() {
  const [state, setState] = useState<StudioState>(defaultState());
  const [loaded, setLoaded] = useState(false);
  const [addSel, setAddSel] = useState("");

  useEffect(() => {
    setState(loadState());
    setLoaded(true);
  }, []);

  const update = (mut: (s: StudioState) => StudioState) => {
    setState((s) => {
      const next = mut(s);
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* session-only */
      }
      return next;
    });
  };

  const bal = balanceElement(state.baseUns);
  const othersSum = useMemo(
    () =>
      (Object.entries(state.comp) as [ElementSymbol, number][])
        .filter(([el]) => el !== bal)
        .reduce((s, [, v]) => s + v, 0),
    [state.comp, bal],
  );
  const balancePct = Math.max(0, 100 - othersSum);

  /** Full composition incl. balance — what every calculator consumes. */
  const comp: Composition = useMemo(() => {
    const c: Composition = {};
    for (const [el, v] of Object.entries(state.comp) as [ElementSymbol, number][]) {
      if (el !== bal && v > 0) c[el] = v;
    }
    if (bal) c[bal] = Number(balancePct.toFixed(3));
    return c;
  }, [state.comp, bal, balancePct]);

  const results = useMemo(() => {
    const w = wrc1992(comp);
    return {
      pren: pren(comp),
      wrc: w,
      ce: ceIIW(comp),
      ms: msAndrews(comp),
      md30: md30Nohara(comp),
      lmp: larsonMiller(state.lmp.tempC, state.lmp.hours, state.lmp.C),
      matches: nearestGrades(
        Object.fromEntries(
          (Object.entries(comp) as [ElementSymbol, number][]).filter(
            ([el]) => el !== bal,
          ),
        ) as Composition,
        alloys.map((a) => ({ uns: a.uns, name: a.names[0] ?? a.uns, composition: a.composition })),
      ),
      cost: elementCost(comp, state.prices),
    };
  }, [comp, bal, state.lmp, state.prices]);

  const setElement = (el: ElementSymbol, v: number) =>
    update((s) => ({ ...s, comp: { ...s.comp, [el]: v } }));

  const removeElement = (el: ElementSymbol) =>
    update((s) => {
      const next = { ...s.comp };
      delete next[el];
      return { ...s, comp: next };
    });

  const exportStudy = () => {
    const rows = (Object.entries(comp) as [ElementSymbol, number][])
      .map(([el, v]) => `<tr><td>${el}</td><td>${el === bal ? `${v} (balance)` : v}</td></tr>`)
      .join("");
    const calcRow = (label: string, r: CalcResult) =>
      `<tr><td>${label}</td><td>${r.inWindow ? `${r.value.toFixed(1)} ${r.unit}` : "n/a (out of validity window)"}</td><td><code>${r.formula}</code></td><td>${r.source.citation}</td><td>${r.warnings.join("; ") || "—"}</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Alloyra composition study</title>
<style>body{font-family:Georgia,serif;max-width:60rem;margin:2rem auto;color:#1b2129;line-height:1.5}
h1{font-family:Arial;letter-spacing:.02em}table{border-collapse:collapse;width:100%;margin:.75rem 0}
td,th{border:1px solid #ccc;padding:4px 10px;font-size:14px;text-align:left}code{font-size:12px}
.meta{color:#5a6472;font-size:13px}.warn{color:#a65b1f}</style></head><body>
<h1>Alloyra composition study</h1>
<p class="meta">Base grade: ${state.baseUns} · dataset ${DATASET_VERSION} · exported ${new Date().toISOString()}<br>
All derived values are COMPUTED from the stated composition via the cited empirical relations — verify before design use.</p>
<h2>Composition (wt %)</h2><table>${rows}</table>
<h2>Derived quantities</h2>
<table><tr><th>Quantity</th><th>Value</th><th>Formula</th><th>Source</th><th>Warnings</th></tr>
${calcRow("PREN", results.pren)}${calcRow("WRC-1992 Creq", results.wrc.creq)}${calcRow("WRC-1992 Nieq", results.wrc.nieq)}
${calcRow("CE(IIW)", results.ce)}${calcRow("Ms (Andrews)", results.ms)}${calcRow("Md30 (Nohara)", results.md30)}
${calcRow(`LMP @ ${state.lmp.tempC} °C / ${state.lmp.hours} h (C=${state.lmp.C})`, results.lmp)}</table>
<h2>Nearest standard grades</h2>
<table><tr><th>Grade</th><th>Σ|Δwt%|</th><th>Largest deltas (user − grade)</th></tr>
${results.matches.map((m) => `<tr><td>${m.name} (${m.uns})</td><td>${m.distance.toFixed(2)}</td><td>${m.deltas.slice(0, 5).map((d) => `${d.element} ${d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)}`).join(", ") || "—"}</td></tr>`).join("")}</table>
<h2>Element cost roll-up</h2>
<p>≈ ${results.cost.perKg.toFixed(2)} per kg on the user's price table (raw-element basis; excludes melt/processing).${results.cost.unpriced.length ? ` <span class="warn">Unpriced: ${results.cost.unpriced.join(", ")}.</span>` : ""}</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alloyra-study-${state.baseUns}-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) return null;

  const editableElements = (Object.keys(state.comp) as ElementSymbol[]).filter(
    (el) => el !== bal,
  );

  return (
    <>
      <div className="pane-header">
        <h1>Composition studio</h1>
        <span className="count">data {DATASET_VERSION}</span>
        <span style={{ flex: 1 }} />
        <label className="inline-label" htmlFor="st-base">Base grade</label>
        <select
          id="st-base"
          className="hdr-select"
          value={state.baseUns}
          onChange={(e) =>
            update((s) => ({
              ...s,
              baseUns: e.target.value,
              comp: seedFromBase(e.target.value),
            }))
          }
        >
          {alloys.map((a) => (
            <option key={a.uns} value={a.uns}>
              {a.names[0]} · {a.uns}
            </option>
          ))}
        </select>
        <button type="button" className="btn ghost" onClick={() => update((s) => ({ ...s, comp: seedFromBase(s.baseUns) }))}>
          Reset to mid-spec
        </button>
        <button type="button" className="btn" onClick={exportStudy}>
          Export study
        </button>
      </div>

      <div className="split">
        <div className="studio-left">
          <h3 className="studio-h">Composition (wt %) — seeded at mid-spec, residuals at half-max</h3>
          {editableElements.map((el) => {
            const max = sliderMax(el, state.baseUns);
            const v = state.comp[el] ?? 0;
            return (
              <div className="el-row" key={el}>
                <span className="el-sym mono">{el}</span>
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={max / 200}
                  value={v}
                  onChange={(e) => setElement(el, Number(e.target.value))}
                  aria-label={`${el} content`}
                />
                <input
                  className="el-num mono"
                  inputMode="decimal"
                  value={v}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0) setElement(el, n);
                  }}
                />
                <button type="button" className="mini" onClick={() => removeElement(el)} aria-label={`Remove ${el}`}>
                  ×
                </button>
              </div>
            );
          })}
          {bal && (
            <div className="el-row bal">
              <span className="el-sym mono">{bal}</span>
              <span className="el-balnote">balance</span>
              <span className="el-num mono">{balancePct.toFixed(2)}</span>
              <span style={{ width: 26 }} />
            </div>
          )}
          {othersSum > 100 && (
            <div className="calc-warn">Alloying elements exceed 100 wt% — fix before trusting any output.</div>
          )}
          <div className="el-add">
            <select
              className="hdr-select"
              value={addSel}
              onChange={(e) => {
                const el = e.target.value as ElementSymbol;
                if (el) setElement(el, 0);
                setAddSel("");
              }}
            >
              <option value="">+ Add element…</option>
              {ADDABLE.filter((el) => !(el in state.comp) && el !== bal).map((el) => (
                <option key={el} value={el}>{el}</option>
              ))}
            </select>
          </div>

          <h3 className="studio-h">Element prices — placeholders, edit with your procurement figures (R-4.5)</h3>
          <div className="price-grid">
            {(Object.keys(comp) as ElementSymbol[]).map((el) => (
              <label className="price-item" key={el}>
                <span className="mono">{el}</span>
                <input
                  className="el-num mono"
                  inputMode="decimal"
                  value={state.prices[el] ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    update((s) => ({
                      ...s,
                      prices: {
                        ...s.prices,
                        [el]: e.target.value === "" || !Number.isFinite(n) ? undefined : n,
                      },
                    }));
                  }}
                />
              </label>
            ))}
          </div>
          <div className="cost-line">
            ≈ <span className="mono">{results.cost.perKg.toFixed(2)}</span> /kg raw-element basis
            {results.cost.unpriced.length > 0 && (
              <span className="calc-warn"> · unpriced: {results.cost.unpriced.join(", ")}</span>
            )}
          </div>
        </div>

        <div className="studio-right">
          <h3 className="studio-h">Nearest standard grades — Σ|Δwt%|, transparent by design (R-4.4)</h3>
          <div className="match-row">
            {results.matches.map((m, i) => (
              <div className={`match ${i === 0 ? "best" : ""}`} key={m.uns}>
                <div className="match-name">{m.name} <span className="mono dim">{m.uns}</span></div>
                <div className="match-dist mono">Σ|Δ| = {m.distance.toFixed(2)}</div>
                {i === 0 && (
                  <div className="match-deltas mono">
                    {m.deltas.slice(0, 4).map((d) => (
                      <span key={d.element}>
                        δ{d.element} {d.delta > 0 ? "+" : ""}{d.delta.toFixed(2)}
                      </span>
                    ))}
                    {m.deltas.length === 0 && <span>exact mid-spec match</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3 className="studio-h">Derived quantities — greyed means outside the model's validated window (R-4.3)</h3>
          <div className="calc-grid">
            <CalcCard label="PREN" r={results.pren} />
            <CalcCard label="CE(IIW)" r={results.ce} />
            <CalcCard label="Ms — Andrews" r={results.ms} />
            <CalcCard label="Md30 — Nohara" r={results.md30} />
          </div>

          <div className="wrc-and-lmp">
            <WrcDiagram
              creq={results.wrc.creq.value}
              nieq={results.wrc.nieq.value}
              inWindow={results.wrc.creq.inWindow}
            />
            <div className="calc-card lmp-card">
              <div className="calc-top">
                <span className="calc-label">
                  Larson-Miller <span className="prov computed">COMPUTED</span>
                </span>
                <span className="calc-value">
                  {results.lmp.inWindow ? results.lmp.value.toFixed(2) : "n/a"} <small>×10³ K</small>
                </span>
              </div>
              <div className="calc-formula mono">{results.lmp.formula}</div>
              <div className="lmp-inputs">
                <label>T (°C)
                  <input className="el-num mono" inputMode="decimal" value={state.lmp.tempC}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) update((s) => ({ ...s, lmp: { ...s.lmp, tempC: n } })); }} />
                </label>
                <label>t (h)
                  <input className="el-num mono" inputMode="decimal" value={state.lmp.hours}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) update((s) => ({ ...s, lmp: { ...s.lmp, hours: n } })); }} />
                </label>
                <label>C
                  <input className="el-num mono" inputMode="decimal" value={state.lmp.C}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) update((s) => ({ ...s, lmp: { ...s.lmp, C: n } })); }} />
                </label>
              </div>
              <div className="calc-src">
                {results.lmp.source.citation} — {results.lmp.source.note}
              </div>
            </div>
          </div>

          <h3 className="studio-h">Phase equilibrium — via ModelProvider (M3)</h3>
          <EquilibriumPanel comp={comp} />
        </div>
      </div>
    </>
  );
}
