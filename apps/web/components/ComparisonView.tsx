"use client";

import { useEffect, useMemo, useState } from "react";
import {
  alloys,
  candidateFacts,
  DATASET_VERSION,
  RULESET_VERSION,
} from "@alloyra/data";
import {
  evaluateRules,
  midpointComposition,
  pren,
  rankCandidate,
  type RuleAudit,
  type Weights,
} from "@alloyra/core";
import { dutyFromProfile, loadProfiles, type DutyProfile } from "../lib/profiles";
import { activeRules, emptyOverlay, loadOverlay, rulesetLabel, type RuleOverlay } from "../lib/rules";
import { ProvenanceChip } from "./ProvenanceChip";

/** One comparison slot: an alloy IN a condition, plus expert overrides (R-3.4). */
interface Slot {
  uns: string;
  conditionId: string;
  pinned: boolean;
  excluded: boolean;
}

interface StoredComparison {
  profileId: string | null;
  slots: Slot[];
  weights: Weights;
  /** Append-only audit trail of expert overrides (R-3.4). */
  overrideLog: string[];
  datasetVersion: string;
  rulesetVersion: string;
}

const STORE = "alloyra.comparison.v1";
const MAX_SLOTS = 6;

const defaultStored = (): StoredComparison => ({
  profileId: null,
  slots: [],
  weights: { strength: 1, corrosion: 1, auditCleanliness: 1 },
  overrideLog: [],
  datasetVersion: DATASET_VERSION,
  rulesetVersion: RULESET_VERSION,
});

function loadStored(): StoredComparison {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultStored();
    return { ...defaultStored(), ...(JSON.parse(raw) as StoredComparison) };
  } catch {
    return defaultStored();
  }
}

const sevRank = { disqualifying: 0, serious: 1, caution: 2 } as const;

function AuditList({ audits }: { audits: RuleAudit[] }) {
  const flagged = audits
    .filter((a) => a.status !== "clear")
    .sort(
      (a, b) =>
        (a.status === "near" ? 1 : 0) - (b.status === "near" ? 1 : 0) ||
        sevRank[a.rule.severity] - sevRank[b.rule.severity],
    );
  const unchecked = [...new Set(audits.flatMap((a) => a.unchecked))];
  if (flagged.length === 0 && unchecked.length === 0) {
    return <div className="audit-clear">No rule hits for this duty</div>;
  }
  return (
    <div className="audit-list">
      {flagged.map((a) => (
        <div
          key={a.rule.id}
          className={`audit-hit ${a.status === "near" ? "near" : a.rule.severity}`}
          title={`${a.rule.mechanism}\n\nBecause: ${a.because.join("; ")}\n\nMitigations: ${a.rule.mitigations.join("; ")}\n\nSource: ${a.rule.citation}`}
        >
          <span className="sev-tag">
            {a.status === "near" ? "NEAR" : a.rule.severity.toUpperCase()}
          </span>
          {a.rule.name}
        </div>
      ))}
      {unchecked.length > 0 && (
        <div className="audit-unchecked" title={unchecked.join(", ")}>
          Could not check: {unchecked.join("; ")}
        </div>
      )}
    </div>
  );
}

