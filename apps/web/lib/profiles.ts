import type { DutyInput, LmeContact, LoadType, Medium } from "@alloyra/core";

/**
 * Duty Profile shape (R-1.x). M0/M1 persistence is localStorage; mirrors
 * the duty_profiles table payload so the Postgres move is a transport
 * change, not a remodel.
 */
export interface DutyProfile {
  id: string;
  name: string;
  version: number;
  savedAt: string;
  thermal: { minC: number | null; nomC: number | null; maxC: number | null };
  mechanical: {
    loadType: LoadType;
    designStressMPa: number | null;
    rRatio: number | null;
    cycles: number | null;
  };
  chemistry: {
    medium: Medium;
    chloridePpm: number | null;
    pH: number | null;
    h2sKpa: number | null;
    ammonia: boolean;
  };
  context: {
    galvanicCouple: string;
    crevices: boolean;
    welded: boolean;
    cathodicProtection: boolean;
    lmeContact: LmeContact;
  };
  constraints: { maxCostPerKg: number | null; route: "wrought" | "cast" | "am" };
}

export const PROFILE_STORE = "alloyra.dutyProfiles.v1";

export function blankProfile(): DutyProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    version: 1,
    savedAt: "",
    thermal: { minC: null, nomC: null, maxC: null },
    mechanical: { loadType: "static", designStressMPa: null, rRatio: null, cycles: null },
    chemistry: { medium: "atmospheric", chloridePpm: null, pH: null, h2sKpa: null, ammonia: false },
    context: { galvanicCouple: "", crevices: false, welded: false, cathodicProtection: false, lmeContact: "none" },
    constraints: { maxCostPerKg: null, route: "wrought" },
  };
}

/** Load with forward-compatible defaults for fields added after v1 saves. */
export function loadProfiles(): DutyProfile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_STORE) ?? "[]") as DutyProfile[];
    return raw.map((p) => ({
      ...p,
      chemistry: { ...p.chemistry, ammonia: p.chemistry.ammonia ?? false },
      context: { ...p.context, lmeContact: p.context.lmeContact ?? "none" },
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
