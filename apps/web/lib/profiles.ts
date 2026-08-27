import type { DutyInput, LmeContact, LoadType, Medium, TriState } from "@alloyra/core";

/**
 * Duty Profile shape (R-1.x). Unknowns are first-class: a new profile
 * asserts NOTHING — medium, load, and every exposure flag start
 * "unknown", because silent defaults ("atmospheric", "not welded")
 * suppress failure rules and manufacture false negatives.
 */
export interface DutyProfile {
  id: string;
  name: string;
  version: number;
  savedAt: string;
  thermal: { minC: number | null; nomC: number | null; maxC: number | null };
  mechanical: {
    loadType: LoadType | "unknown";
    designStressMPa: number | null;
    rRatio: number | null;
    cycles: number | null;
  };
  chemistry: {
    medium: Medium | "unknown";
    chloridePpm: number | null;
    pH: number | null;
    h2sKpa: number | null;
    ammonia: TriState;
  };
  context: {
    galvanicCouple: string;
    crevices: TriState;
    welded: TriState;
    cathodicProtection: TriState;
    lmeContact: LmeContact | "unknown";
  };
  constraints: { maxCostPerKg: number | null; route: "wrought" | "cast" | "am" | "unknown" };
}

export const PROFILE_STORE = "alloyra.dutyProfiles.v1";

export function blankProfile(): DutyProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    version: 1,
    savedAt: "",
    thermal: { minC: null, nomC: null, maxC: null },
    mechanical: { loadType: "unknown", designStressMPa: null, rRatio: null, cycles: null },
    chemistry: { medium: "unknown", chloridePpm: null, pH: null, h2sKpa: null, ammonia: "unknown" },
    context: {
      galvanicCouple: "",
      crevices: "unknown",
      welded: "unknown",
      cathodicProtection: "unknown",
      lmeContact: "unknown",
    },
    constraints: { maxCostPerKg: null, route: "unknown" },
  };
}

/** Legacy boolean → tri-state. `false` was a default assertion the user
 * never made, so it conservatively migrates to "unknown". */
function tri(v: unknown): TriState {
  if (v === true || v === "yes") return "yes";
  if (v === "no") return "no";
  return "unknown";
}

/** Load with forward-compatible migration for older saved shapes. */
export function loadProfiles(): DutyProfile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_STORE) ?? "[]") as DutyProfile[];
    return raw.map((p) => ({
      ...p,
      mechanical: { ...p.mechanical, loadType: p.mechanical.loadType ?? "unknown" },
      chemistry: {
        ...p.chemistry,
        medium: p.chemistry.medium ?? "unknown",
        ammonia: tri(p.chemistry.ammonia),
      },
      context: {
        ...p.context,
        crevices: tri(p.context.crevices),
        welded: tri(p.context.welded),
        cathodicProtection: tri(p.context.cathodicProtection),
        lmeContact: (p.context.lmeContact as DutyProfile["context"]["lmeContact"]) ?? "unknown",
      },
      constraints: { ...p.constraints, route: p.constraints.route ?? "unknown" },
    }));
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: DutyProfile[]): void {
  try {
    localStorage.setItem(PROFILE_STORE, JSON.stringify(profiles));
  } catch {
    /* storage unavailable — session-only */
  }
}

/**
 * Engineering-constraint validation. Errors block Save; the numbers are
 * physical or ordering constraints, not style preferences.
 */
export function validateProfile(p: DutyProfile): string[] {
  const errs: string[] = [];
  const { minC, nomC, maxC } = p.thermal;
  if (minC !== null && nomC !== null && minC > nomC) errs.push("Thermal: Tmin exceeds Tnom.");
  if (nomC !== null && maxC !== null && nomC > maxC) errs.push("Thermal: Tnom exceeds Tmax.");
  if (minC !== null && maxC !== null && minC > maxC) errs.push("Thermal: Tmin exceeds Tmax.");
  const nonneg: [string, number | null][] = [
    ["Chloride", p.chemistry.chloridePpm],
    ["H₂S partial pressure", p.chemistry.h2sKpa],
    ["Design stress", p.mechanical.designStressMPa],
    ["Target cycles", p.mechanical.cycles],
    ["Max cost", p.constraints.maxCostPerKg],
  ];
  for (const [label, v] of nonneg) {
    if (v !== null && v < 0) errs.push(`${label} cannot be negative.`);
  }
  if (p.chemistry.pH !== null && (p.chemistry.pH < 0 || p.chemistry.pH > 14)) {
    errs.push("pH outside 0–14 — if the medium is genuinely super-acidic/basic, note it in the profile name.");
  }
  if (p.mechanical.rRatio !== null && (p.mechanical.rRatio < -5 || p.mechanical.rRatio > 5)) {
    errs.push("R-ratio outside ±5 — check the sign convention (R = σmin/σmax).");
  }
  return errs;
}

/** Bridge a stored profile to the engine's duty shape. */
export function dutyFromProfile(p: DutyProfile): DutyInput {
  return {
    tempMaxC: p.thermal.maxC ?? p.thermal.nomC,
    loadType: p.mechanical.loadType,
    designStressMPa: p.mechanical.designStressMPa,
    cycles: p.mechanical.cycles,
    medium: p.chemistry.medium,
    chloridePpm: p.chemistry.chloridePpm,
    pH: p.chemistry.pH,
    h2sKpa: p.chemistry.h2sKpa,
    ammonia: p.chemistry.ammonia,
    crevices: p.context.crevices,
    welded: p.context.welded,
    cathodicProtection: p.context.cathodicProtection,
    galvanicCouple: p.context.galvanicCouple,
    lmeContact: p.context.lmeContact,
  };
}
