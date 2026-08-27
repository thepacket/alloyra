/**
 * The engine-facing duty shape. Unknowns are FIRST-CLASS: `null` numerics
 * and "unknown" categorical values mean "not specified" — a rule that
 * needs them reports INDETERMINATE ("insufficient information"), never
 * "did not fire". Defaults must never assert knowledge the user didn't
 * enter (a blank profile is all-unknown, not "atmospheric/static/dry").
 */
export type Medium = "atmospheric" | "immersion" | "soil" | "process-fluid";
export type LoadType = "static" | "cyclic" | "impact" | "sustained";
export type LmeContact = "none" | "zinc" | "copper";
export type TriState = "yes" | "no" | "unknown";

export interface DutyInput {
  /** Max wetted/service temperature, °C. */
  tempMaxC: number | null;
  loadType: LoadType | "unknown";
  designStressMPa: number | null;
  cycles: number | null;
  medium: Medium | "unknown";
  chloridePpm: number | null;
  pH: number | null;
  h2sKpa: number | null;
  ammonia: TriState;
  crevices: TriState;
  welded: TriState;
  cathodicProtection: TriState;
  galvanicCouple: string;
  lmeContact: LmeContact | "unknown";
}

/**
 * Sustained tensile stress: present when a positive design stress is
 * stated or the part is welded (residual stress counts). Unknown when
 * neither the stress nor the weld state is known.
 */
export function tensileStressPresent(d: DutyInput): TriState {
  if ((d.designStressMPa !== null && d.designStressMPa > 0) || d.welded === "yes") {
    return "yes";
  }
  if (d.designStressMPa === null || d.welded === "unknown") return "unknown";
  return "no";
}
