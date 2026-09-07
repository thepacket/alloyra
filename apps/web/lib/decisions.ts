import type { SavedStudy } from "./studyFormat";
import type { Slot } from "./comparison";
export const DECISIONS = "alloyra.decisions.v1";
export const DECISION_DRAFT = "alloyra.decisionDraft.v1";
export type DecisionOutcome = "preferred" | "insufficient-evidence" | "no-suitable-candidate";
export interface DecisionDraft { outcome: DecisionOutcome; selectedConditionId: string; rationale: string; reviewer: string; unresolved: string; alternatives: Record<string,string>; }
export interface DecisionRecord {
  id: string; recordedAt: string; supersedes: string|null; outcome: DecisionOutcome;
  selected: Slot|null; rationale: string; reviewer: string; unresolved: string;
  alternatives: { candidate: Slot; reason: string }[];
  snapshot: SavedStudy;
}
export const blankDecision = (): DecisionDraft => ({outcome:"insufficient-evidence",selectedConditionId:"",rationale:"",reviewer:"",unresolved:"",alternatives:{}});
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const str=(v:unknown):v is string=>typeof v==="string"&&v.length<=10000;
const outcomes=["preferred","insufficient-evidence","no-suitable-candidate"];
export function validateDecisionDraft(v:unknown):asserts v is DecisionDraft {
  if(!obj(v)||!outcomes.includes(String(v.outcome))||![v.selectedConditionId,v.rationale,v.reviewer,v.unresolved].every(str)||!obj(v.alternatives)||!Object.values(v.alternatives).every(str))throw new Error("Invalid decision draft.");
}
export function decisionSlots(study:SavedStudy):Slot[]{return JSON.parse(study.slices["alloyra.comparison.v1"]??"{\"slots\":[]}").slots;}
export function decisionCandidateName(study:SavedStudy,slot:Slot):string {
  const alloy=study.references.alloys.find((a)=>a.uns===slot.uns),condition=alloy?.conditions.find((c)=>c.id===slot.conditionId);
  const record=JSON.parse(study.slices["alloyra.materialRecords.v1"]??"[]").find((r:{id:string})=>r.id===slot.materialRecordId);
  return `${alloy?.names[0]??slot.uns} — ${condition?.name??slot.conditionId}${record?` · heat ${record.heatId}`:""}${slot.excluded?" (excluded)":""}`;
}
export function decisionSnapshot(study:SavedStudy):SavedStudy {
  const copy=JSON.parse(JSON.stringify(study)) as SavedStudy;
  delete copy.slices[DECISIONS];delete copy.slices[DECISION_DRAFT];
  return copy;
}
function canonical(v:unknown):string {
  if(Array.isArray(v))return `[${v.map(canonical).join(",")}]`;
  if(obj(v))return `{${Object.keys(v).sort().map((k)=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/** Naming and decision edits do not change the evidence; input/result edits do. */
export function evidenceChanged(record:Pick<DecisionRecord,"snapshot">,current:SavedStudy):boolean {
  const basis=(study:SavedStudy)=>{
    const copy=decisionSnapshot(study), comparison=copy.slices["alloyra.comparison.v1"];
    const slices=Object.fromEntries(Object.entries(copy.slices).map(([k,v])=>[k,JSON.parse(v)]));
    if(comparison)delete (slices["alloyra.comparison.v1"] as Record<string,unknown>).studyName;
    return {references:copy.references,slices};
  };
  return canonical(basis(record.snapshot))!==canonical(basis(current));
}
export function createDecisionRecord(study:SavedStudy,draft:DecisionDraft,previous:DecisionRecord[]=[]):DecisionRecord {
  validateDecisionDraft(draft);
  if(!draft.reviewer.trim()||!draft.rationale.trim()||!draft.unresolved.trim())throw new Error("Enter reviewer, engineering rationale and unresolved questions (or an explicit statement that none were identified).");
  const slots=decisionSlots(study),selected=draft.outcome==="preferred"?slots.find((s)=>s.conditionId===draft.selectedConditionId&&!s.excluded):undefined;
  if(draft.outcome==="preferred"&&!selected)throw new Error("Choose a non-excluded condition from the current comparison.");
  const alternatives=slots.filter((s)=>s.conditionId!==selected?.conditionId).map((candidate)=>({candidate,reason:draft.alternatives[candidate.conditionId]?.trim()??""}));
  if(alternatives.some((a)=>!a.reason))throw new Error("Explain the disposition of every alternative, including excluded conditions.");
  return JSON.parse(JSON.stringify({id:crypto.randomUUID(),recordedAt:new Date().toISOString(),supersedes:previous.at(-1)?.id??null,outcome:draft.outcome,selected:selected??null,rationale:draft.rationale.trim(),reviewer:draft.reviewer.trim(),unresolved:draft.unresolved.trim(),alternatives,snapshot:decisionSnapshot(study)}));
}
export function validateDecisionRecords(value:unknown):asserts value is DecisionRecord[] {
  if(!Array.isArray(value)||value.length>50)throw new Error("Invalid decision history or more than 50 records.");
  const ids=new Set<string>();
  for(const r of value){
    if(!obj(r)||!str(r.id)||!r.id||ids.has(r.id)||!str(r.recordedAt)||!Number.isFinite(Date.parse(r.recordedAt))||!outcomes.includes(String(r.outcome))||![r.rationale,r.reviewer,r.unresolved].every((s)=>str(s)&&s.trim())||!Array.isArray(r.alternatives)||!obj(r.snapshot)||!obj(r.snapshot.slices))throw new Error("Invalid recorded decision.");
    if(r.supersedes!==null&&(!str(r.supersedes)||!ids.has(r.supersedes)))throw new Error("Decision supersedes an absent earlier record.");ids.add(r.id);
    if(DECISIONS in r.snapshot.slices||DECISION_DRAFT in r.snapshot.slices)throw new Error("Recursive decision snapshots are not permitted.");
    const snapshot=r.snapshot as unknown as SavedStudy;
    let slots:Slot[];try{slots=decisionSlots(snapshot);}catch{throw new Error("Invalid frozen comparison.");}
    if(!Array.isArray(slots))throw new Error("Invalid frozen shortlist.");
    const matches=(candidate:unknown)=>slots.some((s)=>canonical(s)===canonical(candidate));
    if(r.outcome==="preferred"?(!obj(r.selected)||r.selected.excluded!==false||!matches(r.selected)):r.selected!==null)throw new Error("Decision selection does not match its frozen shortlist.");
    const selectedId=obj(r.selected)?r.selected.conditionId:null;
    const expected=slots.filter((s)=>s.conditionId!==selectedId);
    if(r.alternatives.length!==expected.length||r.alternatives.some((a)=>!obj(a)||!matches(a.candidate)||!obj(a.candidate)||a.candidate.conditionId===selectedId||!str(a.reason)||!a.reason.trim())||new Set(r.alternatives.map((a)=>(a.candidate as Slot).conditionId)).size!==expected.length)throw new Error("Every frozen alternative requires one disposition.");
  }
}
