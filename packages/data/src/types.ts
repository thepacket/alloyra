import type { CompositionRange, Provenance } from "@alloyra/core";

/** Property identifiers — extend deliberately, never ad hoc strings in seeds. */
export type PropertyId =
  | "yield_strength"      // 0.2 % offset unless noted
  | "tensile_strength"
  | "elongation"
  | "hardness_hrc"
  | "density";

export interface PropertyRecord {
  property: PropertyId;
  value: number;
  unit: string;
  /** Test temperature, °C. Room temperature = 23. */
  testTempC: number;
  provenance: Provenance;
  source: string;
  note?: string;
}

/** Properties attach to an alloy IN A CONDITION, never the bare alloy (R-2.3). */
export interface Condition {
  id: string;
  name: string;
  form: string;
  properties: PropertyRecord[];
  note?: string;
}

export interface Alloy {
  /** UNS number, the primary key (R-2.1). */
  uns: string;
  names: string[];
  /** Taxonomy path, root first: e.g. ["Fe", "stainless", "austenitic"]. */
  family: string[];
  standards: string[];
  composition: CompositionRange[];
  conditions: Condition[];
  /**
   * Approximate solidus, K (provenance: estimated — literature ballpark,
   * good enough only for the 0.4·T_solidus creep-regime flag).
   */
  solidusK?: number;
  notes?: string;
}
