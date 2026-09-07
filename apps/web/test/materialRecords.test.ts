import { describe, expect, it } from "vitest";
import { alloys, candidateFacts, failureRules } from "@alloyra/data";
import { rankCandidate, evaluateRules, prenForFamily, type CandidateFacts, type FailureRule } from "@alloyra/core";
import { MATERIAL_CSV_TEMPLATE, materialRecordsFromCsv, measuredCandidate, validateMaterialRecords, type MaterialRecord } from "../lib/materialRecords";
import { verificationTasks, taskUpdate, validateVerification, type VerificationUpdate } from "../lib/verification";
import { blankProfile, dutyFromProfile } from "../lib/profiles";
const base=alloys.find((a)=>a.uns==="S31603")!, condition=base.conditions[0]!;
const line=(kind="chemistry",name="Cr",value="17.2",unit="wt%",temp="")=>`H-42,S31603,${condition.id},plate,12,"Issuer, cert 42",${kind},${name},${value},${unit},${temp}`;
const record=():MaterialRecord=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line()+"\n"+line("test","yield_strength","190","MPa","200"))[0]!;
const duty={...dutyFromProfile(blankProfile()),tempMaxC:200,designStressMPa:100};
const weights={strength:1,corrosion:1,auditCleanliness:0};
describe("measured CSV import",()=>{
  it("groups quoted-source rows into one heat and keeps temperature and thickness",()=>{
    const r=record();validateMaterialRecords([r],alloys);expect(r.source).toBe("Issuer, cert 42");expect(r.thicknessMm).toBe(12);expect(r.chemistry).toEqual({Cr:17.2});expect(r.tests[0]!.testTempC).toBe(200);
  });
  it.each([line("chemistry","Cr","","wt%"),line("chemistry","Cr","<0.03","wt%"),line("test","yield_strength","200","ksi","23"),line("test","yield_strength","200","MPa",""),line("chemistry","Cr","-1","wt%"),line("chemistry","Bad","1","wt%")])("rejects ambiguous or invalid measurements: %s",(row)=>{expect(()=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+row)).toThrow();});
  it("rejects duplicate elements, inconsistent metadata and over-100 totals",()=>{
    expect(()=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line()+"\n"+line())).toThrow(/Duplicate/);
    expect(()=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line()+"\n"+line("chemistry","Ni","12").replace("plate,12","bar,12"))).toThrow(/inconsistent/);
    expect(()=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line("chemistry","Cr","90")+"\n"+line("chemistry","Ni","20"))).toThrow(/100/);
  });
  it("rejects a malformed later row instead of importing the earlier valid heat",()=>{expect(()=>materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line()+"\nwrong,columns")).toThrow(/row 3/);});
  it("distinguishes explicit zero from an unknown element",()=>{const r=materialRecordsFromCsv(MATERIAL_CSV_TEMPLATE+line("chemistry","W","0"))[0]!;expect(r.chemistry.W).toBe(0);expect(r.chemistry.Mo).toBeUndefined();});
});
describe("measured evidence in calculations",()=>{
  it("never borrows tests or chemistry from the reference and chooses the exact test temperature",()=>{
    const r=record();r.tests.unshift({...r.tests[0]!,value:260,testTempC:23});
    const selected=measuredCandidate(base,condition,r,200);expect(selected.alloy.composition).toEqual([{element:"Cr",min:17.2,max:17.2}]);expect(selected.condition.properties.find((p)=>p.property==="tensile_strength")).toBeUndefined();
    const facts={...candidateFacts(selected.alloy,selected.condition),compositionBasis:"measured" as const,specificationComposition:base.composition};
    expect(facts.yieldMPa).toBe(190);expect(facts.yieldTestTempC).toBe(200);
    const score=rankCandidate(facts,duty,[],weights);expect(score.contributions[0]!.included).toBe(true);expect(score.contributions[1]!.included).toBe(false);expect(score.evidenceGaps.join(" ")).toContain("Mo, N, W");
    expect(base.composition).not.toEqual(selected.alloy.composition);
  });
  it("does not request stainless PREN chemistry for a measured aluminum alloy",()=>{
    const a=alloys.find((a)=>a.uns==="A96061")!,c=a.conditions[0]!;
    const facts:CandidateFacts={...candidateFacts(a,c),compositionBasis:"measured",composition:[{element:"Al",min:98,max:98}]};
    const r=rankCandidate(facts,duty,[],weights);expect(r.evidenceGaps.join(" ")).not.toContain("Measured PREN inputs missing");
  });
  it("requires all PREN terms for measured records, including explicit zeros",()=>{
    expect(prenForFamily({Cr:17},base.family,true).inWindow).toBe(false);
    expect(prenForFamily({Cr:17,Mo:2,N:0.04,W:0},base.family,true).value).toBeCloseTo(24.24);
  });
  it("keeps missing measured rule content indeterminate, while spec clauses use the reference specification",()=>{
    const selected=measuredCandidate(base,condition,record(),200);
    const facts:CandidateFacts={...candidateFacts(selected.alloy,selected.condition),compositionBasis:"measured",specificationComposition:base.composition};
    const template=failureRules[0]!;
    const rule=(clause:FailureRule["when"][number]):FailureRule=>({...template,when:[clause]});
    expect(evaluateRules(facts,duty,[rule({kind:"contentAtLeast",element:"Ni",wtPct:5})])[0]!.status).toBe("indeterminate");
    expect(evaluateRules(facts,duty,[rule({kind:"prenBelow",value:30})])[0]!.status).toBe("indeterminate");
    expect(evaluateRules(facts,duty,[rule({kind:"specMaxAbove",element:"Cr",above:10})])[0]!.status).toBe("hit");
  });
});
describe("verification actions",()=>{
  const input=()=>({alloys,slots:[{uns:base.uns,conditionId:condition.id,pinned:false,excluded:false}],records:[] as MaterialRecord[],duty,rules:[],weights});
  it("requests actionable evidence and does not treat a room-temperature record as elevated-temperature evidence",()=>{
    const tasks=verificationTasks(input());expect(tasks.some((t)=>t.id.endsWith(":yield")&&t.action.includes("200 °C"))).toBe(true);expect(tasks.some((t)=>t.id.endsWith(":material-record"))).toBe(true);
    const r=record();const matched={...input(),records:[r],slots:[{...input().slots[0]!,materialRecordId:r.id}]};expect(verificationTasks(matched).some((t)=>t.id.endsWith(":yield"))).toBe(false);
  });
  it("retains a resolution only while its evidence context is unchanged",()=>{
    const original=verificationTasks(input()).find((t)=>t.id.endsWith(":yield"))!;
    const update:VerificationUpdate={...original,status:"resolved",owner:"Reviewer",resolution:"Certificate requested; review logged",updatedAt:new Date().toISOString()};
    expect(taskUpdate(original,[update]).stale).toBe(false);
    const changed=verificationTasks({...input(),duty:{...duty,tempMaxC:300}}).find((t)=>t.id===original.id)!;
    expect(taskUpdate(changed,[update]).stale).toBe(true);expect(update.status).toBe("resolved");
  });
  it("requires a resolution note and preserves original history records",()=>{expect(()=>validateVerification([{...verificationTasks(input())[0]!,owner:"",status:"resolved",resolution:"",updatedAt:"now"}])).toThrow(/resolution/);});
  it("flags measured chemistry outside the selected grade ranges",()=>{const r={...record(),chemistry:{Cr:30}};const tasks=verificationTasks({...input(),records:[r],slots:[{...input().slots[0]!,materialRecordId:r.id}]});expect(tasks.some((t)=>t.id.endsWith(":chemistry-conformance"))).toBe(true);});
});
