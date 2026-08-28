/**
 * Microstructure descriptor model (backlog E1, design-v2 § 2.2).
 *
 * Descriptors are qualitative, literature-typical facts about an alloy IN A
 * CONDITION — the searchable vocabulary an expert reaches for ("serrated
 * grain boundaries", "precipitation hardening", "annealing twins"). They are
 * descriptive before predictive: quantitative models (Hall-Petch, KWN…)
 * attach to these fields later (B-105/B-506) instead of a parallel schema.
 *
 * Honesty rule carried over from composition handling: an absent field means
 * UNDOCUMENTED, never "none". Only explicit values are searchable.
 */

/** Operative strengthening mechanisms — the expert's hunting vocabulary. */
export type MechanismId =
  | "solid-solution"
  | "strain-hardening"
  | "precipitation"
  | "grain-refinement"
  | "transformation"
  | "dispersion"
  | "order";

export type MechanismRole = "dominant" | "active";

export interface MechanismTag {
  mechanism: MechanismId;
  role: MechanismRole;
  /** Mechanism-specific nuance, e.g. "β″ needles, shearing regime". */
  note?: string;
}

/**
 * Grain-boundary serration. "none-documented" must NOT match a search for
 * serration — it is the honest default, not a feature.
 */
export type SerrationClass =
  | "none-documented"
  | "possible-by-heat-treatment"
  | "characteristic";

export type TwinDensity = "abundant" | "present" | "rare" | "absent";

export type ConstituentRole =
  | "hardening"
  | "embrittling"
  | "inert"
  | "grain-refining";

export interface Constituent {
  /** Phase name incl. structure where useful, e.g. "η′ (MgZn2 precursor)". */
  phase: string;
  role: ConstituentRole;
  note?: string;
}

export interface Microstructure {
  /** Matrix phase(s) + crystal structure, e.g. "austenite (FCC), metastable". */
  matrix: string;
  constituents?: Constituent[];
  grainBoundaries?: { serration: SerrationClass; note?: string };
  twinning?: {
    annealingTwins: TwinDensity;
    /** Deformation-twinning behavior, e.g. "{10-12} tensile twins active". */
    deformationNote?: string;
  };
  strengthening: MechanismTag[];
  /** Anisotropy / texture class where documented, e.g. rolled-plate ST weakness. */
  texture?: string;
  /** Extra searchable keywords beyond the structured fields. */
  features?: string[];
  /** Citation(s) for the whole block — literature-typical, verify before design use. */
  source: string;
}

export const MECHANISMS: Record<
  MechanismId,
  { label: string; synonyms: string[] }
> = {
  "solid-solution": {
    label: "Solid solution",
    synonyms: [
      "solid solution strengthening",
      "substitutional strengthening",
      "interstitial strengthening",
    ],
  },
  "strain-hardening": {
    label: "Strain hardening",
    synonyms: [
      "work hardening",
      "cold work",
      "cold working",
      "dislocation strengthening",
      "hollomon",
      "n-value",
    ],
  },
  precipitation: {
    label: "Precipitation",
    synonyms: [
      "precipitation hardening",
      "age hardening",
      "aging",
      "ageing",
      "gp zones",
      "orowan",
      "particle shearing",
    ],
  },
  "grain-refinement": {
    label: "Grain refinement",
    synonyms: [
      "hall-petch",
      "grain size strengthening",
      "grain boundary strengthening",
      "fine grain",
    ],
  },
  transformation: {
    label: "Transformation",
    synonyms: ["martensite", "martensitic strengthening", "quench and temper", "trip"],
  },
  dispersion: {
    label: "Dispersion",
    synonyms: ["dispersion strengthening", "carbide dispersion", "oxide dispersion"],
  },
  order: {
    label: "Order",
    synonyms: ["order strengthening", "ordered precipitate", "antiphase boundary", "apb"],
  },
};

/**
 * Flatten a descriptor block into a lower-case haystack for token search.
 * Serration contributes "serrated grain boundar…" words ONLY when it is
 * documented as possible or characteristic; twinning contributes annealing-
 * twin words only when twins are present or abundant.
 */
export function microstructureHaystack(m: Microstructure): string {
  const parts: string[] = [m.matrix];
  for (const c of m.constituents ?? []) {
    parts.push(c.phase, c.role, c.note ?? "");
  }
  if (m.grainBoundaries) {
    if (m.grainBoundaries.serration !== "none-documented") {
      parts.push(
        "serrated grain boundaries",
        "grain boundary serration",
        "wavy grain boundaries",
        m.grainBoundaries.serration,
      );
    }
    parts.push(m.grainBoundaries.note ?? "");
  }
  if (m.twinning) {
    if (
      m.twinning.annealingTwins === "abundant" ||
      m.twinning.annealingTwins === "present"
    ) {
      parts.push(
        "annealing twins",
        "grain boundary twinning",
        "twin boundaries",
        "sigma3",
        `annealing twins ${m.twinning.annealingTwins}`,
      );
    }
    if (m.twinning.deformationNote) {
      parts.push("deformation twinning", m.twinning.deformationNote);
    }
  }
  for (const t of m.strengthening) {
    const meta = MECHANISMS[t.mechanism];
    parts.push(meta.label, ...meta.synonyms, t.note ?? "", t.role);
  }
  parts.push(m.texture ?? "", ...(m.features ?? []));
  return parts.join(" · ").toLowerCase();
}

/** Token-AND match against a haystack. Empty query matches nothing. */
export function matchesMicroQuery(haystack: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

/** True when the block tags the mechanism (any role). */
export function hasMechanism(m: Microstructure, id: MechanismId): boolean {
  return m.strengthening.some((t) => t.mechanism === id);
}
