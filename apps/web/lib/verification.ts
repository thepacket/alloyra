import { evaluateRules, rankCandidate, type DutyInput, type FailureRule, type Weights } from "@alloyra/core";
import { candidateFacts, type Alloy } from "@alloyra/data";
import { measuredCandidate, type MaterialRecord } from "./materialRecords";
import type { Slot } from "./comparison";
export const VERIFICATION = "alloyra.verification.v1";
export interface VerificationTask { id: string; basis: string; candidate: string; title: string; action: string; }
export interface VerificationUpdate extends VerificationTask { owner: string; status: "open"|"in-progress"|"resolved"; resolution: string; updatedAt: string; }
export function validateVerification(value: unknown): asserts value is VerificationUpdate[] {
  if(!Array.isArray(value)||value.length>5000)throw new Error("Invalid verification history.");
  for(const v of value) if(!v || ["id","basis","candidate","title","action","owner","resolution","updatedAt"].some((k)=>typeof v[k]!=="string") || !["open","in-progress","resolved"].includes(v.status) || (v.status==="resolved"&&!v.resolution.trim()))throw new Error("Invalid verification update; resolutions need an evidence note.");
}
export function verificationTasks(input: { alloys: readonly Alloy[]; slots: Slot[]; records: MaterialRecord[]; duty: DutyInput|null; rules: FailureRule[]; weights: Weights }): VerificationTask[] {
  const tasks: VerificationTask[]=[];
  const add=(id:string,basis:string,candidate:string,title:string,action:string)=>tasks.push({id,basis,candidate,title,action});
  if(!input.duty)add("duty", "no-duty", "Study", "Define service duty", "Record service temperature, loading and environment in Duty profiles, then select that duty for comparison.");
  if(!input.slots.some((s)=>!s.excluded))add("shortlist","empty-shortlist","Study","Select candidates","Add alloy conditions to the comparison to generate candidate-specific checks.");
  for(const slot of input.slots.filter((s)=>!s.excluded)) {
    const base=input.alloys.find((a)=>a.uns===slot.uns), condition=base?.conditions.find((c)=>c.id===slot.conditionId);if(!base||!condition)continue;
    const record=input.records.find((r)=>r.id===slot.materialRecordId);
    const candidate=`${base.names[0]} — ${condition.name}${record ? ` · heat ${record.heatId}` : ""}`;
    const basis=JSON.stringify({slot,record:record??null,duty:input.duty,rules:input.rules,weights:input.weights});
    const issue=(key:string,title:string,action:string)=>add(`${slot.conditionId}:${key}`,basis,candidate,title,action);
    if(!record)issue("material-record","Obtain material-specific evidence","Obtain the supplier certificate or internal test record for the intended heat/lot, form and thickness. Add it in Material records and select it for this condition.");
    if(record && record.thicknessMm===null)issue("thickness","Confirm product thickness","Confirm the tested product thickness from the source. Save a new material record and select it for comparison.");
    if(record && !Object.keys(record.chemistry).length)issue("chemistry","Obtain measured heat chemistry","Obtain measured element contents from the certificate. Specification midpoints are not substituted for missing chemistry.");
    if(record){
      const outside=base.composition.filter((range)=>{const v=record.chemistry[range.element];return v!==undefined&&((range.min!==undefined&&v<range.min)||(range.max!==undefined&&v>range.max));});
      if(outside.length)issue("chemistry-conformance","Check chemistry outside reference ranges",`Reported ${outside.map((r)=>r.element).join(", ")} lies outside the selected grade's recorded ranges. Confirm the grade designation, certificate and governing specification. Range comparison alone does not establish conformity.`);
    }
    if(!input.duty)continue;
    const selected=record?measuredCandidate(base,condition,record,input.duty.tempMaxC):{alloy:base,condition};
    const facts=candidateFacts(selected.alloy,selected.condition);
    if(record){facts.compositionBasis="measured";facts.specificationComposition=base.composition;}
    const audits=evaluateRules(facts,input.duty,input.rules);
    if(input.duty.tempMaxC===null)issue("temperature","Confirm service temperature","Enter the maximum service temperature in the active duty profile. Room-temperature tests do not establish elevated-temperature behavior.");
    else if(facts.yieldTestTempC!==input.duty.tempMaxC || facts.yieldMPa===undefined)issue("yield","Obtain yield evidence at the duty temperature",`Obtain an applicable yield test at ${input.duty.tempMaxC} °C for this condition, form and thickness. Add the test record; no extrapolation from another temperature is assumed.`);
    const rank=rankCandidate(facts,input.duty,audits,input.weights);
    for(const [i,gap] of rank.evidenceGaps.entries()) if(!/temperature|°C|yield|Failure audit has unresolved/i.test(gap))issue(`coverage-${i}`,"Resolve scoring evidence gap",gap+" Obtain supporting evidence or explicitly revise the requested criterion in the comparison.");
    const missing=[...new Set(audits.flatMap((a)=>a.unchecked))];
    if(missing.length)issue("duty-inputs","Confirm missing duty or material inputs",`Confirm: ${missing.join(", ")}. Update the duty or measured record from a cited source; unknown does not mean absent.`);
    for(const a of audits.filter((a)=>a.status==="hit"||a.status==="near"))issue(`rule-${a.rule.id}`,`Review ${a.rule.name}`,`${a.rule.mechanism} Review applicability and record an engineering assessment. Suggested checks/mitigations from the rule: ${a.rule.mitigations.join("; ")}. Source: ${a.rule.citation}`);
    if(!input.rules.length)issue("rule-review","Arrange a failure-mechanism review","No active reviewed rules ran. Obtain an applicable expert review; an empty automated audit is not evidence of suitability.");
    else if(input.rules.some((r)=>r.reviewStatus==="draft"))issue("rule-review","Review draft rule assumptions","Draft rules were included. Obtain a named expert assessment of applicable mechanisms and thresholds; resolving this task does not promote a rule's review status.");
  }
  return tasks;
}
export function taskUpdate(task: VerificationTask, history: VerificationUpdate[]): {update: VerificationUpdate|undefined; stale:boolean} {
  const update=[...history].reverse().find((u)=>u.id===task.id);
  return {update,stale:!!update && update.basis!==task.basis};
}