export function ComparisonView() {
  const [stored, setStored] = useState<StoredComparison>(defaultStored());
  const [profiles, setProfiles] = useState<DutyProfile[]>([]);
  const [overlay, setOverlay] = useState<RuleOverlay>(emptyOverlay());
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    setStored(loadStored());
    setProfiles(loadProfiles());
    setOverlay(loadOverlay());
    setLoaded(true);
  }, []);

  const rules = useMemo(() => activeRules(overlay), [overlay]);

  const update = (mut: (s: StoredComparison) => StoredComparison) => {
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

  const profile = profiles.find((p) => p.id === stored.profileId);
  const duty = profile ? dutyFromProfile(profile) : null;

  const rows = useMemo(() => {
    return stored.slots.flatMap((slot) => {
      const alloy = alloys.find((a) => a.uns === slot.uns);
      const condition = alloy?.conditions.find((c) => c.id === slot.conditionId);
      if (!alloy || !condition) return [];
      const facts = candidateFacts(alloy, condition);
      const audits = duty ? evaluateRules(facts, duty, rules) : [];
      const rank = duty ? rankCandidate(facts, duty, audits, stored.weights) : null;
      const p = pren(midpointComposition(alloy.composition));
      return [{ slot, alloy, condition, facts, audits, rank, pren: p.inWindow ? p.value : null }];
    });
  }, [stored.slots, stored.weights, duty, rules]);

  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.slot.excluded !== b.slot.excluded) return a.slot.excluded ? 1 : -1;
      if (a.slot.pinned !== b.slot.pinned) return a.slot.pinned ? -1 : 1;
      const ae = a.rank?.eliminated ? 1 : 0;
      const be = b.rank?.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;
      return (b.rank?.score ?? 0) - (a.rank?.score ?? 0);
    });
  }, [rows]);

  const addCandidate = (key: string) => {
    const [uns, conditionId] = key.split("|");
    if (!uns || !conditionId) return;
    update((s) => {
      if (s.slots.length >= MAX_SLOTS) return s;
      if (s.slots.some((x) => x.conditionId === conditionId)) return s;
      return {
        ...s,
        slots: [...s.slots, { uns, conditionId, pinned: false, excluded: false }],
      };
    });
    setAdding("");
  };

  const override = (conditionId: string, field: "pinned" | "excluded") => {
    update((s) => {
      const slots = s.slots.map((x) =>
        x.conditionId === conditionId ? { ...x, [field]: !x[field] } : x,
      );
      const slot = slots.find((x) => x.conditionId === conditionId);
      const log = `${new Date().toISOString()} — ${field === "pinned" ? (slot?.pinned ? "pinned" : "unpinned") : slot?.excluded ? "excluded" : "re-included"} ${conditionId}`;
      return { ...s, slots, overrideLog: [...s.overrideLog, log] };
    });
  };

  const remove = (conditionId: string) =>
    update((s) => ({
      ...s,
      slots: s.slots.filter((x) => x.conditionId !== conditionId),
      overrideLog: [...s.overrideLog, `${new Date().toISOString()} — removed ${conditionId}`],
    }));

  const setWeight = (k: keyof Weights, v: number) =>
    update((s) => ({ ...s, weights: { ...s.weights, [k]: v } }));

  if (!loaded) return null;

  return (
    <>
      <div className="pane-header">
        <h1>Comparison</h1>
        <span className="count">
          rules {rulesetLabel(overlay)} · data {DATASET_VERSION}
        </span>
        <span style={{ flex: 1 }} />
        <label className="inline-label" htmlFor="cmp-profile">Duty profile</label>
        <select
          id="cmp-profile"
          className="hdr-select"
          value={stored.profileId ?? ""}
          onChange={(e) =>
            update((s) => ({ ...s, profileId: e.target.value || null }))
          }
        >
          <option value="">— none selected —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (v{p.version})
            </option>
          ))}
        </select>
        <select
          className="hdr-select"
          value={adding}
          onChange={(e) => addCandidate(e.target.value)}
          disabled={stored.slots.length >= MAX_SLOTS}
        >
          <option value="">+ Add candidate…</option>
          {alloys.flatMap((a) =>
            a.conditions.map((c) => (
              <option
                key={c.id}
                value={`${a.uns}|${c.id}`}
                disabled={stored.slots.some((x) => x.conditionId === c.id)}
              >
                {a.names[0]} — {c.name}
              </option>
            )),
          )}
        </select>
      </div>

      <div className="weights-bar">
        <span className="wlabel">Score weights (R-3.1 — yours to set):</span>
        {(
          [
            ["strength", "Strength margin"],
            ["corrosion", "Corrosion index"],
            ["auditCleanliness", "Audit cleanliness"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="weight">
            {label}
            <input
              type="range"
              min={0}
              max={2}
              step={0.25}
              value={stored.weights[k]}
              onChange={(e) => setWeight(k, Number(e.target.value))}
            />
            <span className="mono">{stored.weights[k].toFixed(2)}</span>
          </label>
        ))}
      </div>

      {!profile && (
        <div className="empty-state">
          <span className="phase-tag">NO DUTY SELECTED</span>
          <span className="t">Pick a duty profile to audit against</span>
          <span className="d">
            Candidates can be added now, but scores and the failure audit need a
            duty. Create one under Duty profiles if the list is empty.
          </span>
        </div>
      )}

      {profile && ordered.length === 0 && (
        <div className="empty-state">
          <span className="phase-tag">EMPTY COMPARISON</span>
          <span className="t">Add up to {MAX_SLOTS} candidates</span>
          <span className="d">
            Each candidate is an alloy in a specific condition — 7075-T651 and
            7075-T7351 are different answers to this duty.
          </span>
        </div>
      )}

      {profile && ordered.length > 0 && (
        <div className="cmp-scroll">
          <div className="cmp-grid" style={{ gridTemplateColumns: `160px repeat(${ordered.length}, minmax(210px, 1fr))` }}>
            {/* Header row */}
            <div className="cmp-corner" />
            {ordered.map(({ slot, alloy, condition, rank }) => (
              <div key={condition.id} className={`cmp-head ${slot.excluded ? "excluded" : ""} ${rank?.eliminated ? "eliminated" : ""}`}>
                <div className="cmp-name">
                  {alloy.names[0]}
                  {slot.pinned && <span className="pin-flag" title="Pinned by you">PINNED</span>}
                </div>
                <div className="cmp-cond">{condition.name} · <span className="mono">{alloy.uns}</span></div>
                <div className="cmp-actions">
                  <button type="button" className="mini" onClick={() => override(condition.id, "pinned")}>
                    {slot.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" className="mini" onClick={() => override(condition.id, "excluded")}>
                    {slot.excluded ? "Include" : "Exclude"}
                  </button>
                  <button type="button" className="mini" onClick={() => remove(condition.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="cmp-rowlabel">Score</div>
            {ordered.map(({ slot, condition, rank }) => (
              <div key={condition.id} className={`cmp-cell score ${slot.excluded ? "excluded" : ""}`}>
                {slot.excluded ? (
                  <span className="elim">Excluded by you</span>
                ) : rank?.eliminated ? (
                  <div className="elim" title={rank.eliminationReasons.join("\n")}>
                    ELIMINATED
                    {rank.eliminationReasons.map((r) => (
                      <div className="elim-reason" key={r}>{r}</div>
                    ))}
                  </div>
                ) : rank ? (
                  <>
                    <span className="score-num">{rank.score.toFixed(0)}</span>
                    <div className="score-bar"><span style={{ width: `${Math.max(0, Math.min(100, rank.score))}%` }} /></div>
                    <table className="breakdown">
                      <tbody>
                        {rank.contributions.map((c) => (
                          <tr key={c.criterion} title={c.note}>
                            <td>{c.label}</td>
                            <td className="mono">{c.raw.toFixed(2)} × {c.weight.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </div>
            ))}

            <div className="cmp-rowlabel">σy (MPa)</div>
            {ordered.map(({ condition, facts }) => {
              const rec = condition.properties.find((p) => p.property === "yield_strength");
              return (
                <div key={condition.id} className="cmp-cell num">
                  {facts.yieldMPa !== undefined && rec ? (
                    <>
                      <span className="mono">{facts.yieldMPa}</span>{" "}
                      <ProvenanceChip p={rec.provenance} title={rec.source} />
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              );
            })}

            <div className="cmp-rowlabel">UTS (MPa)</div>
            {ordered.map(({ condition }) => {
              const rec = condition.properties.find((p) => p.property === "tensile_strength");
              return (
                <div key={condition.id} className="cmp-cell num">
                  {rec ? (
                    <>
                      <span className="mono">{rec.value}</span>{" "}
                      <ProvenanceChip p={rec.provenance} title={rec.source} />
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              );
            })}

            <div className="cmp-rowlabel">PREN <span className="prov computed">C</span></div>
            {ordered.map(({ condition, pren: p }) => (
              <div key={condition.id} className="cmp-cell num mono">
                {p === null ? "n/a" : p.toFixed(1)}
              </div>
            ))}

            <div className="cmp-rowlabel">Failure audit</div>
            {ordered.map(({ condition, audits }) => (
              <div key={condition.id} className="cmp-cell">
                <AuditList audits={audits} />
              </div>
            ))}
          </div>

          <div className="cmp-foot">
            Flags inform expert judgment — Alloyra never claims a part is safe
            or will fail (R-5.4). Hover any flag for mechanism, evidence, and
            mitigations. Overrides are logged ({stored.overrideLog.length} so far).
          </div>
        </div>
      )}
    </>
  );
}
