"use client";
import { useEffect, useRef } from "react";
import type { RuleAudit, RankResult } from "@alloyra/core";
import type { Condition } from "@alloyra/data";
export function CandidateEvidence({ name, condition, audits, rank, onClose }: {
  name: string; condition: Condition; audits: readonly RuleAudit[]; rank: RankResult | null; onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); return () => previous?.focus(); }, []);
  return <aside ref={ref} tabIndex={-1} className="candidate-evidence" aria-label={`Evidence for ${name}`} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
    <div className="evidence-heading"><h2>{name}</h2><button className="btn ghost" onClick={onClose}>Close evidence</button></div>
    <p>{condition.name} · {condition.form}</p>
    {condition.note && <p className="record-source">{condition.note}</p>}
    <h3>Property records</h3>
    {condition.properties.map((p, i) => <p key={i}><strong>{p.property.replace(/_/g, " ")}: {p.value} {p.unit}</strong><br />Tested at {p.testTempC} °C · {p.provenance}<br />{p.source}{p.note ? ` — ${p.note}` : ""}</p>)}
    <h3>Scoring assumptions</h3>
    {rank?.contributions.map((c) => <p key={c.criterion}><strong>{c.label}</strong><br />{c.note}</p>)}
    <h3>Rule evidence</h3>
    {audits.length === 0 && <p>No rules ran. Coverage is unassessed.</p>}
    {audits.map((a) => <details key={a.rule.id} open={a.status !== "clear"}>
      <summary>{a.status.toUpperCase()} · {a.rule.name} · {a.rule.reviewStatus}</summary>
      <p>{a.rule.mechanism}</p><p><strong>Basis:</strong> {a.rule.thresholdBasis ?? "No threshold basis supplied."}</p>
      {a.because.length > 0 && <p><strong>Matched:</strong> {a.because.join("; ")}</p>}
      {a.unchecked.length > 0 && <p><strong>Missing:</strong> {a.unchecked.join("; ")}</p>}
      <p><strong>Mitigations:</strong> {a.rule.mitigations.join("; ") || "None supplied."}</p>
      <p><strong>Source:</strong> {a.rule.citation}</p>
      {a.rule.review && <p>Reviewed by {a.rule.review.reviewer}, {a.rule.review.date}. {a.rule.review.notes}</p>}
    </details>)}
  </aside>;
}
