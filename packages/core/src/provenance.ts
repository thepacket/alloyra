/**
 * Provenance is load-bearing in Alloyra (blueprint N-1, R-2.4): a computed
 * number must never be mistakable for a measured one, anywhere in the UI.
 */
export type Provenance =
  /** Certified test data for a specific heat/lot. */
  | "measured"
  /** Minimum guaranteed by the governing specification (e.g. ASTM A240). */
  | "spec-min"
  /** Derived by an Alloyra calculator from composition/condition inputs. */
  | "computed"
  /** Typical published value; not guaranteed — verify against certs. */
  | "estimated";

export interface SourceRef {
  /** Short citation, e.g. "ASTM A240/A240M-23" or "Andrews (1965), JISI 203". */
  citation: string;
  note?: string;
}
