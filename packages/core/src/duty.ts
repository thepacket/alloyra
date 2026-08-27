/**
 * The engine-facing duty shape: the subset of a Duty Profile the failure
 * rules and ranking reason over. `null` means "not specified" — an
 * unspecified field never triggers a rule (the audit says what it could
 * not check rather than guessing).
 */
export type Medium = "atmospheric" | "immersion" | "soil" | "process-fluid";
export type LoadType = "static" | "cyclic" | "impact" | "sustained";
export type LmeContact = "none" | "zinc" | "copper";

export interface DutyInput {
  /** Max wetted/service temperature, °C. */
  tempMaxC: number | null;
  loadType: LoadType;
  designStressMPa: number | null;
  cycles: number | null;
  medium: Medium;
  chloridePpm: number | null;
  pH: number | null;
  h2sKpa: number | null;
  ammonia: boolean;
  crevices: boolean;
  welded: boolean;
  cathodicProtection: boolean;
  galvanicCouple: string;
  lmeContact: LmeContact;
}

/**
 * Sustained tensile stress is present when a design stress is stated, or
 * when the part is welded (residual stresses count for SCC — the seed
 * conversation's point exactly).
 */
export function tensileStressPresent(d: DutyInput): boolean {
  return (d.designStressMPa !== null && d.designStressMPa > 0) || d.welded;
}
