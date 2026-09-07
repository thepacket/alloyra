
import { getStudyItem, setStudyItem, activeStudy } from "./workspace";
import { DATASET_VERSION, RULESET_VERSION } from "@alloyra/data";
import type { Weights } from "@alloyra/core";
import { blankProfile, type DutyProfile } from "./profiles";

export { STUDY_CHANGED } from "./workspace";
/** One comparison slot: an alloy IN a condition, plus expert overrides (R-3.4). */
export interface Slot {
  uns: string;
  conditionId: string;
  /** Explicit measured evidence; absent selects the reference condition. */
  materialRecordId?: string;
  pinned: boolean;
  excluded: boolean;
}

export interface StoredComparison {
  studyName: string;
  profileId: string | null;
  slots: Slot[];
  weights: Weights;
  /** Weight of the Scheil-derived castability criterion (B-504 follow-through). */
  castabilityWeight: number;
  /** Draft (unreviewed) rules run only on visible opt-in — default off. */
  includeDrafts: boolean;
  /** Append-only audit trail of expert overrides (R-3.4). */
  overrideLog: string[];
  datasetVersion: string;
  rulesetVersion: string;
}

const STORE = "alloyra.comparison.v1";
export const MAX_SLOTS = 6;

/**
 * First-run example study (external review, 2026-08-28): one click shows
 * the full workflow — a sample duty, candidates, and the draft-rule opt-in
 * — without weakening any production default. Everything it creates is
 * labeled EXAMPLE and behaves like normal user data (editable, deletable).
 */
export const EXAMPLE_PROFILE_NAME = "EXAMPLE — seawater pump housing (welded)";

export function exampleProfile(): DutyProfile {
  const p = blankProfile();
  p.name = EXAMPLE_PROFILE_NAME;
  p.savedAt = new Date().toISOString();
  p.thermal = { minC: 5, nomC: 25, maxC: 45 };
  p.mechanical = { loadType: "sustained", designStressMPa: 120, rRatio: null, cycles: null };
  p.chemistry = { medium: "immersion", chloridePpm: 19000, pH: 8.1, h2sKpa: 0, ammonia: "no" };
  p.context = {
    galvanicCouple: "",
    crevices: "yes",
    welded: "yes",
    cathodicProtection: "no",
    lmeContact: "none",
  };
  p.constraints = { maxCostPerKg: null, route: "wrought" };
  return p;
}

export const EXAMPLE_SLOTS: Slot[] = [
  { uns: "S32205", conditionId: "s32205-annealed-plate", pinned: false, excluded: false },
  { uns: "S32750", conditionId: "s32750-annealed-plate", pinned: false, excluded: false },
  { uns: "S31603", conditionId: "s31603-annealed-plate", pinned: false, excluded: false },
  { uns: "N06625", conditionId: "n06625-annealed-plate", pinned: false, excluded: false },
];

export const defaultStored = (): StoredComparison => ({
  studyName: "Untitled study",
  profileId: null,
  slots: [],
  weights: { strength: 1, corrosion: 1, auditCleanliness: 1 },
  castabilityWeight: 1,
  includeDrafts: false,
  overrideLog: [],
  datasetVersion: DATASET_VERSION,
  rulesetVersion: RULESET_VERSION,
});

export function loadStored(): StoredComparison {
  try {
    const raw = getStudyItem(STORE);
    if (!raw) return { ...defaultStored(), studyName: activeStudy()?.name ?? "Untitled study" };
    return { ...defaultStored(), ...(JSON.parse(raw) as StoredComparison) };
  } catch {
    return defaultStored();
  }
}


export function saveComparison(next: StoredComparison): boolean {
  try {
    setStudyItem(STORE, JSON.stringify(next));
    return true;
  } catch { return false; }
}
export function selectStudyDuty(profile: DutyProfile): void {
  const previous = loadStored();
  saveComparison({ ...previous, profileId: profile.id,
    studyName: previous.studyName === "Untitled study" ? profile.name : previous.studyName });
}
