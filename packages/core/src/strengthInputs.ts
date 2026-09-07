/** Input provenance is distinct from the provenance of a computed result. */
export type InputOrigin = "user-entered" | "sourced" | "assumed" | "unverified";
export type StrengthKey = "grainAstm" | "sigma0" | "ky" | "K" | "n" | "fPct" | "dNm" | "G" | "b";
export interface StrengthInputs {
  grainAstm: number | null;
  hp: { sigma0: number | null; ky: number | null };
  holl: { K: number | null; n: number | null };
  orowan: { fPct: number | null; dNm: number | null; matrix: string; G: number | null; b: number | null };
  origins: Partial<Record<StrengthKey, InputOrigin>>;
}
export function blankStrengthInputs(): StrengthInputs {
  return {
    grainAstm: null, hp: { sigma0: null, ky: null }, holl: { K: null, n: null },
    orowan: { fPct: null, dNm: null, matrix: "", G: null, b: null }, origins: {},
  };
}
export function restoreStrengthInputs(saved?: Partial<StrengthInputs>): StrengthInputs {
  const blank = blankStrengthInputs();
  // Older values remain available for review but never acquire user provenance.
  return {
    ...blank, ...saved,
    hp: { ...blank.hp, ...saved?.hp }, holl: { ...blank.holl, ...saved?.holl },
    orowan: { ...blank.orowan, ...saved?.orowan }, origins: { ...saved?.origins },
  };
}
export function strengthValue(s: StrengthInputs, key: StrengthKey): number | null {
  if (key === "grainAstm") return s.grainAstm;
  if (key === "sigma0" || key === "ky") return s.hp[key];
  if (key === "K" || key === "n") return s.holl[key];
  return s.orowan[key];
}
export function strengthInputsReady(s: StrengthInputs, keys: readonly StrengthKey[]): boolean {
  return keys.every((key) => strengthValue(s, key) !== null && Number.isFinite(strengthValue(s, key))
    && (s.origins[key] === "user-entered" || s.origins[key] === "sourced"));
}
export function setStrengthValue(s: StrengthInputs, key: StrengthKey, value: number | null): StrengthInputs {
  const next = { ...s, origins: { ...s.origins, [key]: "user-entered" as const } };
  if (key === "grainAstm") return { ...next, grainAstm: value };
  if (key === "sigma0" || key === "ky") return { ...next, hp: { ...s.hp, [key]: value } };
  if (key === "K" || key === "n") return { ...next, holl: { ...s.holl, [key]: value } };
  return { ...next, orowan: { ...s.orowan, [key]: value } };
}
