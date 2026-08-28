import type { Alloy } from "@alloyra/data";
import { pren, specRange, type PropertyMeta } from "@alloyra/core";

/**
 * Screening property vocabulary (B-203) — the numeric axes stages can
 * constrain. Every property states its provenance so the rationale report
 * can say exactly what kind of number was screened on.
 */
export interface ScreenProperty {
  id: string;
  label: string;
  unit?: string;
  /** Provenance sentence for the report's method section. */
  provenance: string;
  get: (a: Alloy) => number | undefined;
}

function specMin(a: Alloy, property: string): number | undefined {
  for (const c of a.conditions) {
    const p = c.properties.find(
      (p) => p.property === property && p.provenance === "spec-min",
    );
    if (p) return p.value;
  }
  return undefined;
}

function typicalDensity(a: Alloy): number | undefined {
  for (const c of a.conditions) {
    const p = c.properties.find((p) => p.property === "density");
    if (p) return p.value;
  }
  return undefined;
}

function prenMid(a: Alloy): number | undefined {
  if (a.family[1] !== "stainless") return undefined;
  const r = specRange(pren, a.composition);
  if (r.missing.length > 0) return undefined;
  return (r.lo + r.hi) / 2;
}

export const SCREEN_PROPERTIES: ScreenProperty[] = [
  {
    id: "yield",
    label: "σy min",
    unit: "MPa",
    provenance:
      "σy min is the specification minimum yield strength of the best-documented condition (spec-min).",
    get: (a) => specMin(a, "yield_strength"),
  },
  {
    id: "uts",
    label: "UTS min",
    unit: "MPa",
    provenance: "UTS min is the specification minimum tensile strength (spec-min).",
    get: (a) => specMin(a, "tensile_strength"),
  },
  {
    id: "elong",
    label: "Elongation min",
    unit: "%",
    provenance: "Elongation min is the specification minimum elongation (spec-min).",
    get: (a) => specMin(a, "elongation"),
  },
  {
    id: "density",
    label: "ρ",
    unit: "g/cm³",
    provenance: "ρ is literature-typical density (ESTIMATED), not a spec value.",
    get: typicalDensity,
  },
  {
    id: "pren",
    label: "PREN mid-spec",
    provenance:
      "PREN is the midpoint of the interval permitted by the spec's composition ranges (COMPUTED); defined for stainless grades only — other families are UNKNOWN, not zero.",
    get: prenMid,
  },
  {
    id: "specific",
    label: "σy/ρ",
    unit: "kJ/kg",
    provenance:
      "σy/ρ divides the spec-min yield strength by literature-typical density (COMPUTED).",
    get: (a) => {
      const y = specMin(a, "yield_strength");
      const d = typicalDensity(a);
      return y !== undefined && d !== undefined ? y / d : undefined;
    },
  },
];

export const SCREEN_PROPERTY_META: Record<string, PropertyMeta> = Object.fromEntries(
  SCREEN_PROPERTIES.map((p) => [p.id, { label: p.label, ...(p.unit ? { unit: p.unit } : {}) }]),
);

export function screenProperty(id: string): ScreenProperty | undefined {
  return SCREEN_PROPERTIES.find((p) => p.id === id);
}
