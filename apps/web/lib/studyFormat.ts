import { DECISIONS, DECISION_DRAFT, validateDecisionRecords, validateDecisionDraft } from "./decisions";
import { validateMaterialRecords, MATERIAL_RECORDS } from "./materialRecords";
import { validateVerification, VERIFICATION } from "./verification";
import type { Alloy } from "@alloyra/data";
import { validateRule, type FailureRule } from "@alloyra/core";

export const SLICE_KEYS = ["alloyra.comparison.v1", "alloyra.screening.v1", "alloyra.studio.v1", "alloyra.dutyProfiles.v1", "alloyra.rulesOverlay.v1", "alloyra.engineSettings.v1", "alloyra.calculations.v1", "alloyra.comparisonResults.v1", "alloyra.studioResults.v1", "alloyra.screeningResults.v1", "alloyra.materialRecords.v1", "alloyra.verification.v1", "alloyra.verificationResults.v1", "alloyra.decisions.v1", "alloyra.decisionDraft.v1"] as const;
export type SliceKey = typeof SLICE_KEYS[number];
export interface StudyReferences {
  datasetVersion: string;
  rulesetVersion: string;
  alloys: Alloy[];
  rules: FailureRule[];
}
export interface SavedStudy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  slices: Partial<Record<SliceKey, string>>;
  references: StudyReferences;
}
export interface StudyBundle {
  format: "alloyra-study";
  schemaVersion: 1;
  exportedAt: string;
  study: SavedStudy;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nullable = (v: unknown) => v === null || finite(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const numMap = (v: unknown) => record(v) && Object.entries(v).every(([k, n]) => /^[A-Z][a-z]?$/.test(k) && finite(n) && n >= 0);
const oneOf = (v: unknown, options: string[]) => text(v) && options.includes(v);
const hasNumbers = (v: unknown, fields: string[], allowNull = false) => record(v) && fields.every((k) => allowNull ? nullable(v[k]) : finite(v[k]));
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }

function validateSlice(key: SliceKey, raw: string): void {
  const v: unknown = JSON.parse(raw);
  const tri = ["yes", "no", "unknown"];
  if (key === DECISIONS) {
    validateDecisionRecords(v);
  } else if (key === DECISION_DRAFT) {
    validateDecisionDraft(v);
  } else if (key === MATERIAL_RECORDS) {
    validateMaterialRecords(v);
  } else if (key === VERIFICATION) {
    validateVerification(v);
  } else if (key === "alloyra.comparison.v1") {
    requireValue(record(v) && (v.profileId === null || text(v.profileId)) && (v.studyName === undefined || text(v.studyName)) && Array.isArray(v.slots) && v.slots.length <= 6, "Invalid comparison or more than six candidates.");
    requireValue(v.slots.every((s) => record(s) && text(s.uns) && text(s.conditionId) && (s.materialRecordId === undefined || text(s.materialRecordId)) && typeof s.pinned === "boolean" && typeof s.excluded === "boolean"), "Invalid comparison candidate.");
    requireValue(new Set(v.slots.map((s) => (s as Record<string, unknown>).conditionId)).size === v.slots.length, "Duplicate comparison condition.");
    requireValue(hasNumbers(v.weights, ["strength", "corrosion", "auditCleanliness"]) && Object.values(v.weights as object).every((w) => finite(w) && w >= 0 && w <= 2), "Invalid score weights.");
    requireValue((v.castabilityWeight === undefined || (finite(v.castabilityWeight) && v.castabilityWeight >= 0 && v.castabilityWeight <= 2)) && typeof v.includeDrafts === "boolean" && strings(v.overrideLog), "Invalid comparison settings.");
  } else if (key === "alloyra.screening.v1") {
    requireValue(record(v) && Array.isArray(v.stages) && v.stages.length <= 100 && text(v.xAxis) && text(v.yAxis), "Invalid screening settings.");
    for (const s of v.stages) {
      requireValue(record(s) && text(s.id) && typeof s.enabled === "boolean", "Invalid screening stage.");
      if (s.kind === "family") requireValue(strings(s.roots) && (s.term === undefined || text(s.term)), "Invalid family stage.");
      else if (s.kind === "limit") requireValue(text(s.property) && (s.min === undefined || finite(s.min)) && (s.max === undefined || finite(s.max)) && oneOf(s.unknowns, ["keep", "eliminate"]), "Invalid numeric stage.");
      else requireValue(s.kind === "region" && text(s.xProperty) && text(s.yProperty) && hasNumbers(s, ["x0", "x1", "y0", "y1"]) && oneOf(s.unknowns, ["keep", "eliminate"]), "Invalid chart region.");
    }
  } else if (key === "alloyra.dutyProfiles.v1") {
    requireValue(Array.isArray(v) && v.length <= 500, "Invalid duty profiles.");
    for (const p of v) {
      requireValue(record(p) && text(p.id) && text(p.name) && finite(p.version) && text(p.savedAt), "Invalid duty identity.");
      requireValue(hasNumbers(p.thermal, ["minC", "nomC", "maxC"], true) && hasNumbers(p.mechanical, ["designStressMPa", "rRatio", "cycles"], true), "Invalid duty temperatures or loads.");
      requireValue(record(p.mechanical) && oneOf(p.mechanical.loadType, ["unknown", "static", "cyclic", "impact", "sustained"]), "Invalid load type.");
      requireValue(hasNumbers(p.chemistry, ["chloridePpm", "pH", "h2sKpa"], true) && record(p.chemistry) && oneOf(p.chemistry.medium, ["unknown", "atmospheric", "immersion", "soil", "process-fluid"]) && oneOf(p.chemistry.ammonia, tri), "Invalid duty chemistry.");
      requireValue(record(p.context) && text(p.context.galvanicCouple) && ["crevices", "welded", "cathodicProtection"].every((k) => oneOf((p.context as Record<string, unknown>)[k], tri)) && oneOf(p.context.lmeContact, ["unknown", "none", "zinc", "copper"]), "Invalid duty context.");
      requireValue(record(p.constraints) && nullable(p.constraints.maxCostPerKg) && oneOf(p.constraints.route, ["unknown", "wrought", "cast", "am"]), "Invalid duty constraints.");
    }
  } else if (key === "alloyra.rulesOverlay.v1") {
    requireValue(record(v) && record(v.edits) && Array.isArray(v.added) && strings(v.disabled) && Array.isArray(v.history), "Invalid rule overlay.");
    for (const rule of [...Object.values(v.edits), ...v.added]) requireValue(record(rule) && validateRule(rule as unknown as FailureRule).length === 0, "Invalid or unreviewed rule promotion in bundle.");
    requireValue(v.history.every((h) => record(h) && text(h.at) && text(h.ruleId) && text(h.summary) && text(h.action)), "Invalid rule history.");
  } else if (key === "alloyra.studio.v1") {
    requireValue(record(v) && text(v.baseUns) && numMap(v.comp) && numMap(v.prices) && hasNumbers(v.lmp, ["tempC", "hours", "C"]), "Invalid studio inputs.");
    if (v.strength !== undefined) {
      const s = v.strength;
      requireValue(record(s) && nullable(s.grainAstm) && hasNumbers(s.hp, ["sigma0", "ky"], true) && hasNumbers(s.holl, ["K", "n"], true) && hasNumbers(s.orowan, ["fPct", "dNm", "G", "b"], true) && record(s.orowan) && text(s.orowan.matrix), "Invalid strengthening inputs.");
      if (s.origins !== undefined) requireValue(record(s.origins) && Object.values(s.origins).every((o) => oneOf(o, ["assumed", "unverified", "sourced", "user-entered"])), "Invalid input origins.");
    }
    for (const k of ["compositionOrigins", "lmpOrigins"]) if (v[k] !== undefined) requireValue(record(v[k]) && Object.values(v[k]).every((o) => oneOf(o, ["assumed", "unverified", "sourced", "user-entered"])), "Invalid scenario origins.");
  } else if (key === "alloyra.engineSettings.v1") {
    requireValue(record(v) && text(v.engineDbId) && text(v.mapEl) && hasNumbers(v, ["tempC", "sweepFrom", "sweepTo", "sweepStep", "scheilStart", "scheilDT", "mapFrom", "mapTo", "mapTMin", "mapTMax", "mapNX", "mapNT"]), "Invalid calculation settings.");
  } else if (key.endsWith("Results.v1")) {
    requireValue(record(v) && text(v.modelVersion) && record(v.inputs) && (record(v.results) || Array.isArray(v.results)), "Invalid result snapshot.");
  } else {
    requireValue(Array.isArray(v) && v.length <= 1000, "Invalid calculation history.");
    for (const run of v) requireValue(record(run) && text(run.id) && text(run.startedAt) && oneOf(run.status, ["running", "complete", "error", "cancelled", "interrupted"]) && record(run.request) && oneOf(run.request.kind, ["point", "step", "scheil", "map"]) && numMap(run.request.compositionWt) && text(run.request.dbId) && Array.isArray(run.events) && record(run.engine), "Invalid calculation record.");
  }
}

export function parseStudyBundle(raw: string): StudyBundle {
  requireValue(raw.length <= 12_000_000, "Study file exceeds the 12 MB import limit.");
  const b: unknown = JSON.parse(raw);
  requireValue(record(b) && b.format === "alloyra-study" && b.schemaVersion === 1 && text(b.exportedAt), "Unsupported study format or schema version.");
  const s = b.study;
  requireValue(record(s) && text(s.id) && text(s.name) && s.name.trim().length > 0 && s.name.length <= 120 && text(s.createdAt) && text(s.updatedAt) && record(s.slices), "Invalid study identity.");
  requireValue(record(s.references) && text(s.references.datasetVersion) && text(s.references.rulesetVersion) && Array.isArray(s.references.alloys) && Array.isArray(s.references.rules), "Missing source-data snapshot.");
  for (const a of s.references.alloys) {
    requireValue(record(a) && text(a.uns) && strings(a.names) && strings(a.family) && Array.isArray(a.composition) && Array.isArray(a.conditions), "Invalid alloy snapshot.");
    for (const c of a.conditions) {
      requireValue(record(c) && text(c.id) && text(c.name) && text(c.form) && Array.isArray(c.properties), "Invalid condition snapshot.");
      requireValue(c.properties.every((p) => record(p) && text(p.property) && finite(p.value) && finite(p.testTempC) && text(p.unit) && text(p.provenance) && text(p.source)), "Invalid property snapshot.");
      for (const p of c.properties) {
        if (record(p) && p.citation !== undefined) {
          const citation = p.citation;
          requireValue(record(citation) && text(citation.url) && /^https:\/\/[^\s]+$/.test(citation.url) && text(citation.locator) && text(citation.accessedAt) && Number.isFinite(Date.parse(citation.accessedAt)) && citation.reviewStatus === "pending", "Invalid property citation.");
        }
      }
    }
  }
  for (const rule of s.references.rules) requireValue(record(rule) && validateRule(rule as unknown as FailureRule).length === 0, "Invalid source rule snapshot.");
  for (const [key, value] of Object.entries(s.slices)) {
    requireValue(SLICE_KEYS.includes(key as SliceKey) && text(value), "Unknown study section.");
    validateSlice(key as SliceKey, value);
  }
  const study = s as unknown as SavedStudy;
  const decisions = JSON.parse(study.slices[DECISIONS] ?? "[]");
  validateDecisionRecords(decisions);
  for (const decision of decisions) parseStudyBundle(JSON.stringify({format:"alloyra-study",schemaVersion:1,exportedAt:decision.recordedAt,study:decision.snapshot}));
  const comparison = JSON.parse(study.slices["alloyra.comparison.v1"] ?? "null");
  const profiles = JSON.parse(study.slices["alloyra.dutyProfiles.v1"] ?? "[]");
  const records = JSON.parse(study.slices[MATERIAL_RECORDS] ?? "[]");
  validateMaterialRecords(records, study.references.alloys);
  if (comparison) {
    for (const slot of comparison.slots) if (slot.materialRecordId) requireValue(records.some((r) => r.id === slot.materialRecordId && r.uns === slot.uns && r.conditionId === slot.conditionId), "Selected measured record is missing or mismatched.");
    requireValue(comparison.profileId === null || profiles.some((p: { id: string }) => p.id === comparison.profileId), "Selected duty is missing from this bundle.");
    for (const slot of comparison.slots) requireValue(study.references.alloys.some((a) => a.uns === slot.uns && a.conditions.some((c) => c.id === slot.conditionId)), "A comparison condition is missing from the source snapshot.");
  }
  return b as unknown as StudyBundle;
}
