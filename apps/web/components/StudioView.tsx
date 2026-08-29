"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { alloys, DATASET_VERSION } from "@alloyra/data";
import { EquilibriumPanel } from "./EquilibriumPanel";
import { SweepSpark, type SweepPoint } from "./charts/SweepSpark";
import { LineChart } from "./charts/Line";
import {
  MATRIX_CONSTANTS,
  ashbyOrowan,
  astmToMicrons,
  ceIIW,
  elementCost,
  hallPetch,
  hollomon,
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
import type { SweepPoint as SP } from "./charts/SweepSpark";

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

// Alloyra ships NO price data (professional-data rule, 2026-08-28): prices
// are volatile, contract-specific procurement facts. The table starts empty
// and is user-owned (R-4.5); the roll-up stays honest ("unpriced") until
// the user enters their figures.

interface StudioState {
  baseUns: string;
  comp: Partial<Record<ElementSymbol, number>>;
  prices: Partial<Record<ElementSymbol, number>>;
  lmp: { tempC: number; hours: number; C: number };
  /** Strengthening-model inputs (B-105/B-107) — user-owned, cited seeds. */
  strength: {
    /** ASTM E112 grain-size number; null = unknown (honesty default). */
    grainAstm: number | null;
    hp: { sigma0: number; ky: number };
    holl: { K: number; n: number };
    orowan: { fPct: number; dNm: number; matrix: string; G: number; b: number };
  };
}

function defaultStrength(): StudioState["strength"] {
  const al = MATRIX_CONSTANTS.Al!;
  return {
    grainAstm: null,
    // Literature-typical ferritic-steel seeds (Hall 1951/Petch 1953 lineage) —
    // user-owned, verify for your alloy class.
    hp: { sigma0: 70, ky: 600 },
    // Annealed-austenitic-like fit seeds (Dieter ch. 8 order of magnitude).
    holl: { K: 1400, n: 0.45 },
    orowan: { fPct: 2, dNm: 10, matrix: "Al", G: al.shearModulusGPa, b: al.burgersNm },
  };
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
    prices: {},
    lmp: { tempC: 600, hours: 100_000, C: 20 },
    strength: defaultStrength(),
  };
}

