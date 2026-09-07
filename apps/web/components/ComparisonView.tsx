"use client";
import { recordedPostMessage, terminateRecordedWorker } from "../lib/calculationHistory";

import { setStudyItem } from "../lib/workspace";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  alloys,
  candidateFacts,
  DATASET_VERSION,
} from "@alloyra/data";
import {
  evaluateRules,
  midpointComposition,
  prenForFamily,
  rankCandidate,
  type ExtraCriterion,
  type RuleAudit,
  type Weights,
} from "@alloyra/core";
import type { EngineResponse } from "../workers/calphadEngine.worker";
import { ENGINE_DBS, baseHint, engineDbForBase, scheilStartCFor } from "../lib/engine";
import { TradeoffPanel } from "./TradeoffPanel";
import { CandidateEvidence } from "./CandidateEvidence";
import { LineChart } from "./charts/Line";
import {
  dutyFromProfile,
  loadProfiles,
  saveProfiles,
  type DutyProfile,
} from "../lib/profiles";
import Link from "next/link";
import { activeRules, effectiveRuleList, emptyOverlay, loadOverlay, rulesetLabel, type RuleOverlay } from "../lib/rules";
import { ProvenanceChip } from "./ProvenanceChip";

import { defaultStored, loadStored, saveComparison, EXAMPLE_PROFILE_NAME, EXAMPLE_SLOTS, exampleProfile, MAX_SLOTS, STUDY_CHANGED, type StoredComparison } from "../lib/comparison";

const sevRank = { disqualifying: 0, serious: 1, caution: 2 } as const;

/**
 * Solidification comparison (B-504 follow-through): per-candidate Scheil
 * via the in-browser engine, at MID-SPEC composition with max-only
 * elements at half-max (dropping them would flatter every candidate —
 * e.g. C ≤ 0.03 in 316L still shapes the solidification path). Elements
 * a grade's recorded spec does not mention are NOT modeled — absent
 * means unknown, never zero. One worker, candidates run sequentially,
 * each streaming its cooling progress live.
 */
interface ScheilSlotState {
  status: "queued" | "running" | "done" | "error";
  db?: string;
  error?: string;
  points: { tC: number; fractionSolid: number }[];
  result?: {
    liquidusC?: number;
    solidusC?: number;
    solidTotals: Record<string, number>;
    kouIndexK?: number;
    terminated: string;
    ms: number;
  };
}

/** Full mid-spec wt% including the balance element, plus the base metal. */
function scheilInput(
  alloy: (typeof alloys)[number],
): { wt: Record<string, number>; base: string } | null {
  const bal = alloy.composition.find((r) => r.balance)?.element;
  if (!bal) return null;
  const mid = midpointComposition(alloy.composition, { includeResidualsAtHalfMax: true });
  const wt: Record<string, number> = {};
  let sum = 0;
  for (const [el, v] of Object.entries(mid)) {
    if (typeof v === "number" && v > 0) {
      wt[el] = v;
      sum += v;
    }
  }
  wt[bal] = Math.max(0, 100 - sum);
  return { wt, base: bal.toUpperCase() };
}

