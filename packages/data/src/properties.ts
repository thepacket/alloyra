/**
 * Property vocabulary (B-301) — the extensible, unit-typed catalog every
 * seed record must draw from. Extend DELIBERATELY by adding entries here;
 * the dataset validation test rejects ad-hoc property ids and off-catalog
 * units in seeds. `PropertyId` is derived from these keys, so the compiler
 * enforces the vocabulary everywhere.
 */

export type PropertyCategory =
  | "mechanical"
  | "elastic"
  | "toughness"
  | "fatigue"
  | "physical"
  | "thermal"
  | "electrical";

export interface PropertyDef {
  label: string;
  /** Canonical unit — seed records must use exactly this. */
  unit: string;
  category: PropertyCategory;
  note?: string;
}

export const PROPERTY_VOCABULARY = {
  yield_strength: { label: "yield strength", unit: "MPa", category: "mechanical", note: "0.2 % offset unless noted" },
  tensile_strength: { label: "tensile strength", unit: "MPa", category: "mechanical" },
  elongation: { label: "elongation", unit: "%", category: "mechanical" },
  hardness_hrc: { label: "hardness", unit: "HRC", category: "mechanical" },
  hardness_hb: { label: "hardness", unit: "HB", category: "mechanical" },
  creep_rupture_strength: { label: "creep rupture strength", unit: "MPa", category: "mechanical", note: "conditions carry temperature and life" },
  elastic_modulus: { label: "Young's modulus", unit: "GPa", category: "elastic" },
  shear_modulus: { label: "shear modulus", unit: "GPa", category: "elastic" },
  poisson_ratio: { label: "Poisson's ratio", unit: "–", category: "elastic" },
  impact_energy: { label: "impact energy (CVN)", unit: "J", category: "toughness", note: "conditions carry test temperature" },
  fracture_toughness: { label: "fracture toughness", unit: "MPa·√m", category: "toughness" },
  fatigue_strength: { label: "fatigue strength", unit: "MPa", category: "fatigue", note: "conditions carry cycles and R-ratio" },
  density: { label: "density", unit: "g/cm³", category: "physical" },
  thermal_conductivity: { label: "thermal conductivity", unit: "W/(m·K)", category: "thermal" },
  specific_heat: { label: "specific heat", unit: "J/(kg·K)", category: "thermal" },
  thermal_expansion: { label: "mean CTE", unit: "10⁻⁶/K", category: "thermal" },
  thermal_contraction: { label: "relative length change", unit: "10⁻⁵·ΔL/L₂₉₃", category: "thermal", note: "cryogenic contraction relative to 293 K" },
  electrical_resistivity: { label: "electrical resistivity", unit: "µΩ·cm", category: "electrical" },
} as const satisfies Record<string, PropertyDef>;

export type PropertyId = keyof typeof PROPERTY_VOCABULARY;

export function propertyDef(id: PropertyId): PropertyDef {
  return PROPERTY_VOCABULARY[id];
}
