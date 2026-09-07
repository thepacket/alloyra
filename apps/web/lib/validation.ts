import catalog from "./validationCases.json";
import manifest from "./engineManifest.json";
import baseline from "./validationBaseline.json";
export function validationCoverage(composition: Record<string, number>, dbId: string, tempC: number, kind = "point"): string {
  if (kind !== "point") return "The documented 52-point equilibrium comparison does not validate this calculation mode, its trajectory or its grid boundaries.";
  if (manifest.codeSha256 !== baseline.codeSha256 || manifest.dbHashes[dbId as keyof typeof manifest.dbHashes] !== baseline.dbHashes[dbId as keyof typeof baseline.dbHashes]) return "Engine or database fingerprint differs from the implementation associated with the archived report. No current case coverage inferred.";
  const normalized = (c: Record<string, number>) => { const sum = Object.values(c).reduce((a,b) => a+b,0); return Object.fromEntries(Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>[k.toUpperCase(),v/sum])); };
  const actual = normalized(composition);
  const c = catalog.cases.find((c) => { if (c.db !== dbId) return false; const expected = normalized(c.wt as Record<string, number>); const keys = new Set([...Object.keys(actual),...Object.keys(expected)]); return [...keys].every((k) => Math.abs((actual[k] ?? 0) - (expected[k] ?? 0)) < 1e-8); });
  if (!c) return "This composition is outside the documented case set for this database. Nearby alloys do not establish validation coverage.";
  const result = catalog.results.find((r) => r.name === c.name && r.tempC === tempC);
  if (!result) return `${c.name} is documented at ${c.tempsC.join(", ")} °C; ${tempC} °C is outside those test points. No interpolation of coverage.`;
  return `Documented case: ${c.name} at ${tempC} °C (${catalog.reportDate}). ${result.setsAgree ? "Phase sets agree" : "Phase sets disagree — review the repricing discussion"}; maximum fraction deviation ${result.maxFractionDeviation}, |ΔG| ${result.energyDifference} J/mol-atom. This is archived comparison evidence, not a new validation run.`;
}
