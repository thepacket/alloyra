import type { Composition } from "./composition.ts";
import type { SourceRef } from "./provenance.ts";

/**
 * The ModelProvider seam (blueprint § 9) — the single most important
 * interface in the codebase. v1 calculators are pure local functions; a
 * CALPHAD backend implements the equilibrium half of this contract over
 * HTTP without the UI knowing the difference.
 */
export interface SystemInfo {
  /** Database identifier, e.g. "alzn_mey". */
  id: string;
  /** Elements the database covers (uppercase symbols). */
  elements: string[];
  phases: string[];
}

export interface ProviderCapabilities {
  available: boolean;
  /** Human-readable reason when unavailable (service down, no databases). */
  reason?: string;
  systems: SystemInfo[];
}

export interface PhaseFraction {
  phase: string;
  /** Mole fraction of the phase, 0–1. */
  fraction: number;
}

export interface EquilibriumQuery {
  databaseId: string;
  /** Full composition in wt%, balance included. */
  compositionWt: Composition;
  tempC: number;
}

export interface EquilibriumResult {
  databaseId: string;
  databaseFile: string;
  tempC: number;
  phases: PhaseFraction[];
  /** Always computed — rendered with the straw chip like every model output. */
  provenance: "computed";
  source: SourceRef;
  note: string;
}

export interface ModelProvider {
  id: string;
  capabilities(): Promise<ProviderCapabilities>;
  equilibrium(query: EquilibriumQuery): Promise<EquilibriumResult>;
}
