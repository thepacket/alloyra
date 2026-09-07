import type { EngineRequest, EngineResponse } from "../workers/calphadEngine.worker";
import { readWorkspace, setStudyItem } from "./workspace";
import manifest from "./engineManifest.json";
import { validationCoverage } from "./validation";
export interface CalculationRecord { id: string; startedAt: string; finishedAt?: string; status: "running" | "complete" | "error" | "cancelled"; request: EngineRequest; engine: typeof manifest; coverage: string; events: EngineResponse[]; }
const KEY = "alloyra.calculations.v1";
const running = new WeakMap<Worker, Map<string, () => void>>();
export function recordedPostMessage(worker: Worker, request: EngineRequest): void {
  const studyId = readWorkspace().activeId;
  const run: CalculationRecord = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), status: "running", request: JSON.parse(JSON.stringify(request)), engine: manifest, coverage: validationCoverage(request.compositionWt, request.dbId, request.kind === "point" ? request.tempC : 0, request.kind), events: [] };
  const save = () => { try {
    const study = readWorkspace().studies.find((s) => s.id === studyId); if (!study) return;
    const history = JSON.parse(study.slices[KEY] ?? "[]") as CalculationRecord[];
    const at = history.findIndex((r) => r.id === run.id); if (at < 0) history.push(run); else history[at] = run;
    setStudyItem(KEY, JSON.stringify(history), studyId);
  } catch { /* Shell displays the central storage error */ } };
  const finish = (status: CalculationRecord["status"]) => { run.status = status; run.finishedAt = new Date().toISOString(); worker.removeEventListener("message", observe); worker.removeEventListener("error", failed); running.get(worker)?.delete(run.id); save(); };
  let lastSave = Date.now();
  const observe = (event: MessageEvent<EngineResponse>) => {
    if (event.data.id !== request.id) return;
    run.events.push(event.data);
    if (event.data.kind === "point" || event.data.kind.endsWith("-done")) finish("ok" in event.data && event.data.ok ? "complete" : "error");
    else if (Date.now() - lastSave > 1500) { save(); lastSave = Date.now(); }
  };
  const failed = () => finish("error");
  let pending = running.get(worker); if (!pending) { pending = new Map(); running.set(worker,pending); }
  pending.set(run.id, () => finish("cancelled"));
  worker.addEventListener("message", observe); worker.addEventListener("error", failed); save();
  try { worker.postMessage(request); } catch (e) { finish("error"); throw e; }
}
export function terminateRecordedWorker(worker: Worker | null | undefined): void { if (!worker) return; for (const cancel of running.get(worker)?.values() ?? []) cancel(); worker.terminate(); }
