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

  E("s32205-annealed-plate", 200, HANDBOOK),
  E("k02600-asrolled-plate", 200, HANDBOOK),
  E("g43400-qt425", 205, HANDBOOK),
  E("a96061-t6-plate", 68.9, HANDBOOK),
  E("a97075-t651-plate", 71.7, HANDBOOK),
  E("r56400-annealed-sheet", 113.8, HANDBOOK),
  E("n06625-annealed-plate", 207.5, HANDBOOK),
  E("n07718-sta", 200, HANDBOOK),
]);

// Supra 316L/4404 reference physical properties, not guaranteed heat values.
// Table 7 reports metric values according to EN 10088-1. We consulted the
// manufacturer's table, not the underlying standard; expert review is pending.
const supraSource = "Outokumpu Supra range datasheet, Table 7, p. 8, Supra 316L/4404 (EN 1.4404 / UNS S31603)";
const supraCitation = {
  url: "https://www.outokumpu.com/-/media/files/products/supra/outokumpu-supra-range-datasheet.pdf?modified=20251117111951&revision=7a909396-d1f3-4d36-9c1c-99606be41fd2",
  locator: "Table 7, page 8; metric row Supra 316L/4404",
  accessedAt: "2026-09-07",
  reviewStatus: "pending" as const,
};
physicalProperties["s31603-annealed-plate"] = [
  { property: "elastic_modulus", value: 200, unit: "GPa" },
  { property: "thermal_conductivity", value: 15, unit: "W/(m·K)" },
  { property: "specific_heat", value: 500, unit: "J/(kg·K)" },
  { property: "thermal_expansion", value: 16, unit: "10⁻⁶/K",
    conditions: { note: "Mean coefficient over 20–100 °C; 20 °C is the reference temperature, not a point measurement." } },
  { property: "electrical_resistivity", value: 75, unit: "µΩ·cm",
    conditions: { note: "Converted from 0.75 Ω·mm²/m using 1 Ω·mm²/m = 100 µΩ·cm." } },
].map((p) => ({
  ...p, property: p.property as PropertyRecord["property"], testTempC: 20,
  provenance: "estimated", source: supraSource, citation: { ...supraCitation },
  note: "Published reference for Supra 316L/4404, mapped to the annealed 316L condition. Not a measurement of the selected heat or a design allowable; applicability and expert review remain pending.",
}));
