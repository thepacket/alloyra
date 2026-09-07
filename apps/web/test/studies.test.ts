import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { activeStudy, createStudy, exportStudyBundle, getStudyItem, importStudyBundle, matchesCurrentData, readWorkspace, reloadWorkspace, setStudyItem, switchStudy } from "../lib/workspace";
import { parseStudyBundle } from "../lib/studyFormat";
import { defaultStored, exampleProfile, EXAMPLE_SLOTS } from "../lib/comparison";
import { studyReport } from "../lib/studyReport";
import { validationCoverage } from "../lib/validation";
import cases from "../lib/validationCases.json";
import { recordedPostMessage, terminateRecordedWorker } from "../lib/calculationHistory";
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
