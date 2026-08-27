import { validateRule, type FailureRule } from "@alloyra/core";
import { failureRules, RULESET_VERSION } from "@alloyra/data";

/**
 * Expert rule authoring (R-5.3): the seed ruleset ships in @alloyra/data;
 * local edits live in an OVERLAY (localStorage) — edit, add, or disable
 * rules without a deploy. The seed is never mutated, so any change can be
 * reverted and the audit can always state which ruleset produced it.
 */
export interface RuleOverlay {
  /** Seed rules replaced by an edited copy, keyed by rule id. */
  edits: Record<string, FailureRule>;
  /** Expert-authored additions. */
  added: FailureRule[];
  /** Rule ids (seed or added) switched off. */
  disabled: string[];
}

const STORE = "alloyra.rulesOverlay.v1";

export function emptyOverlay(): RuleOverlay {
  return { edits: {}, added: [], disabled: [] };
}

export function loadOverlay(): RuleOverlay {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return emptyOverlay();
    const o = { ...emptyOverlay(), ...(JSON.parse(raw) as RuleOverlay) };
    // Drop anything invalid rather than letting it reach the engine.
    o.added = o.added.filter((r) => validateRule(r).length === 0);
    for (const [id, r] of Object.entries(o.edits)) {
      if (validateRule(r).length > 0) delete o.edits[id];
    }
    return o;
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay(o: RuleOverlay): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(o));
  } catch {
    /* session-only */
  }
}

export type RuleOrigin = "seed" | "edited" | "local";

export interface EffectiveRule {
  rule: FailureRule;
  origin: RuleOrigin;
  disabled: boolean;
}

/** Seed ∪ overlay, every rule tagged with where it came from. */
export function effectiveRuleList(o: RuleOverlay): EffectiveRule[] {
  const disabled = new Set(o.disabled);
  const seeds: EffectiveRule[] = failureRules.map((r) => {
    const edit = o.edits[r.id];
    return {
      rule: edit ?? r,
      origin: edit ? ("edited" as const) : ("seed" as const),
      disabled: disabled.has(r.id),
    };
  });
  const added: EffectiveRule[] = o.added.map((r) => ({
    rule: r,
    origin: "local" as const,
    disabled: disabled.has(r.id),
  }));
  return [...seeds, ...added];
}

/** What the audit engine actually runs. */
export function activeRules(o: RuleOverlay): FailureRule[] {
  return effectiveRuleList(o)
    .filter((e) => !e.disabled)
    .map((e) => e.rule);
}

/** Label recorded on comparisons: seed version, plus local-delta marker. */
export function rulesetLabel(o: RuleOverlay): string {
  const delta =
    Object.keys(o.edits).length + o.added.length + o.disabled.length;
  return delta > 0 ? `${RULESET_VERSION}+local(${delta})` : RULESET_VERSION;
}
