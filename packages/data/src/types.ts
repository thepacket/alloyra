import type { CompositionRange, Microstructure, Provenance } from "@alloyra/core";
import type { PropertyId } from "./properties.ts";

export type { PropertyId } from "./properties.ts";

/**
 * Test-condition metadata (B-301). A property without its test conditions
 * is a number "from we don't know where" — records for temperature-,
 * cycle-, or rate-dependent properties must say how they were measured.
 */
export interface TestConditions {
  tempC?: number;
  /** Stress ratio σmin/σmax for fatigue data. */
  rRatio?: number;
  cycles?: number;
  strainRatePerS?: number;
  /** e.g. "L-T", "transverse". */
  orientation?: string;
  /** Rupture life for creep data, hours. */
  hours?: number;
  note?: string;
}

export interface PropertyRecord {
  property: PropertyId;
  /** Headline scalar (for interval records: the representative value). */
  value: number;
  unit: string;
  /** Test temperature, °C. Room temperature = 23. */
  testTempC: number;
  /** Interval-valued records (B-301): the permitted/observed range. */
  interval?: { lo: number; hi: number };
  /** Test-condition metadata beyond temperature (B-301). */
  conditions?: TestConditions;
  provenance: Provenance;
  source: string;
  note?: string;
}

/** Curve x-axis quantities (B-301). */
export type CurveXQuantity = "temperature" | "cycles" | "strain" | "time_h" | "lmp";

/**
 * A curve-valued property record (B-301): y(property) vs x, with the same
 * per-record provenance discipline as scalars. Points are (x, y) pairs
 * sorted by x.
 */
export interface CurveRecord {
  id: string;
  property: PropertyId;
  x: { quantity: CurveXQuantity; unit: string; log?: boolean };
  /** y unit — must match the vocabulary's canonical unit for `property`. */
  unit: string;
  points: readonly (readonly [number, number])[];
  conditions?: TestConditions;
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
  /** Curve-valued records for this condition (B-301). */
  curves?: CurveRecord[];
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