function AuditList({ audits, rulesRan }: { audits: RuleAudit[]; rulesRan: number }) {
  if (rulesRan === 0) {
    return (
      <div className="audit-unchecked">
        Audit not run — no active rules (see the rule-status bar above).
      </div>
    );
  }
  const statusRank = { hit: 0, near: 1, indeterminate: 2 } as const;
  const flagged = audits
    .filter((a) => a.status !== "clear")
    .sort(
      (a, b) =>
        statusRank[a.status as keyof typeof statusRank] -
          statusRank[b.status as keyof typeof statusRank] ||
        sevRank[a.rule.severity] - sevRank[b.rule.severity],
    );
  const unchecked = [...new Set(audits.flatMap((a) => a.unchecked))];
  if (flagged.length === 0 && unchecked.length === 0) {
    return <div className="audit-unchecked">No hits among the active rules. This does not establish coverage of all failure modes for this family.</div>;
  }
  return (
    <div className="audit-list">
      {flagged.map((a) => (
        <div
          key={a.rule.id}
          className={`audit-hit ${a.status === "near" || a.status === "indeterminate" ? "near" : a.rule.severity}`}
          title={`${a.rule.mechanism}${a.rule.thresholdBasis ? `\n\nThreshold basis: ${a.rule.thresholdBasis}` : ""}\n\nBecause: ${a.because.join("; ")}${a.unchecked.length ? `\n\nInsufficient information: ${a.unchecked.join("; ")}` : ""}\n\nMitigations: ${a.rule.mitigations.join("; ")}\n\nSource: ${a.rule.citation}`}
        >
          <span className="sev-tag">
            {a.status === "near"
              ? "NEAR"
              : a.status === "indeterminate"
                ? "INSUFFICIENT INFO"
                : a.rule.severity.toUpperCase()}
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
  const [exampleRequested, setExampleRequested] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  // Solidification comparison: per-condition Scheil state (session-only —
  // minutes of compute are not silently trusted across dataset changes).
  const [scheil, setScheil] = useState<Record<string, ScheilSlotState>>({});
  const [scheilQueue, setScheilQueue] = useState(false);
  const scheilWorkerRef = useRef<Worker | null>(null);
  const scheilReqRef = useRef(0);

  useEffect(() => {
    setStored(loadStored());
    setProfiles(loadProfiles());
    setOverlay(loadOverlay());
    setExampleRequested(new URLSearchParams(window.location.search).get("example") === "seawater");
    setLoaded(true);
    const refresh = () => { setStored(loadStored()); setProfiles(loadProfiles()); };
    window.addEventListener(STUDY_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", refresh); };
  }, []);

  useEffect(() => () => terminateRecordedWorker(scheilWorkerRef.current), []);

  const rules = useMemo(
    () => activeRules(overlay, { includeDrafts: stored.includeDrafts }),
    [overlay, stored.includeDrafts],
  );
  const { draftCount, reviewedCount } = useMemo(() => {
    const enabled = effectiveRuleList(overlay).filter((e) => !e.disabled);
    return {
      draftCount: enabled.filter((e) => e.rule.reviewStatus === "draft").length,
      reviewedCount: enabled.filter(
        (e) => e.rule.reviewStatus === "expert-reviewed" || e.rule.reviewStatus === "validated",
      ).length,
    };
  }, [overlay]);

  const update = (mut: (s: StoredComparison) => StoredComparison) => {
    const next = mut(stored);
    setStored(next);
    setSaveError(!saveComparison(next));
  };

  const profile = profiles.find((p) => p.id === stored.profileId);
  const duty = profile ? dutyFromProfile(profile) : null;

  const rows = useMemo(() => {
    // Castability (Kou) is COMPARATIVE: raw = bestKou / ownKou over the
    // non-excluded candidates with a Scheil result, and the criterion only
    // participates once at least two candidates have one — a lone result
    // has nothing to be compared against.
    const kouOf = (conditionId: string): number | undefined => {
      const st = scheil[conditionId];
      return st?.status === "done" ? st.result?.kouIndexK : undefined;
    };
    const cohort = stored.slots
      .filter((s) => !s.excluded)
      .map((s) => kouOf(s.conditionId))
      .filter((k): k is number => k !== undefined);
    const bestKou = cohort.length >= 2 ? Math.min(...cohort) : undefined;

    return stored.slots.flatMap((slot) => {
      const alloy = alloys.find((a) => a.uns === slot.uns);
      const condition = alloy?.conditions.find((c) => c.id === slot.conditionId);
      if (!alloy || !condition) return [];
      const facts = candidateFacts(alloy, condition);
      const audits = duty ? evaluateRules(facts, duty, rules) : [];
      const kou = kouOf(slot.conditionId);
      const castable = bestKou !== undefined && kou !== undefined && !slot.excluded;
      const castability: ExtraCriterion = {
        id: "castability",
        label: "Castability (Kou)",
        raw: castable ? (kou === 0 ? 1 : bestKou / kou) : Number.NaN,
        weight: bestKou === undefined ? 0 : stored.castabilityWeight,
        note: castable
          ? `Kou index ${kou.toFixed(0)} K vs best ${bestKou.toFixed(0)} K in this comparison — raw = best/own. Comparative between these candidates only, from mid-spec Scheil (in-browser engine).`
          : kou === undefined
            ? "N/A — run the solidification comparison (Scheil row) to score this criterion."
            : "N/A — the Kou index is comparative; it needs at least two computed candidates.",
        included: castable,
      };
      const rank = duty
        ? rankCandidate(facts, duty, audits, stored.weights, [castability])
        : null;
      const p = prenForFamily(midpointComposition(alloy.composition), alloy.family);
      return [{ slot, alloy, condition, facts, audits, rank, castability, pren: p.inWindow ? p.value : null }];
    });
  }, [stored.slots, stored.weights, stored.castabilityWeight, duty, rules, scheil]);

  const resultSnapshot = JSON.stringify({ modelVersion: "alloyra-ranking-coverage-v1", inputs: { comparison: stored, duty, rules }, results: rows.map(({ alloy, condition, facts, audits, rank }) => ({ grade: alloy.names[0], condition: condition.name, conditionId: condition.id, facts, audits, rank })) });
  useEffect(() => { if (loaded) { try { setStudyItem("alloyra.comparisonResults.v1", resultSnapshot); } catch { /* Shell reports storage failure */ } } }, [loaded, resultSnapshot]);

  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.slot.excluded !== b.slot.excluded) return a.slot.excluded ? 1 : -1;
      if (a.slot.pinned !== b.slot.pinned) return a.slot.pinned ? -1 : 1;
      const ae = a.rank?.eliminated ? 1 : 0;
      const be = b.rank?.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;
      // Partial evidence must not win a ranking by dropping weak criteria.
      if (a.rank?.scoreComplete !== b.rank?.scoreComplete) return a.rank?.scoreComplete ? -1 : 1;
      return a.rank?.scoreComplete && b.rank?.scoreComplete ? b.rank.score - a.rank.score : 0;
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

  /** One candidate's Scheil run through the shared worker; resolves on done. */
  const runScheilOne = (
    conditionId: string,
    db: string,
    wt: Record<string, number>,
    startC: number,
  ) =>
    new Promise<void>((resolve) => {
      const worker = scheilWorkerRef.current!;
      const id = ++scheilReqRef.current;
      setScheil((s) => ({ ...s, [conditionId]: { status: "running", db, points: [] } }));
      const onMessage = (ev: MessageEvent<EngineResponse>) => {
        const d = ev.data;
        if (d.id !== id) return;
        if (d.kind === "scheil-progress") {
          const pt = { tC: d.point.tC, fractionSolid: d.point.fractionSolid };
          setScheil((s) => {
            const cur = s[conditionId];
            if (!cur) return s;
            return { ...s, [conditionId]: { ...cur, points: [...cur.points, pt] } };
          });
          return;
        }
        if (d.kind === "scheil-done") {
          worker.removeEventListener("message", onMessage);
          setScheil((s) => {
            const cur = s[conditionId] ?? { status: "running" as const, db, points: [] };
            return {
              ...s,
              [conditionId]:
                d.ok && d.result
                  ? { ...cur, status: "done", result: d.result }
                  : { ...cur, status: "error", error: d.error ?? "Scheil simulation failed." },
            };
          });
          resolve();
        }
      };
      worker.addEventListener("message", onMessage);
      recordedPostMessage(worker, {
        id,
        kind: "scheil",
        dbId: db,
        tdbUrl: `/tdb/${db}.tdb`,
        compositionWt: wt,
        tStartC: startC,
        dT: 5,
      });
    });

  const runSolidification = async () => {
    if (scheilQueue) return;
    if (typeof Worker === "undefined") return;
    if (!scheilWorkerRef.current) {
      scheilWorkerRef.current = new Worker(
        new URL("../workers/calphadEngine.worker.ts", import.meta.url),
      );
    }
    // Snapshot the runnable candidates now; excluded slots and finished
    // runs are skipped, coverage gaps are reported per-candidate.
    const targets: { conditionId: string; db: string; wt: Record<string, number>; startC: number }[] = [];
    for (const row of rows) {
      const { slot, alloy } = row;
      if (slot.excluded) continue;
      const st = scheil[slot.conditionId];
      if (st && (st.status === "done" || st.status === "running" || st.status === "queued")) continue;
      const input = scheilInput(alloy);
      if (!input) {
        setScheil((s) => ({
          ...s,
          [slot.conditionId]: {
            status: "error",
            points: [],
            error: "No balance element in this grade's spec — cannot resolve a mid-spec composition.",
          },
        }));
        continue;
      }
      const db = engineDbForBase(input.base);
      if (!db) {
        setScheil((s) => ({
          ...s,
          [slot.conditionId]: {
            status: "error",
            points: [],
            error: `No license-vetted database shipped for ${input.base}-based alloys yet (shipped bases: ${ENGINE_DBS.map((d) => baseHint(d)).join(", ")}).`,
          },
        }));
        continue;
      }
      targets.push({
        conditionId: slot.conditionId,
        db,
        wt: input.wt,
        startC: scheilStartCFor(input.base),
      });
      setScheil((s) => ({ ...s, [slot.conditionId]: { status: "queued", db, points: [] } }));
    }
    if (targets.length === 0) return;
    setScheilQueue(true);
    try {
      for (const t of targets) {
        await runScheilOne(t.conditionId, t.db, t.wt, t.startC);
      }
    } finally {
      setScheilQueue(false);
    }
  };

  // Overlaid fs(T) curves — one series per non-excluded candidate, each
  // trimmed to its own liquidus + 25 K so superheat doesn't flatten the
  // interesting part.
  const scheilSeries = useMemo(() => {
    const PALETTE = [
      "var(--fam-fe)", "var(--fam-cu)", "var(--viol)", "var(--fam-ni)",
      "var(--straw)", "var(--fam-al)",
    ];
    return rows
      .filter((r) => !r.slot.excluded)
      .map((r, i) => {
        const st = scheil[r.slot.conditionId];
        if (!st || st.points.length === 0) return null;
        const withSolid = st.points.filter((p) => p.fractionSolid > 0);
        if (withSolid.length === 0) return null;
        const liqTc = Math.max(...withSolid.map((p) => p.tC));
        return {
          name: `${r.alloy.names[0]} (${r.alloy.uns})`,
          color: PALETTE[i % PALETTE.length]!,
          points: st.points
            .filter((p) => p.tC <= liqTc + 25)
            .map((p) => ({ x: p.tC, y: p.fractionSolid })),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [rows, scheil]);

  const loadExample = () => {
    setExampleRequested(false);
    const existing = loadProfiles();
    let profile = existing.find((p) => p.name === EXAMPLE_PROFILE_NAME);
    if (!profile) {
      profile = exampleProfile();
      saveProfiles([...existing, profile]);
      setProfiles([...existing, profile]);
    }
    const id = profile.id;
    update((s) => ({
      ...s,
      studyName: EXAMPLE_PROFILE_NAME,
      profileId: id,
      slots: EXAMPLE_SLOTS,
      includeDrafts: true,
      overrideLog: [
        ...s.overrideLog,
        `${new Date().toISOString()} — loaded EXAMPLE study (sample seawater duty, 4 candidates, draft rules opted in)`,
      ],
    }));
  };

  if (!loaded) return null;

  return (
    <>
      {exampleRequested && <div className="workflow-notice">
        <strong>Explore the seawater example</strong>
        <span>Loads a sample duty, four candidates and draft rules. Replaces the active shortlist; saved duty profiles remain available.</span>
        <button className="btn" onClick={loadExample}>Load seawater example</button>
        <button className="btn ghost" onClick={() => setExampleRequested(false)}>Keep current study</button>
      </div>}
      {saveError && <p className="calc-warn" role="alert">Browser storage is unavailable. Changes remain in this view only.</p>}
      <div className="pane-header">
        <h1>Comparison</h1>
        <label className="inline-label">Density <select className="hdr-select" aria-label="Comparison density" value={density} onChange={(e) => setDensity(e.target.value as "compact" | "comfortable")}>
          <option value="compact">Compact</option><option value="comfortable">Comfortable</option>
        </select></label>
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
          aria-label="Add alloy candidate"
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
        <span className="wlabel">Score weights:</span>
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
        <label className="weight" title="Participates only once at least two candidates have a Scheil result — see the Solidification row.">
          Castability (Kou)
          <input
            type="range"
            min={0}
            max={2}
            step={0.25}
            value={stored.castabilityWeight}
            onChange={(e) =>
              update((s) => ({ ...s, castabilityWeight: Number(e.target.value) }))
            }
          />
          <span className="mono">{stored.castabilityWeight.toFixed(2)}</span>
        </label>
        <span className="score-eq mono">
          Performance = weighted available criteria · partial results are not ranked
        </span>
      </div>

      <div className="rule-status-bar" role="status">
        <span className="rsb-counts">
          {reviewedCount} expert-reviewed rule{reviewedCount === 1 ? "" : "s"} ·{" "}
          {draftCount} draft
        </span>
        <label className="rsb-toggle">
          <input
            type="checkbox"
            checked={stored.includeDrafts}
            onChange={(e) =>
              update((s) => ({ ...s, includeDrafts: e.target.checked }))
            }
          />
          Include draft rules in the audit
        </label>
        <span className="rsb-note">
          {stored.includeDrafts
            ? `Audit runs ${rules.length} rules, including drafts awaiting expert review — screening guidance, not design approval.`
            : reviewedCount === 0
              ? "All rules are drafts awaiting expert review; the audit runs none until you opt in."
              : "Audit runs expert-reviewed rules only."}
        </span>
      </div>

      {!profile && (
        <div className="empty-state">
          <span className="phase-tag">NO DUTY SELECTED</span>
          <span className="t">Pick a duty profile to audit against</span>
          <span className="d">
            Candidates can be added now, but scores and the failure audit need a
            duty profile describing the environment and loads.
          </span>
          <Link className="btn" href="/profiles?from=comparisons">
            Create a duty profile
          </Link>
          <button type="button" className="btn ghost" onClick={loadExample}>
            Load example study
          </button>
          <span className="d">
            The example is a welded seawater duty with four candidates and
            draft rules opted in — sample data, clearly labeled EXAMPLE, for
            seeing the workflow before entering your own.
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
          <button type="button" className="btn ghost" onClick={loadExample}>
            Load example study
          </button>
        </div>
      )}

      {profile && ordered.length > 0 && (
        <div className={`cmp-scroll ${density}`}>
          {duty && <TradeoffPanel candidates={rows.filter((r) => !r.slot.excluded && r.rank).map((r) => ({ id: r.condition.id, name: `${r.alloy.names[0]} — ${r.condition.name}`, facts: r.facts, audits: r.audits, rank: r.rank!, extra: [r.castability] }))} duty={duty} weights={stored.weights} />}
          <div className="cmp-grid" style={{ gridTemplateColumns: `150px repeat(${ordered.length}, minmax(${density === "compact" ? 210 : 310}px, 1fr))`, minWidth: 150 + ordered.length * (density === "compact" ? 211 : 311) }}>
            {/* Header row */}
            <div className="cmp-corner" />
            {ordered.map(({ slot, alloy, condition, rank }) => (
              <div key={condition.id} className={`cmp-head ${slot.excluded ? "excluded" : ""} ${rank?.eliminated ? "eliminated" : ""}`}>
                <div className="cmp-name">
                  {alloy.names[0]}
                  {slot.pinned && <span className="pin-flag" title="Pinned by you">PINNED</span>}
                </div>
                <div className="cmp-cond">{condition.name} · <span className="mono">{alloy.uns}</span></div>
                <button className="btn ghost evidence-link" onClick={() => setEvidenceId(condition.id)}>Inspect evidence</button>
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

            <div className="cmp-rowlabel">Performance</div>
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
                    <span className="score-num">{Number.isFinite(rank.score) ? rank.score.toFixed(0) : "—"}</span>
                    <span className={rank.scoreComplete ? "score-status" : "score-status partial"}>{rank.scoreComplete ? "Complete criteria" : "Partial · not ranked"}</span>
                    {Number.isFinite(rank.score) && <div className="score-bar"><span style={{ width: `${Math.max(0, Math.min(100, rank.score))}%` }} /></div>}
                    <table className="breakdown">
                      <tbody>
                        {rank.contributions.map((c) => (
                          <tr key={c.criterion} title={c.note}>
                            <td>{c.label}</td>
                            <td className="mono">
                              {c.included ? `${c.raw.toFixed(2)} × ${c.weight.toFixed(2)}` : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </div>
            ))}

            <div className="cmp-rowlabel">Evidence coverage</div>
            {ordered.map(({ condition, rank }) => <div key={condition.id} className="cmp-cell">
              <strong>{rank?.coveragePercent.toFixed(0)}% of weighted criteria</strong>
              <p className="calc-src">Input coverage, not confidence or expert validation.</p>
              {rank && rank.evidenceGaps.length > 0 && <ul className="evidence-gaps">{rank.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
              <details className="evidence-details"><summary>Inspect assumptions and contributions</summary>
                {rank?.contributions.map((c) => <p key={c.criterion}><strong>{c.label}:</strong> {c.note}</p>)}
              </details>
            </div>)}

            <div className="cmp-rowlabel">σy (MPa)</div>
            {ordered.map(({ condition, facts }) => {
              const rec = condition.properties.find((p) => p.property === "yield_strength");
              return (
                <div key={condition.id} className="cmp-cell num">
                  {facts.yieldMPa !== undefined && rec ? (
                    <>
                      <span className="mono">{facts.yieldMPa}</span>{" "}
                      <ProvenanceChip p={rec.provenance} title={rec.source} />
                      <span className="property-temp">Tested at {rec.testTempC} °C</span>
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
                      <span className="property-temp">Tested at {rec.testTempC} °C</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              );
            })}

            <div className="cmp-rowlabel">PREN (range midpoints; max-only residuals omitted) <span className="prov computed" title="Computed from mid-spec composition">COMPUTED</span></div>
            {ordered.map(({ condition, pren: p }) => (
              <div key={condition.id} className="cmp-cell num mono">
                {p === null ? "n/a" : p.toFixed(1)}
              </div>
            ))}

            <div className="cmp-rowlabel">
              Solidification — Scheil{" "}
              <span className="prov computed" title="Mid-spec composition (max-only spec elements at half-max), in-browser CALPHAD engine — experimental">COMPUTED</span>
              <button
                type="button"
                className="mini"
                onClick={runSolidification}
                disabled={scheilQueue}
                style={{ marginTop: 6 }}
              >
                {scheilQueue ? "Computing…" : "Compute"}
              </button>
            </div>
            {ordered.map(({ condition, slot }) => {
              const st = scheil[condition.id];
              const last = st?.points[st.points.length - 1];
              return (
                <div key={condition.id} className={`cmp-cell ${slot.excluded ? "excluded" : ""}`}>
                  {!st ? (
                    <span className="cmp-dim">— not computed</span>
                  ) : st.status === "queued" ? (
                    <span className="cmp-dim">queued…</span>
                  ) : st.status === "running" ? (
                    <span className="mono cmp-dim" role="status">
                      {last
                        ? `cooling… ${last.tC.toFixed(0)} °C · fs ${(last.fractionSolid * 100).toFixed(0)} %`
                        : "starting…"}
                    </span>
                  ) : st.status === "error" ? (
                    <span className="calc-warn cmp-scheil-err">{st.error}</span>
                  ) : st.result ? (
                    <div className="mono cmp-scheil-nums" title={`Database: ${st.db} · ${st.result.ms} ms`}>
                      {st.result.liquidusC !== undefined
                        ? `liquidus ≈ ${st.result.liquidusC.toFixed(0)} °C`
                        : "no solid above the floor"}
                      {st.result.solidusC !== undefined && (
                        <><br />solidus ≈ {st.result.solidusC.toFixed(0)} °C</>
                      )}
                      {st.result.liquidusC !== undefined && st.result.solidusC !== undefined && (
                        <><br />freezing range ≈ {(st.result.liquidusC - st.result.solidusC).toFixed(0)} K</>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="cmp-rowlabel">
              Kou hot-cracking index (K){" "}
              <span
                className="prov computed"
                title="max |dT/d√fs| over √fs 0.90–0.99 (Kou, Acta Mater. 88 (2015) 366). Comparative between candidates — steeper terminal solidification = more susceptible. Not a pass/fail."
              >
                COMPUTED
              </span>
            </div>
            {(() => {
              const kouMax = Math.max(
                0,
                ...ordered
                  .filter((r) => !r.slot.excluded)
                  .map((r) => scheil[r.slot.conditionId]?.result?.kouIndexK ?? 0),
              );
              return ordered.map(({ condition, slot }) => {
                const st = scheil[condition.id];
                const kou = st?.status === "done" ? st.result?.kouIndexK : undefined;
                return (
                  <div key={condition.id} className={`cmp-cell num ${slot.excluded ? "excluded" : ""}`}>
                    {kou !== undefined ? (
                      <>
                        <span className="mono">{kou.toFixed(0)}</span>
                        {kouMax > 0 && (
                          <div className="score-bar kou-bar" title="Relative to the highest (most susceptible) computed candidate">
                            <span style={{ width: `${Math.max(2, (kou / kouMax) * 100)}%` }} />
                          </div>
                        )}
                      </>
                    ) : st?.status === "done" ? (
                      <span className="cmp-dim" title="Terminal solidification did not cross the √fs 0.90–0.99 window">n/a</span>
                    ) : (
                      <span className="cmp-dim">—</span>
                    )}
                  </div>
                );
              });
            })()}

            <div className="cmp-rowlabel" id="failure-audit">Failure audit &amp; unresolved risks</div>
            {ordered.map(({ condition, audits }) => (
              <div key={condition.id} className="cmp-cell">
                <AuditList audits={audits} rulesRan={rules.length} />
              </div>
            ))}
          </div>

          {scheilSeries.length > 0 && (
            <div className="cmp-scheil-chart">
              <LineChart
                series={scheilSeries}
                xLabel="T (°C)"
                yLabel="fraction solid (Scheil)"
                yMin={0}
                yMax={1}
                height={280}
                footnote={`Scheil-Gulliver solidification at mid-spec composition (max-only spec elements taken at half-max), in-browser CALPHAD engine, databases per base metal (${[...new Set(Object.values(scheil).map((s) => s.db).filter(Boolean))].join(", ")}). Complete liquid mixing, NO solid diffusion: the segregation-limited bound. Trace elements the spec does not record (e.g. P, S) are not modeled — real heats can show steeper terminal solidification than these curves. Kou index = max |dT/d√fs| over √fs 0.90–0.99 (Kou, Acta Mater. 88 (2015) 366) — comparative between candidates, not a pass/fail; matters most for welded or cast parts${duty ? ` (this duty — welded: ${duty.welded})` : ""}.`}
              />
            </div>
          )}

          <div className="cmp-foot">
            Flags inform expert judgment — Alloyra never claims a part is safe
            or will fail. Hover any flag for mechanism, evidence, and
            mitigations, or open Inspect evidence for keyboard-accessible details. This comparison is saved in this browser only.
            {stored.overrideLog.length > 0 && (
              <details className="override-log">
                <summary>
                  Intervention log ({stored.overrideLog.length}) — pins,
                  exclusions, removals, and example loads, append-only
                </summary>
                <ul>
                  {stored.overrideLog.map((entry, i) => (
                    <li key={i} className="mono">
                      {entry}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
      {(() => {
        const selected = rows.find((r) => r.condition.id === evidenceId);
        return selected ? <CandidateEvidence name={selected.alloy.names[0] ?? selected.alloy.uns} condition={selected.condition} audits={selected.audits} rank={selected.rank} onClose={() => setEvidenceId(null)} /> : null;
      })()}
    </>
  );
}
