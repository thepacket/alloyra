import type { SavedStudy } from "./studyFormat";
export const escapeHtml = (value: unknown): string => String(value ?? "unknown").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
function render(value: unknown, depth = 0): string {
  if (depth > 16) return "[See portable bundle for nested records]";
  if (value === null || typeof value !== "object") return escapeHtml(value);
  if (Array.isArray(value)) return value.length ? `<ol>${value.map((v) => `<li>${render(v, depth + 1)}</li>`).join("")}</ol>` : "None recorded";
  return `<dl>${Object.entries(value).map(([k, v]) => `<dt>${escapeHtml(label(k))}</dt><dd>${k === "basis" ? "Exact input context retained in the portable bundle." : render(v, depth + 1)}</dd>`).join("")}</dl>`;
}
const titles: Record<string, string> = {
  "alloyra.materialRecords.v1": "Measured heat chemistry and test evidence",
  "alloyra.verification.v1": "Verification action history",
  "alloyra.verificationResults.v1": "Verification plan at the recorded inputs",
  "alloyra.screeningResults.v1": "Screening outcomes by exact condition",
  "alloyra.comparison.v1": "Comparison inputs and overrides", "alloyra.screening.v1": "Screening stages and chart settings",
  "alloyra.studio.v1": "Studio inputs and provenance", "alloyra.dutyProfiles.v1": "Duty profiles", "alloyra.rulesOverlay.v1": "Rule edits and review history",
  "alloyra.engineSettings.v1": "Thermodynamic model settings", "alloyra.calculations.v1": "Recorded thermodynamic calculations",
  "alloyra.comparisonResults.v1": "Comparison results at the recorded inputs", "alloyra.studioResults.v1": "Studio results at the recorded inputs",
};
export function studyReport(study: SavedStudy): string {
  const comparison = JSON.parse(study.slices["alloyra.comparison.v1"] ?? "{}");
  const slots = Array.isArray(comparison.slots) ? comparison.slots : [];
  const shortlist = slots.map((s: {uns: string; conditionId: string}) => {
    const a = study.references.alloys.find((a) => a.uns === s.uns), c = a?.conditions.find((c) => c.id === s.conditionId);
    return `<li>${escapeHtml(a?.names[0] ?? s.uns)} — ${escapeHtml(c?.name ?? s.conditionId)} (${escapeHtml(c?.form)})</li>`;
  }).join("");
  const snapshot = JSON.parse(study.slices["alloyra.comparisonResults.v1"] ?? "null");
  const comparisons = Array.isArray(snapshot?.results) ? snapshot.results : [];
  const comparisonTable = comparisons.length ? `<h2>Recorded comparison</h2><p>These scores belong to the snapshot inputs detailed below. Partial scores are not a candidate ranking.</p><table><thead><tr><th>Grade / condition</th><th>Performance</th><th>Coverage</th><th>Evidence gaps</th></tr></thead><tbody>${comparisons.map((r: {grade:string;condition:string;rank?:{score:number|null;scoreComplete:boolean;coveragePercent:number;eliminated:boolean;evidenceGaps:string[]}}) => `<tr><td>${escapeHtml(r.grade)} — ${escapeHtml(r.condition)}</td><td>${r.rank?.eliminated ? "Eliminated" : typeof r.rank?.score !== "number" ? "Unassessed" : `${r.rank.score.toFixed(1)} ${r.rank.scoreComplete ? "" : "(partial)"}`}</td><td>${r.rank ? `${escapeHtml(Number(r.rank.coveragePercent).toFixed(0))}%` : "Unassessed"}</td><td>${escapeHtml((Array.isArray(r.rank?.evidenceGaps) ? r.rank.evidenceGaps.join("; ") : "") || "None recorded")}</td></tr>`).join("")}</tbody></table>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(study.name)}</title><style>
body{font:16px/1.5 system-ui;margin:3rem auto;padding:0 1rem;max-width:70rem;color:#182536}h1,h2{line-height:1.2}dt{font-weight:600}dd{margin:0 0 .5rem 1rem}dl{border-left:2px solid #dce3e9;padding-left:.6rem}li{margin-bottom:.6rem}details{margin:1rem 0}summary{cursor:pointer;font-weight:600}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd5df;padding:8px;text-align:left;vertical-align:top}p{max-width:65ch}@media print{details{display:block}body{margin:0;font-size:11px}}
</style></head><body><h1>${escapeHtml(study.name)}</h1><p>Updated ${escapeHtml(study.updatedAt)}. Dataset ${escapeHtml(study.references.datasetVersion)}; ruleset ${escapeHtml(study.references.rulesetVersion)}.</p>
<p>Research screening record. Result snapshots retain the inputs used when calculated; later edits do not make a historical result current. Missing sections have not been saved or calculated. Run statuses describe the last saved event; a running record without a final event is incomplete. Null result values indicate unavailable or non-finite predictions. Source snapshots are included below and in the portable bundle.</p>
${comparisonTable}<h2>Shortlist</h2><ul>${shortlist || "<li>No candidates selected</li>"}</ul>
${Object.entries(study.slices).map(([key, raw]) => `<details><summary>${escapeHtml(titles[key] ?? key)}</summary>${render(JSON.parse(raw))}</details>`).join("")}
<h2>Source snapshots</h2><details><summary>Alloy conditions, property records and citations</summary>${render(study.references.alloys)}</details><details><summary>Baseline failure rules</summary>${render(study.references.rules)}</details></body></html>`;
}
export function downloadStudy(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
