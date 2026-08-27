"use client";

import { useEffect, useRef, useState } from "react";
import { describeClause, validateRule, type FailureRule } from "@alloyra/core";
import {
  effectiveRuleList,
  emptyOverlay,
  loadOverlay,
  rulesetLabel,
  saveOverlay,
  type RuleOverlay,
} from "../lib/rules";

/**
 * Rule authoring (R-5.3, M3): the seed ruleset is read-only data; experts
 * edit through a local overlay — edit, add, disable, revert — with
 * structural validation at save time. Rules are edited as JSON on
 * purpose: the clause DSL IS the rule, and an expert should see exactly
 * what the engine will run.
 */

const TEMPLATE: FailureRule = {
  id: "my-new-rule",
  name: "Name the phenomenon",
  severity: "caution",
  when: [
    { kind: "family", path: ["Fe"] },
    { kind: "duty", field: "tempMaxC", op: ">=", value: 100, nearBand: 0.15 },
  ],
  mechanism: "State the mechanism as a flag for expert judgment.",
  citation: "Required — uncited rules are not admissible.",
  mitigations: ["First mitigation"],
  reviewStatus: "draft",
  reviewedBy: "your name, today",
};

export function RulesView() {
  const [overlay, setOverlay] = useState<RuleOverlay>(emptyOverlay());
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOverlay(loadOverlay());
    setLoaded(true);
  }, []);

  const update = (mut: (o: RuleOverlay) => RuleOverlay) => {
    setOverlay((o) => {
      const next = mut(o);
      saveOverlay(next);
      return next;
    });
  };

  const rules = effectiveRuleList(overlay);
  const seedIds = new Set(
    rules.filter((r) => r.origin !== "local").map((r) => r.rule.id),
  );

  const startEdit = (rule: FailureRule) => {
    setEditingId(rule.id);
    setDraft(JSON.stringify(rule, null, 2));
    setDraftErrors([]);
  };

  const startNew = () => {
    setEditingId("__new__");
    setDraft(JSON.stringify(TEMPLATE, null, 2));
    setDraftErrors([]);
  };

  const saveDraft = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setDraftErrors([`Not valid JSON: ${e instanceof Error ? e.message : e}`]);
      return;
    }
    const errs = validateRule(parsed);
    const rule = parsed as FailureRule;
    if (editingId === "__new__" && seedIds.has(rule.id)) {
      errs.push(`id "${rule.id}" already exists — pick a unique id`);
    }
    if (errs.length > 0) {
      setDraftErrors(errs);
      return;
    }
    update((o) => {
      if (editingId === "__new__") {
        return { ...o, added: [...o.added.filter((r) => r.id !== rule.id), rule] };
      }
      if (o.added.some((r) => r.id === editingId)) {
        return {
          ...o,
          added: o.added.map((r) => (r.id === editingId ? rule : r)),
        };
      }
      return { ...o, edits: { ...o.edits, [editingId as string]: rule } };
    });
    setEditingId(null);
  };

  const toggleDisabled = (id: string) =>
    update((o) => ({
      ...o,
      disabled: o.disabled.includes(id)
        ? o.disabled.filter((x) => x !== id)
        : [...o.disabled, id],
    }));

  const revert = (id: string) =>
    update((o) => {
      const edits = { ...o.edits };
      delete edits[id];
      return { ...o, edits, added: o.added.filter((r) => r.id !== id) };
    });

  const exportOverlay = () => {
    const blob = new Blob([JSON.stringify(overlay, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alloyra-ruleset-overlay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importOverlay = (file: File) => {
    file.text().then((text) => {
      try {
        const o = { ...emptyOverlay(), ...(JSON.parse(text) as RuleOverlay) };
        update(() => o);
      } catch {
        /* surfaced by the unchanged view */
      }
    });
  };

  if (!loaded) return null;

  return (
    <>
      <div className="pane-header">
        <h1>Failure rules</h1>
        <span className="count">
          {rules.filter((r) => !r.disabled).length} enabled (
          {rules.filter((r) => !r.disabled && r.rule.reviewStatus !== "draft").length} reviewed,{" "}
          {rules.filter((r) => !r.disabled && r.rule.reviewStatus === "draft").length} draft) · ruleset {rulesetLabel(overlay)}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost" onClick={exportOverlay}>Export overlay</button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importOverlay(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn" onClick={startNew}>New rule</button>
      </div>
      <div className="rules-scroll">
        <div className="rules-intro">
          Seed rules ship with the dataset and are never mutated — your edits,
          additions, and disables live in a local overlay recorded on every
          comparison as “{rulesetLabel(overlay)}”. Rules are edited as the JSON
          the engine runs; saving validates structure and requires a citation.
          Draft rules do not run in comparisons unless explicitly included
          there — promote a rule to expert-reviewed by editing its
          reviewStatus once a domain expert has signed off.
        </div>

        {editingId !== null && (
          <div className="rule-editor">
            <div className="rule-editor-head">
              <span className="wlbl">{editingId === "__new__" ? "New rule" : `Editing ${editingId}`}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>Cancel</button>
              <button type="button" className="btn" onClick={saveDraft}>Validate &amp; save</button>
            </div>
            <textarea
              className="rule-json mono"
              value={draft}
              rows={Math.min(28, draft.split("\n").length + 2)}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
            {draftErrors.map((e) => (
              <div className="calc-warn" key={e}>{e}</div>
            ))}
          </div>
        )}

        {rules.map(({ rule: r, origin, disabled }) => (
          <article className={`rule-card ${disabled ? "disabled" : ""}`} key={r.id}>
            <header>
              <span className={`sev-chip ${r.severity}`}>{r.severity.toUpperCase()}</span>
              <span className={`status-chip ${r.reviewStatus}`} title="Review lifecycle: draft rules only run in audits when explicitly included">
                {r.reviewStatus.toUpperCase().replace("-", " ")}
              </span>
              <h2>{r.name}</h2>
              {origin !== "seed" && (
                <span className={`origin-chip ${origin}`}>{origin === "edited" ? "EDITED" : "LOCAL"}</span>
              )}
              {disabled && <span className="origin-chip off">DISABLED</span>}
              <span className="rule-id mono">{r.id}</span>
            </header>
            <div className="rule-when">
              <span className="wlbl">Fires when all of:</span>
              <ul>
                {r.when.map((c, i) => (
                  <li key={i}>{describeClause(c)}</li>
                ))}
              </ul>
            </div>
            <p className="rule-mech">{r.mechanism}</p>
            <div className="rule-mit">
              <span className="wlbl">Mitigations</span>
              <ul>
                {r.mitigations.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <footer>
              <span className="mono">{r.citation}</span>
              <span className="rule-actions">
                <button type="button" className="mini" onClick={() => startEdit(r)}>Edit</button>
                <button type="button" className="mini" onClick={() => toggleDisabled(r.id)}>
                  {disabled ? "Enable" : "Disable"}
                </button>
                {origin !== "seed" && (
                  <button type="button" className="mini" onClick={() => revert(r.id)}>
                    {origin === "edited" ? "Revert to seed" : "Delete"}
                  </button>
                )}
              </span>
              <span className="review-flag">{r.reviewedBy}</span>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
