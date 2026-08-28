import type { PropertyRecord } from "../types.ts";

/**
 * Room-temperature elastic moduli (B-301), keyed by condition id. All
 * literature-typical handbook values — provenance ESTIMATED, never
 * guaranteed; verify against certs. Only grades whose commonly published
 * value the maintainers are confident of are listed (ground rule 4).
 */

const E = (conditionId: string, value: number, source: string): [string, PropertyRecord[]] => [
  conditionId,
  [
    {
      property: "elastic_modulus",
      value,
      unit: "GPa",
      testTempC: 23,
      provenance: "estimated",
      source,
    },
  ],
];

const HANDBOOK = "Literature-typical handbook value (room temperature); not a specification requirement";

export const physicalProperties: Record<string, PropertyRecord[]> = Object.fromEntries([
  E("s30400-annealed-plate", 193, HANDBOOK),
  E("s31603-annealed-plate", 193, HANDBOOK),
  E("s32205-annealed-plate", 200, HANDBOOK),
  E("k02600-asrolled-plate", 200, HANDBOOK),
  E("g43400-qt425", 205, HANDBOOK),
  E("a96061-t6-plate", 68.9, HANDBOOK),
  E("a97075-t651-plate", 71.7, HANDBOOK),
  E("r56400-annealed-sheet", 113.8, HANDBOOK),
  E("n06625-annealed-plate", 207.5, HANDBOOK),
  E("n07718-sta", 200, HANDBOOK),
]);
