import { alloys, failureRules, DATASET_VERSION, RULESET_VERSION } from "@alloyra/data";
import { SLICE_KEYS, parseStudyBundle, type SliceKey, type SavedStudy, type StudyBundle, type StudyReferences } from "./studyFormat";
export const STUDY_CHANGED = "alloyra:study-changed";
export const STUDY_SWITCHED = "alloyra:study-switched";
export const STORAGE_ERROR = "alloyra:storage-error";
const STORE = "alloyra.workspace.v1";
interface Workspace { version: 1; activeId: string; studies: SavedStudy[]; }
let memory: Workspace | undefined;
const references = (): StudyReferences => ({ datasetVersion: DATASET_VERSION, rulesetVersion: RULESET_VERSION, alloys, rules: failureRules });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const announce = (event: string) => queueMicrotask(() => window.dispatchEvent(new Event(event)));
function fresh(name: string): SavedStudy {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, slices: {}, references: clone(references()) };
}
function persist(w: Workspace, switched = false): void {
  // One write is atomic: a failed import/switch cannot leave mixed study slices.
  try { localStorage.setItem(STORE, JSON.stringify(w)); }
  catch (e) { announce(STORAGE_ERROR); throw e; }
  memory = w;
  announce(STUDY_CHANGED);
  if (switched) announce(STUDY_SWITCHED);
}
export function readWorkspace(): Workspace {
  if (typeof window === "undefined") return { version: 1, activeId: "", studies: [] };
  if (memory) return memory;
  const raw = localStorage.getItem(STORE);
  if (raw) {
    const parsed = JSON.parse(raw) as Workspace;
    if (parsed.version !== 1 || !Array.isArray(parsed.studies) || !parsed.studies.some((s) => s.id === parsed.activeId)) throw new Error("The saved workspace format is not supported. Export your browser data before resetting it.");
    memory = parsed;
    return parsed;
  }
  const study = fresh("Untitled study");
  for (const key of SLICE_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy !== null) study.slices[key] = legacy;
  }
  try { study.name = JSON.parse(study.slices["alloyra.comparison.v1"] ?? "{}").studyName || "Untitled study"; } catch { /* keep legacy data untouched */ }
  const migrated: Workspace = { version: 1, activeId: study.id, studies: [study] };
  // Original legacy keys are kept as a recovery copy.
  try { persist(migrated); } catch { memory = migrated; }
  return migrated;
}
export function activeStudy(): SavedStudy | undefined {
  const w = readWorkspace();
  return w.studies.find((s) => s.id === w.activeId);
}
export function getStudyItem(key: string): string | null { return activeStudy()?.slices[key as SliceKey] ?? null; }
export function setStudyItem(key: string, value: string, studyId = readWorkspace().activeId): void {
  if (!SLICE_KEYS.includes(key as SliceKey)) throw new Error("Unknown study section.");
  const w = clone(readWorkspace());
  const study = w.studies.find((s) => s.id === studyId);
  if (!study) throw new Error("The target study is unavailable.");
  if (study.slices[key as SliceKey] === value) return;
  study.slices[key as SliceKey] = value;
  study.updatedAt = new Date().toISOString();
  if (key === "alloyra.comparison.v1") {
    const name = JSON.parse(value).studyName;
    if (typeof name === "string" && name.trim()) study.name = name.trim().slice(0, 120);
  }
  persist(w);
}
export function createStudy(name = "Untitled study", duplicate = false): string {
  const w = clone(readWorkspace());
  const study = duplicate && activeStudy() ? clone(activeStudy()!) : fresh(name);
  study.id = crypto.randomUUID(); study.name = name.trim().slice(0, 120) || "Untitled study";
  study.createdAt = study.updatedAt = new Date().toISOString();
  if (study.slices["alloyra.comparison.v1"]) {
    const c = JSON.parse(study.slices["alloyra.comparison.v1"]);
    c.studyName = study.name; study.slices["alloyra.comparison.v1"] = JSON.stringify(c);
  }
  w.studies.push(study); w.activeId = study.id; persist(w, true); return study.id;
}
export function switchStudy(id: string): void {
  const w = clone(readWorkspace());
  if (!w.studies.some((s) => s.id === id)) throw new Error("Study not found.");
  w.activeId = id; persist(w, true);
}
export function renameStudy(name: string): void {
  const w = clone(readWorkspace()); const study = w.studies.find((s) => s.id === w.activeId)!;
  study.name = name.trim().slice(0, 120) || "Untitled study"; study.updatedAt = new Date().toISOString();
  if (study.slices["alloyra.comparison.v1"]) {
    const c = JSON.parse(study.slices["alloyra.comparison.v1"]); c.studyName = study.name;
    study.slices["alloyra.comparison.v1"] = JSON.stringify(c);
  }
  persist(w);
}
export function exportStudyBundle(study = activeStudy()!): StudyBundle {
  return clone({ format: "alloyra-study", schemaVersion: 1, exportedAt: new Date().toISOString(), study });
}
export function importStudyBundle(raw: string): string {
  const bundle = parseStudyBundle(raw); // validate everything before touching storage
  const w = clone(readWorkspace()); const study = clone(bundle.study);
  study.id = crypto.randomUUID(); study.name = `${study.name.slice(0, 109)} (imported)`;
  study.updatedAt = new Date().toISOString();
  if (study.slices["alloyra.comparison.v1"]) {
    const c = JSON.parse(study.slices["alloyra.comparison.v1"]); c.studyName = study.name;
    study.slices["alloyra.comparison.v1"] = JSON.stringify(c);
  }
  w.studies.push(study); w.activeId = study.id; persist(w, true); return study.id;
}
export function matchesCurrentData(study: SavedStudy): boolean {
  return JSON.stringify(study.references) === JSON.stringify(references());
}
/** Invalidated on a cross-tab write, never poll localStorage from render. */
export function reloadWorkspace(): void { memory = undefined; }
