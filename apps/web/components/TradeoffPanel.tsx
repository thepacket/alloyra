"use client";
import { useState } from "react";
import { weightSensitivity, type SensitivityCandidate, type DutyInput, type Weights, type RankResult } from "@alloyra/core";
import { LineChart } from "./charts/Line";
const COLORS = ["var(--fam-fe)", "var(--fam-al)", "var(--fam-ti)", "var(--fam-ni)", "var(--fam-cu)", "var(--straw)"];
const LABELS: Record<keyof Weights, string> = { strength: "Strength margin", corrosion: "Corrosion index", auditCleanliness: "Audit cleanliness" };
export function TradeoffPanel({ candidates, duty, weights }: {
  candidates: (SensitivityCandidate & { rank: RankResult })[]; duty: DutyInput; weights: Weights;
}) {
  const [axis, setAxis] = useState<keyof Weights>("strength");
  const [referenceId, setReferenceId] = useState("");
  const reference = candidates.find((c) => c.id === referenceId) ?? candidates[0];
  if (!reference || candidates.length < 2) return null;
  const slices = weightSensitivity(candidates, duty, weights, axis);
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? id;
  const ranges: { from: number; to: number; leaders: string[] }[] = [];
  for (const slice of slices) {
    const previous = ranges[ranges.length - 1];
    if (previous && previous.leaders.join("|") === slice.leaders.join("|")) previous.to = slice.weight;
    else ranges.push({ from: slice.weight, to: slice.weight, leaders: slice.leaders });
  }
  return <details className="tradeoff-panel">
    <summary>Trade-offs &amp; weight sensitivity</summary>
    <div className="tradeoff-content">
      <label className="inline-label">Compare against <select className="hdr-select" aria-label="Trade-off reference" value={reference.id} onChange={(e) => setReferenceId(e.target.value)}>
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      <ul className="tradeoff-list">{candidates.filter((c) => c.id !== reference.id).map((c) => {
        const facts = c.facts, ref = reference.facts;
        const yieldComparable = facts.yieldMPa !== undefined && ref.yieldMPa !== undefined && facts.yieldTestTempC !== undefined && facts.yieldTestTempC === ref.yieldTestTempC;
        const yieldDelta = yieldComparable ? facts.yieldMPa! - ref.yieldMPa! : undefined;
        const delta = c.rank.coveragePercent - reference.rank.coveragePercent;
        const advantages = c.rank.contributions.flatMap((p) => {
          const rp = reference.rank.contributions.find((v) => v.criterion === p.criterion);
          if (!p.included || !rp?.included || p.weight === 0 || Math.abs(p.raw - rp.raw) < 0.005) return [];
          return [`${p.label}: ${p.raw > rp.raw ? "higher" : "lower"} normalized contribution (${p.raw.toFixed(2)} vs ${rp.raw.toFixed(2)})`];
        });
        return <li key={c.id}><strong>{c.name}:</strong> {yieldDelta === undefined ? "Yield records cannot be directly compared at a common test temperature." : `${yieldDelta === 0 ? "Same" : yieldDelta > 0 ? "Higher" : "Lower"} recorded yield${yieldDelta === 0 ? "" : ` by ${Math.abs(yieldDelta).toFixed(0)} MPa`} at ${facts.yieldTestTempC} °C.`} {delta === 0 ? "Same input coverage." : `${delta > 0 ? "Higher" : "Lower"} input coverage by ${Math.abs(delta).toFixed(0)} percentage points.`}
          {advantages.length > 0 && <p>{advantages.join("; ")}.</p>}
          {c.rank.eliminated && <p className="calc-warn">Eliminated: {c.rank.eliminationReasons.join("; ")}</p>}
        </li>;
      })}</ul>
      <label className="inline-label">Vary weight <select className="hdr-select" aria-label="Sensitivity criterion" value={axis} onChange={(e) => setAxis(e.target.value as keyof Weights)}>
        {Object.entries(LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select></label>
      <LineChart series={candidates.map((c, i) => ({ name: c.name, color: COLORS[i % COLORS.length]!, points: slices.flatMap((s) => {
        const result = s.results.find((v) => v.id === c.id)!;
        return Number.isFinite(result.score) && !result.eliminated ? [{ x: s.weight, y: result.score }] : [];
      }) })).filter((s) => s.points.length > 0)} xLabel={`${LABELS[axis]} weight`} yLabel="Available-criteria performance" yMin={0} yMax={100} height={240} yFmt={(v) => v.toFixed(1)} hoverHint="hover to read performance at a weight"
        footnote="One weight varies from 0 to 2; other weights and model inputs stay fixed. Partial scores are diagnostic, not rankings. Pins are manual overrides and do not change these curves. Transition intervals are sampled, not exact crossover points." />
      <ul className="sensitivity-ranges">{ranges.map((range, i) => <li key={i}>Weight {range.from.toFixed(3)}{range.to !== range.from ? `–${range.to.toFixed(3)}` : ""}: {range.leaders.length ? `highest complete score: ${range.leaders.map(nameOf).join(" / ")}` : "no preferred candidate inferred — incomplete evidence or no eligible candidate"}.</li>)}</ul>
    </div>
  </details>;
}