function loadState(): StudioState {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as StudioState;
    return {
      ...defaultState(),
      ...parsed,
      strength: { ...defaultStrength(), ...(parsed.strength ?? {}) },
    };
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

function CalcCard({
  label,
  r,
  spark,
}: {
  label: string;
  r: CalcResult;
  spark?: React.ReactNode;
}) {
  return (
    <div className={`calc-card ${r.inWindow ? "" : "out"}`}>
      <div className="calc-top">
        <span className="calc-label">
          {label} <span className="prov computed">COMPUTED</span>
        </span>
        <span className="calc-value">
          {r.missing?.length
            ? "unknown"
            : r.inWindow
              ? `${r.value.toFixed(1)}${r.unit ? ` ${r.unit}` : ""}`
              : "n/a"}
        </span>
      </div>
      <div className="calc-formula mono">{r.formula}</div>
      {spark}
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
  /** "Compute all" trigger, registered by the equilibrium panel. */
  const runAllRef = useRef<(() => void) | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [addSel, setAddSel] = useState("");
  const [sweepSel, setSweepSel] = useState<ElementSymbol | "">("");

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
      md30: md30Nohara(
        comp,
        state.strength.grainAstm != null
          ? { grainSizeAstm: state.strength.grainAstm }
          : undefined,
      ),
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
  }, [comp, bal, state.lmp, state.prices, state.strength.grainAstm]);

  // Strengthening models (B-105): user-owned parameters, cited seeds; each
  // card sweeps its own governing variable so no value stands naked.
  const st = state.strength;
  const dUm = st.grainAstm != null ? astmToMicrons(st.grainAstm) : undefined;
  const hpRes =
    dUm !== undefined
      ? hallPetch({ dUm, sigma0MPa: st.hp.sigma0, kyMPaSqrtUm: st.hp.ky })
      : undefined;
  const hpSweep: SP[] = [];
  for (let i = 0; i <= 40; i++) {
    const d = 1 + (i / 40) * 119; // 1–120 µm
    const r = hallPetch({ dUm: d, sigma0MPa: st.hp.sigma0, kyMPaSqrtUm: st.hp.ky });
    hpSweep.push({ x: d, value: r.value, inWindow: r.inWindow });
  }
  const hol = hollomon({ kMPa: st.holl.K, n: st.holl.n });
  const holSweep: SP[] = [];
  {
    const eMax = Math.min(0.7, Math.max(0.1, st.holl.n * 1.6));
    for (let i = 1; i <= 40; i++) {
      const e = (i / 40) * eMax;
      holSweep.push({
        x: e,
        value: hol.flowStress(e),
        // Beyond ε_u = n the specimen necks — the curve is extrapolation.
        inWindow: e <= st.holl.n,
      });
    }
  }
  const orRes = ashbyOrowan({
    volumeFraction: st.orowan.fPct / 100,
    particleDiameterNm: st.orowan.dNm,
    shearModulusGPa: st.orowan.G,
    burgersNm: st.orowan.b,
  });
  const orSweep: SP[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = 2 + (i / 40) * 58; // 2–60 nm
    const r = ashbyOrowan({
      volumeFraction: st.orowan.fPct / 100,
      particleDiameterNm: x,
      shearModulusGPa: st.orowan.G,
      burgersNm: st.orowan.b,
    });
    orSweep.push({ x, value: r.value, inWindow: r.inWindow });
  }
  const setStrength = (mut: (s: StudioState["strength"]) => StudioState["strength"]) =>
    update((s) => ({ ...s, strength: mut(s.strength) }));

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
      `<tr><td>${label}</td><td>${r.missing?.length ? `unknown (missing: ${r.missing.join(", ")})` : r.inWindow ? `${r.value.toFixed(1)} ${r.unit}` : "n/a (out of validity window)"}</td><td><code>${r.formula}</code></td><td>${r.source.citation}</td><td>${r.warnings.join("; ") || "—"}</td></tr>`;
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
${calcRow(`LMP @ ${state.lmp.tempC} °C / ${state.lmp.hours} h (C=${state.lmp.C})`, results.lmp)}
${hpRes ? calcRow(`Hall-Petch σy (ν=${st.grainAstm}, σ0=${st.hp.sigma0}, k_y=${st.hp.ky})`, hpRes) : ""}
${calcRow(`Hollomon UTS (K=${st.holl.K} MPa, n=${st.holl.n})`, hol.utsEng)}
${calcRow(`Ashby-Orowan Δσ (f=${st.orowan.fPct} vol%, X=${st.orowan.dNm} nm, ${st.orowan.matrix})`, orRes)}</table>
<h2>Nearest standard grades (composition conformance only — not product qualification)</h2>
<table><tr><th>Grade</th><th>Conforms to ranges?</th><th>Violations (normalized distance)</th></tr>
${results.matches.map((m) => `<tr><td>${m.name} (${m.uns})</td><td>${m.conforms ? "yes" : `no (Σ ${m.distance.toFixed(2)})`}</td><td>${m.violations.slice(0, 5).map((v) => `${v.element}: ${v.detail}`).join("; ") || "—"}</td></tr>`).join("")}</table>
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

  // Sweep sparklines (B-206): every calculator drawn against one element's
  // content, current composition marked — no naked numbers.
  const sweepEl: ElementSymbol | undefined = editableElements.includes(
    sweepSel as ElementSymbol,
  )
    ? (sweepSel as ElementSymbol)
    : editableElements.includes("Cr")
      ? "Cr"
      : editableElements[0];
  const sweepFor = (calc: (c: Composition) => CalcResult): SweepPoint[] => {
    if (!sweepEl) return [];
    const max = sliderMax(sweepEl, state.baseUns);
    const entries = (Object.entries(state.comp) as [ElementSymbol, number][]).filter(
      ([el]) => el !== bal,
    );
    const pts: SweepPoint[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * max;
      const c: Composition = {};
      let sum = 0;
      for (const [el, v] of entries) {
        const val = el === sweepEl ? x : v;
        // The swept element is a known value even at 0; others follow the
        // studio rule (0 slider = not entered).
        if (el === sweepEl || val > 0) {
          c[el] = val;
          sum += val;
        }
      }
      if (bal) c[bal] = Number(Math.max(0, 100 - sum).toFixed(3));
      const r = calc(c);
      pts.push({
        x,
        value: r.missing?.length ? undefined : r.value,
        inWindow: r.inWindow,
      });
    }
    return pts;
  };
  const sweeps = sweepEl
    ? {
        pren: sweepFor((c) => pren(c)),
        ce: sweepFor((c) => ceIIW(c)),
        ms: sweepFor((c) => msAndrews(c)),
        md30: sweepFor((c) => md30Nohara(c)),
      }
    : undefined;
  const currentSweepX = sweepEl ? (state.comp[sweepEl] ?? 0) : 0;

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
        <button
          type="button"
          className="btn"
          title="Run every engine computation for the current composition IN PARALLEL — point equilibrium, property diagram, Scheil, and the isopleth map each get their own worker/core. Sections fill in as they finish; the isopleth map is the long pole at minutes."
          onClick={() => {
            runAllRef.current?.();
            document.querySelector(".eq-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Compute all
        </button>
        <button type="button" className="btn" onClick={exportStudy}>
          Export study
        </button>
      </div>

      <div className="split">
        <div className="studio-left">
          <h2 className="studio-h">Composition (wt %) — seeded at mid-spec, residuals at half-max</h2>
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
                  aria-label={`${el} content, numeric entry (wt%)`}
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
              aria-label="Add composition element"
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

          <h2 className="studio-h">Element prices — Alloyra ships no price data; enter your procurement figures (R-4.5)</h2>
          <div className="price-grid">
            {(Object.keys(comp) as ElementSymbol[]).map((el) => (
              <label className="price-item" key={el}>
                <span className="mono">{el}</span>
                <input
                  className="el-num mono"
                  inputMode="decimal"
                  value={state.prices[el] ?? ""}
                  placeholder="—"
                  aria-label={`${el} price per kilogram`}
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
          <div className="storage-note">
            Studio session and prices are saved in this browser only — Export
            study produces the shareable record.
          </div>
          <div className="cost-line">
            {Object.values(state.prices).every((v) => v === undefined) ? (
              <span className="calc-warn">
                No prices entered — cost roll-up inactive until you provide
                procurement figures.
              </span>
            ) : (
              <>
                ≈ <span className="mono">{results.cost.perKg.toFixed(2)}</span> /kg raw-element basis
                {results.cost.unpriced.length > 0 && (
                  <span className="calc-warn"> · unpriced: {results.cost.unpriced.join(", ")}</span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="studio-right">
          <h2 className="studio-h">Nearest standard grades — spec conformance first (R-4.4)</h2>
          <div className="match-row">
            {results.matches.map((m, i) => (
              <div className={`match ${i === 0 ? "best" : ""}`} key={m.uns}>
                <div className="match-name">{m.name} <span className="mono dim">{m.uns}</span></div>
                {m.conforms ? (
                  <div className="match-conforms">WITHIN SPEC RANGES</div>
                ) : (
                  <div className="match-dist mono">outside spec · Σ norm. dist {m.distance.toFixed(2)}</div>
                )}
                {i === 0 && !m.conforms && (
                  <div className="match-deltas mono">
                    {m.violations.slice(0, 3).map((v) => (
                      <span key={v.element}>{v.element}: {v.detail}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="calc-src">
            Composition conformance only — meeting the ranges is NOT product
            qualification (melt practice, condition, testing, certification
            all remain).
          </div>

          <div className="studio-h sweep-head">
            <span>Derived quantities — greyed means outside the model's validated window (R-4.3)</span>
            <label className="sweep-pick">
              sweep vs
              <select
                className="hdr-select"
                value={sweepEl ?? ""}
                onChange={(e) => setSweepSel(e.target.value as ElementSymbol | "")}
                aria-label="Element to sweep in calculator sparklines"
              >
                {editableElements.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="calc-grid">
            <CalcCard
              label="PREN"
              r={results.pren}
              spark={sweeps && sweepEl && <SweepSpark points={sweeps.pren} currentX={currentSweepX} element={sweepEl} />}
            />
            <CalcCard
              label="CE(IIW)"
              r={results.ce}
              spark={sweeps && sweepEl && <SweepSpark points={sweeps.ce} currentX={currentSweepX} element={sweepEl} />}
            />
            <CalcCard
              label="Ms — Andrews"
              r={results.ms}
              spark={sweeps && sweepEl && <SweepSpark points={sweeps.ms} currentX={currentSweepX} element={sweepEl} />}
            />
            <CalcCard
              label="Md30 — Nohara"
              r={results.md30}
              spark={sweeps && sweepEl && <SweepSpark points={sweeps.md30} currentX={currentSweepX} element={sweepEl} />}
            />
          </div>

          <h2 className="studio-h">
            Strengthening models — mechanism calculators with user-owned parameters (B-105)
          </h2>
          <div className="strength-inputs">
            <label className="sweep-pick">
              grain size ν (ASTM E112)
              <input
                className="el-num mono"
                inputMode="decimal"
                value={st.grainAstm ?? ""}
                placeholder="—"
                aria-label="Grain size, ASTM E112 number"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setStrength((x) => ({
                    ...x,
                    grainAstm: e.target.value === "" || !Number.isFinite(n) ? null : n,
                  }));
                }}
              />
            </label>
            <span className="calc-src">
              {dUm !== undefined
                ? `≈ ${dUm.toFixed(1)} µm mean diameter — feeds Hall-Petch and the Md30 grain-size term.`
                : "Unknown until you enter it (never assumed) — feeds Hall-Petch and the Md30 grain-size term."}
            </span>
          </div>
          <div className="calc-grid">
            {hpRes ? (
              <CalcCard
                label="Hall-Petch σy"
                r={hpRes}
                spark={<SweepSpark points={hpSweep} currentX={dUm ?? 0} element="d" unit="µm" />}
              />
            ) : (
              <div className="calc-card out">
                <div className="calc-top">
                  <span className="calc-label">
                    Hall-Petch σy <span className="prov computed">COMPUTED</span>
                  </span>
                  <span className="calc-value">unknown</span>
                </div>
                <div className="calc-formula mono">σy = σ0 + k_y·d^(−1/2)</div>
                <div className="calc-warn">Enter a grain size (ν) above to compute.</div>
              </div>
            )}
            <CalcCard
              label="Hollomon UTS + Considère"
              r={hol.utsEng}
              spark={<SweepSpark points={holSweep} currentX={st.holl.n} element="ε true" unit="(εu = n)" />}
            />
            <CalcCard
              label="Ashby-Orowan Δσ"
              r={orRes}
              spark={<SweepSpark points={orSweep} currentX={st.orowan.dNm} element="X" unit="nm" />}
            />
          </div>
          <div className="strength-params">
            <div className="lmp-inputs">
              <label>σ0 (MPa)
                <input className="el-num mono" inputMode="decimal" value={st.hp.sigma0} aria-label="Hall-Petch friction stress, MPa"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, hp: { ...x.hp, sigma0: n } })); }} />
              </label>
              <label>k_y (MPa·√µm)
                <input className="el-num mono" inputMode="decimal" value={st.hp.ky} aria-label="Hall-Petch locking parameter"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, hp: { ...x.hp, ky: n } })); }} />
              </label>
              <label>K (MPa)
                <input className="el-num mono" inputMode="decimal" value={st.holl.K} aria-label="Hollomon strength coefficient K, MPa"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, holl: { ...x.holl, K: n } })); }} />
              </label>
              <label>n
                <input className="el-num mono" inputMode="decimal" value={st.holl.n} aria-label="Hollomon strain-hardening exponent n"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, holl: { ...x.holl, n } })); }} />
              </label>
              <label>matrix
                <select className="hdr-select" value={st.orowan.matrix} aria-label="Orowan matrix (sets G and b seeds)"
                  onChange={(e) => {
                    const m = e.target.value;
                    const c = MATRIX_CONSTANTS[m];
                    setStrength((x) => ({
                      ...x,
                      orowan: c ? { ...x.orowan, matrix: m, G: c.shearModulusGPa, b: c.burgersNm } : { ...x.orowan, matrix: m },
                    }));
                  }}>
                  {Object.keys(MATRIX_CONSTANTS).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>f (vol %)
                <input className="el-num mono" inputMode="decimal" value={st.orowan.fPct} aria-label="Precipitate volume fraction, percent"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, orowan: { ...x.orowan, fPct: n } })); }} />
              </label>
              <label>X (nm)
                <input className="el-num mono" inputMode="decimal" value={st.orowan.dNm} aria-label="Mean particle diameter, nanometres"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, orowan: { ...x.orowan, dNm: n } })); }} />
              </label>
              <label>G (GPa)
                <input className="el-num mono" inputMode="decimal" value={st.orowan.G} aria-label="Shear modulus, GPa"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, orowan: { ...x.orowan, G: n } })); }} />
              </label>
              <label>b (nm)
                <input className="el-num mono" inputMode="decimal" value={st.orowan.b} aria-label="Burgers vector, nanometres"
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setStrength((x) => ({ ...x, orowan: { ...x.orowan, b: n } })); }} />
              </label>
            </div>
            <div className="calc-src">
              Parameters are yours: σ0/k_y are material-class fits, K/n come
              from a fit to your tensile data (uniform elongation ≈{" "}
              {Number.isFinite(hol.uniformElongationPct) ? hol.uniformElongationPct.toFixed(0) : "—"}{" "}
              % engineering at the current n), and G/b seeds are
              literature-typical for the chosen matrix. Increments do not add
              linearly — superposition is mechanism-dependent.
            </div>
          </div>

          <div className="flow-curve-panel">
            <span className="calc-label">
              Flow curve — Hollomon fit <span className="prov computed">COMPUTED</span>
            </span>
            <LineChart
              series={(() => {
                const K = st.holl.K;
                const n = Math.max(0.01, Math.min(0.6, st.holl.n));
                const pts = 40;
                const trueS: { x: number; y: number }[] = [];
                const engS: { x: number; y: number }[] = [];
                for (let i = 0; i <= pts; i++) {
                  const eTrue = 0.002 + (i / pts) * (n - 0.002);
                  const sTrue = K * eTrue ** n;
                  const eEng = (Math.exp(eTrue) - 1) * 100;
                  trueS.push({ x: eEng, y: sTrue });
                  engS.push({ x: eEng, y: sTrue * Math.exp(-eTrue) });
                }
                return [
                  { name: "σ true", color: "var(--viol)", points: trueS },
                  { name: "σ engineering", color: "var(--accent)", points: engS },
                ];
              })()}
              xLabel="engineering strain (%)"
              yLabel="stress (MPa)"
              height={240}
              yMin={0}
              yFmt={(y) => `${y.toFixed(0)} MPa`}
              hoverHint="hover to read stress at a strain"
              footnote={`σ_true = K·ε^n with YOUR K = ${st.holl.K} MPa, n = ${st.holl.n} (fit constants, not measurements). Drawn over the UNIFORM range only — the curve ends at the Considère point ε_true = n (necking onset); post-necking response is not modeled. Engineering curve: σ_eng = σ_true·e^(−ε_true).`}
            />
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
              {results.lmp.inWindow && (
                <LineChart
                  series={[
                    {
                      name: "iso-LMP",
                      color: "var(--straw)",
                      points: (() => {
                        const P = results.lmp.value * 1000;
                        const C = state.lmp.C;
                        const out: { x: number; y: number }[] = [];
                        for (let tC = 400; tC <= 900; tC += 10) {
                          const logT = P / (tC + 273.15) - C;
                          if (logT >= 0 && logT <= 7) out.push({ x: tC, y: logT });
                        }
                        return out;
                      })(),
                    },
                  ]}
                  xLabel="T (°C)"
                  yLabel="log₁₀ t (h)"
                  height={200}
                  yFmt={(y) => `10^${y.toFixed(1)} h ≈ ${(10 ** y).toPrecision(2)} h`}
                  hoverHint="hover to read the equivalent life at a temperature"
                  footnote={`Time-temperature combinations sharing the current LMP = ${results.lmp.value.toFixed(2)}×10³ K (C = ${state.lmp.C}). The LMP EQUIVALENCE is the master-curve axis; it says nothing about the stress this parameter was reached at — pair it with rupture data for the specific alloy.`}
                />
              )}
            </div>
          </div>

          <h2 className="studio-h">Phase equilibrium — in-browser CALPHAD engine</h2>
          <EquilibriumPanel
            comp={comp}
            onRegisterRunAll={(fn) => {
              runAllRef.current = fn;
            }}
          />
        </div>
      </div>
    </>
  );
}
