import type { Alloy, Condition } from "@alloyra/data";
import type { ElementSymbol } from "@alloyra/core";
export const MATERIAL_RECORDS = "alloyra.materialRecords.v1";
export const ELEMENTS = "C Mn Si P S Cr Ni Mo N Cu W Nb Ti Al V Fe Zn Mg O H Ta Co Sn Pb Zr B".split(" ");
export const TEST_PROPERTIES = { yield_strength: "MPa", tensile_strength: "MPa", elongation: "%", density: "g/cm³" } as const;
export type TestProperty = keyof typeof TEST_PROPERTIES;
export interface MaterialTest { property: TestProperty; value: number; unit: string; testTempC: number; source: string; }
export interface MaterialRecord {
  id: string; createdAt: string; uns: string; conditionId: string; heatId: string; form: string;
  thicknessMm: number | null; source: string; chemistry: Partial<Record<ElementSymbol, number>>; tests: MaterialTest[];
}
const obj = (v: unknown): v is Record<string,unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2000;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function validateMaterialRecords(value: unknown, alloys?: readonly Alloy[]): asserts value is MaterialRecord[] {
  requireValue(Array.isArray(value) && value.length <= 500, "Expected at most 500 material records.");
  const ids = new Set<string>();
  for (const r of value) {
    requireValue(obj(r) && [r.id,r.createdAt,r.uns,r.conditionId,r.heatId,r.form,r.source].every(text), "Record needs grade, condition, heat/lot, form and source.");
    requireValue(!ids.has(r.id as string), "Duplicate material record ID."); ids.add(r.id as string);
    requireValue(r.thicknessMm === null || (finite(r.thicknessMm) && r.thicknessMm > 0), "Thickness must be positive or unknown.");
    requireValue(obj(r.chemistry) && Object.entries(r.chemistry).every(([el,n]) => ELEMENTS.includes(el) && finite(n) && n >= 0 && n <= 100), "Chemistry must use supported elements and numeric wt% from 0 to 100; blank is unknown.");
    requireValue(Object.values(r.chemistry).reduce<number>((sum,n) => sum+(n as number),0) <= 100.000001, "Reported chemistry exceeds 100 wt%. No automatic normalization is performed.");
    requireValue(Array.isArray(r.tests) && r.tests.length <= 200, "Too many test records.");
    const tests = new Set<string>();
    for (const t of r.tests) {
      requireValue(obj(t) && typeof t.property === "string" && Object.hasOwn(TEST_PROPERTIES,t.property) && finite(t.value) && t.value >= 0 && finite(t.testTempC) && t.testTempC > -273.15 && text(t.source), "Each test needs a supported property, nonnegative value, temperature above absolute zero and source.");
      requireValue(t.unit === TEST_PROPERTIES[t.property as TestProperty], "Test units must match the template; no unit conversion is assumed.");
      requireValue(t.property !== "elongation" || t.value <= 100, "Elongation must not exceed 100%.");
      requireValue(t.property !== "density" || t.value > 0, "Density must be positive.");
      const key = `${t.property}:${t.testTempC}`; requireValue(!tests.has(key), "Duplicate property at the same temperature. Enter an explicitly selected representative result in a separate record."); tests.add(key);
    }
    requireValue(Object.keys(r.chemistry).length > 0 || r.tests.length > 0, "Enter at least one measured chemistry value or test result.");
    if (alloys) requireValue(alloys.some((a) => a.uns === r.uns && a.conditions.some((c) => c.id === r.conditionId)), "Material record refers to an unknown grade or condition.");
  }
}
/** RFC-style quoted fields, CRLF and escaped quotes; never evaluate cells as formulas. */
export function parseCsv(raw: string): string[][] {
  if (raw.length > 2_000_000) throw new Error("CSV exceeds the 2 MB limit.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  raw = raw.replace(/^\uFEFF/, "");
  for (let i=0;i<raw.length;i++) {
    const c=raw[i]!;
    if (quoted) { if(c==='"') { if(raw[i+1]==='"') {cell+='"';i++;} else {quoted=false;closed=true;} } else cell+=c; continue; }
    if(c==='"') { if(cell || closed) throw new Error("Malformed CSV quote."); quoted=true; }
    else if(c===',' || c==='\n' || c==='\r') { row.push(cell);cell="";closed=false;if(c!==',') {if(c==='\r'&&raw[i+1]==='\n')i++;if(row.some((s)=>s.trim()))rows.push(row);row=[];} }
    else { if(closed) throw new Error("Unexpected text after a quoted CSV field.");cell+=c; }
  }
  if(quoted)throw new Error("Unclosed CSV quote.");row.push(cell);if(row.some((s)=>s.trim()))rows.push(row);
  return rows;
}
const HEADERS = ["heat_id","uns","condition_id","form","thickness_mm","source","kind","name","value","unit","test_temp_c"];
export const MATERIAL_CSV_TEMPLATE = HEADERS.join(",") + "\n";
export function materialRecordsFromCsv(raw: string): MaterialRecord[] {
  const rows=parseCsv(raw), header=rows.shift()?.map((s)=>s.trim());
  if(!header || header.length!==HEADERS.length || new Set(header).size!==HEADERS.length || HEADERS.some((h)=>!header.includes(h))) throw new Error(`Expected CSV columns: ${HEADERS.join(", ")}`);
  const records=new Map<string,MaterialRecord>();
  const number=(value:string,label:string) => { if(!value.trim() || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error(`${label} must be a number; blank is not zero.`); return Number(value); };
  for(const [index,row] of rows.entries()) {
    if(row.length!==header.length)throw new Error(`CSV row ${index+2}: wrong number of fields.`);
    const v=Object.fromEntries(header.map((h,i)=>[h,row[i]!.trim()]));
    const thickness=v.thickness_mm ? number(v.thickness_mm,"Thickness") : null;
    const key=JSON.stringify([v.heat_id,v.uns,v.condition_id]);
    let r=records.get(key);
    if(!r) { r={id:crypto.randomUUID(),createdAt:new Date().toISOString(),heatId:v.heat_id!,uns:v.uns!,conditionId:v.condition_id!,form:v.form!,thicknessMm:thickness,source:v.source!,chemistry:{},tests:[]}; records.set(key,r); }
    if(r.form!==v.form || r.thicknessMm!==thickness || r.source!==v.source)throw new Error(`CSV row ${index+2}: inconsistent metadata for this heat and condition.`);
    const n=number(v.value!,`CSV row ${index+2} value`);
    if(v.kind==="chemistry") { if(!ELEMENTS.includes(v.name!))throw new Error("Unsupported chemistry element."); if(v.unit!=="wt%" || v.test_temp_c)throw new Error("Chemistry rows require wt% and a blank test temperature."); if(Object.hasOwn(r.chemistry,v.name!))throw new Error("Duplicate chemistry element."); r.chemistry[v.name as ElementSymbol]=n; }
    else if(v.kind==="test") r.tests.push({property:v.name as TestProperty,value:n,unit:v.unit!,testTempC:number(v.test_temp_c!,"Test temperature"),source:v.source!});
    else throw new Error("CSV kind must be chemistry or test.");
  }
  const result=[...records.values()]; if(!result.length)throw new Error("CSV contains no measurements.");validateMaterialRecords(result);return result;
}
/** A measured view never borrows chemistry or test values from its reference condition. */
export function measuredCandidate(base: Alloy, condition: Condition, record: MaterialRecord, tempC: number | null): { alloy: Alloy; condition: Condition } {
  if(record.uns!==base.uns || record.conditionId!==condition.id)throw new Error("Measured record does not match this condition.");
  const properties=record.tests.map((t)=>({...t,provenance:"measured" as const}));
  properties.sort((a,b)=>Number(b.testTempC===tempC)-Number(a.testTempC===tempC));
  const selected: Condition={id:condition.id,name:condition.name,form:record.form,properties,note:`Heat/lot ${record.heatId}; thickness ${record.thicknessMm ?? "unknown"} mm. Source: ${record.source}. User-supplied measurements; not independently verified.`};
  const alloy: Alloy={...base,names:[`${base.names[0]} · heat ${record.heatId}`],composition:Object.entries(record.chemistry).map(([element,value])=>({element:element as ElementSymbol,min:value!,max:value!})),conditions:[selected]};
  return {alloy,condition:selected};
}
