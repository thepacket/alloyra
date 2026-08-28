import type { CompositionRange, Microstructure, Provenance } from "@alloyra/core";

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
  /**
   * Literature-typical microstructural descriptors for this condition
   * (backlog E1). Absent field = undocumented, never "none"; the block
   * carries its own citation and is searchable from the database view.
   */
  microstructure?: Microstructure;
  note?: string;
}

/**
 * A cross-standard designation (B-302). Equivalence is NOMINAL: each
 * standard sets its own composition and property limits, so a designation
 * here names the counterpart grade, not an identical specification.
 */
export interface Designation {
  /** Designation system: "EN number", "EN name", "JIS", "AISI/SAE",
   *  "W.-Nr.", "EN AW", "ISO", "ASTM", "CEN CW"… */
  system: string;
  code: string;
  /** Deviations worth knowing (e.g. "nearest by strength class — chemistry differs"). */
  note?: string;
  /** Citation for the cross-reference. */
  source: string;
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
  /** Cross-standard designations (B-302). Absent = none on file yet —
   *  a dataset gap, never evidence that no counterpart exists. */
  designations?: Designation[];
  notes?: string;
}
