import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { activeStudy, createStudy, exportStudyBundle, getStudyItem, importStudyBundle, matchesCurrentData, continueWithCurrentData, requiresCurrentStudy, readWorkspace, reloadWorkspace, setStudyItem, switchStudy } from "../lib/workspace";
import { parseStudyBundle } from "../lib/studyFormat";
import { defaultStored, exampleProfile, EXAMPLE_SLOTS } from "../lib/comparison";
import { studyReport } from "../lib/studyReport";
import { validationCoverage } from "../lib/validation";
import cases from "../lib/validationCases.json";
import { recordedPostMessage, terminateRecordedWorker } from "../lib/calculationHistory";
import { DECISIONS, DECISION_DRAFT, blankDecision, createDecisionRecord, validateDecisionRecords, evidenceChanged } from "../lib/decisions";
let data: Map<string,string>;
beforeEach(() => {
  data = new Map(); vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key,value) });
  reloadWorkspace();
});
afterEach(async () => { await Promise.resolve(); vi.unstubAllGlobals(); reloadWorkspace(); });
describe("portable studies", () => {
  it("round-trips selected measurements and verification notes; rejects dangling evidence", () => {
    const b=exportStudyBundle(); const a=b.study.references.alloys[0]!, c=a.conditions[0]!;
    const r={id:"record-1",createdAt:"2026-09-07",uns:a.uns,conditionId:c.id,heatId:"heat-1",form:"plate",thicknessMm:10,source:"cert-1",chemistry:{Cr:18},tests:[{property:"yield_strength",value:230,unit:"MPa",testTempC:23,source:"test-1"}]};
    b.study.slices["alloyra.materialRecords.v1"]=JSON.stringify([r]);
    b.study.slices["alloyra.verification.v1"]=JSON.stringify([{id:"task-1",basis:"inputs-1",candidate:"heat-1",title:"Confirm temperature",action:"Get test report",owner:"Alex",status:"resolved",resolution:"See test-1",updatedAt:"2026-09-07"}]);
    b.study.slices["alloyra.comparison.v1"]=JSON.stringify({...defaultStored(),slots:[{uns:a.uns,conditionId:c.id,materialRecordId:r.id,pinned:false,excluded:false}]});
    importStudyBundle(JSON.stringify(b));expect(JSON.parse(getStudyItem("alloyra.verification.v1")!)[0].owner).toBe("Alex");expect(JSON.parse(getStudyItem("alloyra.comparison.v1")!).slots[0].materialRecordId).toBe(r.id);
    expect(studyReport(activeStudy()!)).toContain("Measured heat chemistry and test evidence");
    b.study.slices["alloyra.materialRecords.v1"]="[]";expect(()=>parseStudyBundle(JSON.stringify(b))).toThrow(/missing or mismatched/);
  });
  it("round-trips the shipped reference snapshot and exact conditions", () => {
    const profile = exampleProfile();
    setStudyItem("alloyra.dutyProfiles.v1", JSON.stringify([profile]));
    setStudyItem("alloyra.comparison.v1", JSON.stringify({...defaultStored(), profileId:profile.id, slots:EXAMPLE_SLOTS}));
    const bundle = exportStudyBundle();
    expect(parseStudyBundle(JSON.stringify(bundle))).toEqual(bundle);
    const before = activeStudy()!.id; const imported = importStudyBundle(JSON.stringify(bundle));
    expect(imported).not.toBe(before); expect(readWorkspace().studies).toHaveLength(2);
    expect(matchesCurrentData(activeStudy()!)).toBe(true);
    expect(JSON.parse(getStudyItem("alloyra.comparison.v1")!).slots).toEqual(EXAMPLE_SLOTS);
  });
  it("duplicates deeply and switches all study slices together", () => {
    setStudyItem("alloyra.screening.v1", JSON.stringify({stages:[],xAxis:"density",yAxis:"yield"}));
    const first = activeStudy()!.id;
    createStudy("Variant",true); setStudyItem("alloyra.screening.v1", "{\"stages\":[1]}");
    switchStudy(first); expect(JSON.parse(getStudyItem("alloyra.screening.v1")!).stages).toEqual([]);
    createStudy("Blank"); expect(getStudyItem("alloyra.screening.v1")).toBeNull();
  });
  it("migrates legacy values without deleting recovery copies", () => {
    data.set("alloyra.comparison.v1",JSON.stringify({...defaultStored(),studyName:"Legacy"}));
    expect(activeStudy()!.name).toBe("Legacy"); expect(data.has("alloyra.comparison.v1")).toBe(true);
  });
  it("rejects malformed files without mutating the workspace", () => {
    const good = exportStudyBundle(); const before = data.get("alloyra.workspace.v1");
    good.study.slices["alloyra.comparison.v1"] = JSON.stringify({...defaultStored(),weights:{strength:-1,corrosion:1,auditCleanliness:1}});
    expect(() => importStudyBundle(JSON.stringify(good))).toThrow(/weights/);
    expect(data.get("alloyra.workspace.v1")).toBe(before);
  });
  it("rejects absent duty references and duplicate condition slots", () => {
    const b=exportStudyBundle(); b.study.slices["alloyra.comparison.v1"]=JSON.stringify({...defaultStored(),profileId:"missing"});
    expect(()=>parseStudyBundle(JSON.stringify(b))).toThrow(/duty/);
    b.study.slices["alloyra.comparison.v1"]=JSON.stringify({...defaultStored(),slots:[EXAMPLE_SLOTS[0],EXAMPLE_SLOTS[0]]});
    expect(()=>parseStudyBundle(JSON.stringify(b))).toThrow(/Duplicate/);
  });
  it("keeps data unchanged when a storage write fails", () => {
    const before=activeStudy()!.id;
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:()=>{throw new Error("Quota exceeded");}});
    expect(()=>createStudy("Cannot save")).toThrow(/Quota/);
    expect(activeStudy()!.id).toBe(before);expect(readWorkspace().studies).toHaveLength(1);
  });
  it("retains changed references as an archive and escapes report content", () => {
    const b=exportStudyBundle(); b.study.name="<script>alert(1)</script>";
    b.study.references.datasetVersion="historical";
    importStudyBundle(JSON.stringify(b));expect(matchesCurrentData(activeStudy()!)).toBe(false);
    expect(studyReport(activeStudy()!)).not.toContain("<script>"); expect(studyReport(activeStudy()!)).toContain("&lt;script&gt;");
  });
});
describe("calculation-specific coverage", () => {
  const c=cases.cases[0]!;
  it("distinguishes exact documented points, disagreements and new conditions", () => {
    expect(validationCoverage(c.wt as Record<string,number>,c.db,500)).toContain("Phase sets agree");
    expect(validationCoverage(c.wt as Record<string,number>,c.db,700)).toContain("Phase sets disagree");
    expect(validationCoverage(c.wt as Record<string,number>,c.db,501)).toContain("outside those test points");
    expect(validationCoverage({...c.wt,Cr:16} as Record<string,number>,c.db,500)).toContain("outside the documented case set");
    expect(validationCoverage(c.wt as Record<string,number>,c.db,500,"scheil")).toContain("does not validate this calculation mode");
  });
  it("stores complete outputs against the originating study after a switch", () => {
    class FakeWorker extends EventTarget { postMessage=vi.fn(); terminate=vi.fn(); }
    const worker=new FakeWorker(); const first=activeStudy()!.id;
    recordedPostMessage(worker as unknown as Worker,{id:1,kind:"point",dbId:c.db,tdbUrl:"/tdb/test.tdb",compositionWt:c.wt as Record<string,number>,tempC:500});
    createStudy("Other");
    worker.dispatchEvent(new MessageEvent("message",{data:{id:1,kind:"point",ok:true,result:{phases:[],gPerMoleAtom:1}}}));
    expect(getStudyItem("alloyra.calculations.v1")).toBeNull(); switchStudy(first);
    const runs=JSON.parse(getStudyItem("alloyra.calculations.v1")!);expect(runs[0].status).toBe("complete"); expect(runs[0].events[0].result.gPerMoleAtom).toBe(1);
    expect(parseStudyBundle(JSON.stringify(exportStudyBundle())).study.slices["alloyra.calculations.v1"]).toBeTruthy();
  });
  it("retains cancelled runs without inventing a completed result", () => {
    class FakeWorker extends EventTarget { postMessage=vi.fn(); terminate=vi.fn(); }
    const worker=new FakeWorker();
    recordedPostMessage(worker as unknown as Worker,{id:1,kind:"point",dbId:c.db,tdbUrl:"/tdb/test.tdb",compositionWt:c.wt as Record<string,number>,tempC:500});
    terminateRecordedWorker(worker as unknown as Worker);
    expect(JSON.parse(getStudyItem("alloyra.calculations.v1")!)[0].status).toBe("cancelled"); expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

describe("engineering decision records",()=>{
  const prepare=()=>{setStudyItem("alloyra.comparison.v1",JSON.stringify({...defaultStored(),slots:EXAMPLE_SLOTS.slice(0,2)}));return activeStudy()!;};
  const draft=()=>({...blankDecision(),outcome:"preferred" as const,selectedConditionId:EXAMPLE_SLOTS[0]!.conditionId,reviewer:"Engineer",rationale:"Retain for further tests",unresolved:"Need temperature-specific strength evidence",alternatives:{[EXAMPLE_SLOTS[1]!.conditionId]:"Retain as a backup pending corrosion evidence"}});
  it("freezes evidence and reports later changes without changing the original",()=>{
    const study=prepare(),r=createDecisionRecord(study,draft());const saved=JSON.stringify(r);
    expect(evidenceChanged(r,study)).toBe(false);
    study.slices["alloyra.comparison.v1"]=JSON.stringify({...defaultStored(),slots:EXAMPLE_SLOTS.slice(0,1)});
    expect(evidenceChanged(r,study)).toBe(true);expect(JSON.stringify(r)).toBe(saved);
  });
  it("excludes drafts and prior decisions from snapshots and stale detection",()=>{
    const study=prepare(),r=createDecisionRecord(study,draft());
    study.slices[DECISION_DRAFT]=JSON.stringify(draft());study.slices[DECISIONS]=JSON.stringify([r]);
    expect(evidenceChanged(r,study)).toBe(false);
    const revision=createDecisionRecord(study,draft(),[r]);expect(revision.supersedes).toBe(r.id);
    expect(revision.snapshot.slices[DECISIONS]).toBeUndefined();expect(revision.snapshot.slices[DECISION_DRAFT]).toBeUndefined();validateDecisionRecords([r,revision]);
  });
  it("requires an eligible selection and a disposition for every alternative",()=>{
    const study=prepare();expect(()=>createDecisionRecord(study,{...draft(),alternatives:{}})).toThrow(/alternative/);
    const c=JSON.parse(study.slices["alloyra.comparison.v1"]!);c.slots[0].excluded=true;study.slices["alloyra.comparison.v1"]=JSON.stringify(c);
    expect(()=>createDecisionRecord(study,draft())).toThrow(/non-excluded/);
  });
  it("can explicitly defer a decision without selecting a material",()=>{
    const study=activeStudy()!;const r=createDecisionRecord(study,{...draft(),outcome:"insufficient-evidence",selectedConditionId:"",alternatives:{}});
    expect(r.selected).toBeNull();expect(r.outcome).toBe("insufficient-evidence");validateDecisionRecords([r]);
  });
  it("requires reviewer, rationale and an explicit unresolved-question statement",()=>{
    const study=prepare();for(const field of ["reviewer","rationale","unresolved"]){expect(()=>createDecisionRecord(study,{...draft(),[field]:""})).toThrow(/reviewer/);}
  });
  it("round-trips decision evidence even after the current shortlist changes",()=>{
    const study=prepare(),r=createDecisionRecord(study,draft());setStudyItem(DECISIONS,JSON.stringify([r]));setStudyItem("alloyra.comparison.v1",JSON.stringify(defaultStored()));
    const bundle=exportStudyBundle();importStudyBundle(JSON.stringify(bundle));const restored=JSON.parse(getStudyItem(DECISIONS)!)[0];expect(restored).toEqual(r);expect(evidenceChanged(restored,activeStudy()!)).toBe(true);
  });
  it("rejects recursive and invalid frozen snapshots before importing",()=>{
    const study=prepare(),r=createDecisionRecord(study,draft()),b=exportStudyBundle();r.snapshot.slices[DECISIONS]="[]";b.study.slices[DECISIONS]=JSON.stringify([r]);
    expect(()=>parseStudyBundle(JSON.stringify(b))).toThrow(/Recursive/);
    delete r.snapshot.slices[DECISIONS];r.snapshot.slices["alloyra.materialRecords.v1"]="[{}]";b.study.slices[DECISIONS]=JSON.stringify([r]);
    const before=JSON.stringify(readWorkspace());expect(()=>importStudyBundle(JSON.stringify(b))).toThrow();expect(JSON.stringify(readWorkspace())).toBe(before);
  });
  it("escapes decision text in readable reports",()=>{
    const study=prepare(),r=createDecisionRecord(study,{...draft(),reviewer:"<script>unsafe</script>"});study.slices[DECISIONS]=JSON.stringify([r]);const report=studyReport(study);expect(report).toContain("&lt;script&gt;unsafe");expect(report).not.toContain("<script>");
  });
});


describe("property publication citations", () => {
  it("preserves citations through bundle import and reports", () => {
    const bundle = exportStudyBundle();
    const imported = parseStudyBundle(JSON.stringify(bundle));
    const p = imported.study.references.alloys.find(a=>a.uns==="S31603")!.conditions[0]!.properties.find(p=>p.citation)!;
    expect(p.citation!.reviewStatus).toBe("pending");
    expect(studyReport(imported.study)).toContain("Table 7");
    // Legacy records without structured citations remain portable.
    for (const a of bundle.study.references.alloys) for (const c of a.conditions) for (const p of c.properties) delete p.citation;
    expect(()=>parseStudyBundle(JSON.stringify(bundle))).not.toThrow();
  });
  it("rejects unsafe citation URLs and fabricated review states without mutation", () => {
    const bundle=exportStudyBundle();
    const p=bundle.study.references.alloys.find(a=>a.uns==="S31603")!.conditions[0]!.properties.find(p=>p.citation)!;
    const before=JSON.stringify(readWorkspace());
    p.citation!.url="javascript:alert(1)";
    expect(()=>importStudyBundle(JSON.stringify(bundle))).toThrow(/citation/);
    p.citation!.url="https://example.com/source";
    (p.citation as unknown as {reviewStatus:string}).reviewStatus="approved";
    expect(()=>importStudyBundle(JSON.stringify(bundle))).toThrow(/citation/);
    expect(JSON.stringify(readWorkspace())).toBe(before);
  });
});


describe("continuing older studies", () => {
  it("copies inputs onto current references while preserving the complete original", () => {
    setStudyItem("alloyra.comparison.v1", JSON.stringify(defaultStored()));
    const old = activeStudy()!;
    old.references.datasetVersion = "older-release";
    old.slices["alloyra.comparisonResults.v1"] = JSON.stringify({oldResult:true});
    old.slices["alloyra.decisions.v1"] = JSON.stringify([{historic:true}]);
    old.slices["alloyra.verification.v1"] = JSON.stringify([{historic:true}]);
    const before = JSON.stringify(old);
    const id = continueWithCurrentData();
    expect(id).not.toBe(old.id);
    expect(JSON.stringify(readWorkspace().studies.find(s=>s.id===old.id))).toBe(before);
    expect(matchesCurrentData(activeStudy()!)).toBe(true);
    expect(JSON.parse(getStudyItem("alloyra.comparison.v1")!).slots).toEqual(defaultStored().slots);
    for (const key of ["alloyra.comparisonResults.v1", "alloyra.decisions.v1", "alloyra.verification.v1"]) expect(getStudyItem(key)).toBeNull();
    expect(continueWithCurrentData()).toBe(id);
    expect(readWorkspace().studies).toHaveLength(2);
  });
  it("leaves the active study untouched if its inputs cannot migrate", () => {
    setStudyItem("alloyra.comparison.v1", JSON.stringify({...defaultStored(), slots:[{uns:"REMOVED",conditionId:"missing",pinned:false,excluded:false}]}));
    activeStudy()!.references.datasetVersion="older-release";
    const before=JSON.stringify(readWorkspace());
    expect(()=>continueWithCurrentData()).toThrow(/incompatible/);
    expect(JSON.stringify(readWorkspace())).toBe(before);
  });
  it("keeps the original active if saving the updated copy fails", () => {
    activeStudy()!.references.datasetVersion="older-release";
    const before=JSON.stringify(readWorkspace());
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:()=>{throw new Error("Quota exceeded");}});
    expect(()=>continueWithCurrentData()).toThrow(/Quota/);
    expect(JSON.stringify(readWorkspace())).toBe(before);
  });
  it("allows saved studies and reference browsing with or without trailing slashes", () => {
    for (const path of ["/studies","/studies/","/database","/database/"]) expect(requiresCurrentStudy(path)).toBe(false);
    for (const path of ["/comparisons/","/studio","/records/","/decisions/"]) expect(requiresCurrentStudy(path)).toBe(true);
  });
});
