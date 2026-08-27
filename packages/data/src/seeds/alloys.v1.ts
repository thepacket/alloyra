import type { Alloy } from "../types.ts";

/**
 * Seed dataset — version 2026.08.0 (see DATASET_VERSION in index.ts).
 *
 * Licensing rule (blueprint N-5): only values that standards publish as
 * guaranteed minimums, or clearly-flagged typical values, appear here.
 * Nothing is copied from licensed databases (MMPDS, ASM tables).
 * Every value cites its source; ESTIMATED values must be verified against
 * certified data before use in design.
 */
export const alloys: Alloy[] = [
  {
    uns: "S30400",
    names: ["304", "1.4301", "18-8"],
    family: ["Fe", "stainless", "austenitic"],
    standards: ["ASTM A240/A240M", "EN 10088-2"],
    composition: [
      { element: "C", max: 0.07 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 0.75 },
      { element: "Cr", min: 17.5, max: 19.5 },
      { element: "Ni", min: 8.0, max: 10.5 },
      { element: "N", max: 0.1 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s30400-annealed-plate",
        name: "Annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 205, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 515, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 40, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
        ],
      },
    ],
    solidusK: 1673, // estimated solidus ballpark
    notes: "Workhorse austenitic. Susceptible to chloride SCC above ~60 °C and to sensitization in the weld HAZ (prefer 304L when welding).",
  },
  {
    uns: "S30403",
    names: ["304L", "1.4307"],
    family: ["Fe", "stainless", "austenitic"],
    standards: ["ASTM A240/A240M", "EN 10088-2"],
    composition: [
      { element: "C", max: 0.03 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 0.75 },
      { element: "Cr", min: 17.5, max: 19.5 },
      { element: "Ni", min: 8.0, max: 12.0 },
      { element: "N", max: 0.1 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s30403-annealed-plate",
        name: "Annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 170, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 485, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 40, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
        ],
      },
    ],
    solidusK: 1673, // estimated solidus ballpark
    notes: "Low-carbon 304 for as-welded service; resists sensitization at the cost of lower strength minimums.",
  },
  {
    uns: "S31603",
    names: ["316L", "1.4404"],
    family: ["Fe", "stainless", "austenitic"],
    standards: ["ASTM A240/A240M", "EN 10088-2"],
    composition: [
      { element: "C", max: 0.03 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 0.75 },
      { element: "Cr", min: 16.0, max: 18.0 },
      { element: "Ni", min: 10.0, max: 14.0 },
      { element: "Mo", min: 2.0, max: 3.0 },
      { element: "N", max: 0.1 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s31603-annealed-plate",
        name: "Annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 170, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 485, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 40, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
        ],
      },
    ],
    solidusK: 1673, // estimated solidus ballpark
    notes: "Mo addition improves pitting/crevice resistance over 304L. Still chloride-SCC susceptible above ~60 °C.",
  },
  {
    uns: "S31703",
    names: ["317L", "1.4438"],
    family: ["Fe", "stainless", "austenitic"],
    standards: ["ASTM A240/A240M"],
    composition: [
      { element: "C", max: 0.03 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 0.75 },
      { element: "Cr", min: 18.0, max: 20.0 },
      { element: "Ni", min: 11.0, max: 15.0 },
      { element: "Mo", min: 3.0, max: 4.0 },
      { element: "N", max: 0.1 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s31703-annealed-plate",
        name: "Annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 205, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 515, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 35, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
        ],
      },
    ],
    solidusK: 1673, // estimated solidus ballpark
    notes: "Higher-Mo austenitic for aggressive chloride/process environments short of duplex or 6-Mo grades.",
  },
  {
    uns: "S32205",
    names: ["2205", "1.4462"],
    family: ["Fe", "stainless", "duplex"],
    standards: ["ASTM A240/A240M", "EN 10088-2"],
    composition: [
      { element: "C", max: 0.03 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 1.0 },
      { element: "Cr", min: 22.0, max: 23.0 },
      { element: "Ni", min: 4.5, max: 6.5 },
      { element: "Mo", min: 3.0, max: 3.5 },
      { element: "N", min: 0.14, max: 0.2 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s32205-annealed-plate",
        name: "Solution annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 450, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 655, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 25, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
        ],
      },
    ],
    solidusK: 1658, // estimated solidus ballpark
    notes: "Duplex: ~2× austenitic yield strength and far better chloride-SCC resistance. Watch 475 °C embrittlement and sigma-phase windows in service/fabrication.",
  },
  {
    uns: "K02600",
    names: ["A36"],
    family: ["Fe", "carbon-steel", "structural"],
    standards: ["ASTM A36/A36M"],
    composition: [
      { element: "C", max: 0.26 },
      { element: "Si", max: 0.4 },
      { element: "P", max: 0.04 },
      { element: "S", max: 0.05 },
      { element: "Cu", min: 0.2, note: "when copper steel is specified" },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "k02600-asrolled-plate",
        name: "As-rolled",
        form: "plate/shapes (A36)",
        properties: [
          { property: "yield_strength", value: 250, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A36/A36M" },
          { property: "tensile_strength", value: 400, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A36/A36M", note: "spec range 400–550 MPa" },
          { property: "elongation", value: 20, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A36/A36M", note: "in 200 mm" },
        ],
      },
    ],
    solidusK: 1793, // estimated solidus ballpark
    notes: "Baseline structural steel; corrodes freely — coat, galvanize, or accept the corrosion allowance.",
  },
  {
    uns: "G43400",
    names: ["4340", "AISI 4340"],
    family: ["Fe", "low-alloy-steel", "Ni-Cr-Mo"],
    standards: ["ASTM A29/A29M", "AMS 6414 (aircraft quality)"],
    composition: [
      { element: "C", min: 0.38, max: 0.43 },
      { element: "Mn", min: 0.6, max: 0.8 },
      { element: "Si", min: 0.15, max: 0.35 },
      { element: "Ni", min: 1.65, max: 2.0 },
      { element: "Cr", min: 0.7, max: 0.9 },
      { element: "Mo", min: 0.2, max: 0.3 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "g43400-qt425",
        name: "Oil quenched + tempered 425 °C",
        form: "bar",
        properties: [
          { property: "yield_strength", value: 1420, unit: "MPa", testTempC: 23, provenance: "estimated", source: "Widely published typical data", note: "Typical, not guaranteed — properties depend on section size and exact temper. Verify against certs." },
          { property: "tensile_strength", value: 1560, unit: "MPa", testTempC: 23, provenance: "estimated", source: "Widely published typical data", note: "Typical, not guaranteed." },
        ],
      },
    ],
    solidusK: 1700, // estimated solidus ballpark
    notes: "Deep-hardening high-strength steel. Above ~38 HRC it is hydrogen-embrittlement and sulfide-SCC susceptible — hardness caps per ISO 15156 govern sour service; bake after plating.",
  },
  {
    uns: "A96061",
    names: ["6061"],
    family: ["Al", "wrought", "6xxx (Al-Mg-Si)"],
    standards: ["ASTM B209 (sheet/plate)", "ASTM B221 (extrusions)"],
    composition: [
      { element: "Si", min: 0.4, max: 0.8 },
      { element: "Fe", max: 0.7 },
      { element: "Cu", min: 0.15, max: 0.4 },
      { element: "Mn", max: 0.15 },
      { element: "Mg", min: 0.8, max: 1.2 },
      { element: "Cr", min: 0.04, max: 0.35 },
      { element: "Zn", max: 0.25 },
      { element: "Ti", max: 0.15 },
      { element: "Al", balance: true },
    ],
    conditions: [
      {
        id: "a96061-t6-plate",
        name: "T6 / T651",
        form: "plate (B209)",
        properties: [
          { property: "yield_strength", value: 240, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent; check the governing table" },
          { property: "tensile_strength", value: 290, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209" },
        ],
      },
    ],
    solidusK: 855, // estimated solidus ballpark
    notes: "General-purpose heat-treatable aluminum; weldable (with HAZ knockdown), good corrosion resistance, SCC-resistant.",
  },
  {
    uns: "A97075",
    names: ["7075"],
    family: ["Al", "wrought", "7xxx (Al-Zn-Mg-Cu)"],
    standards: ["ASTM B209 (sheet/plate)", "AMS 4045"],
    composition: [
      { element: "Si", max: 0.4 },
      { element: "Fe", max: 0.5 },
      { element: "Cu", min: 1.2, max: 2.0 },
      { element: "Mn", max: 0.3 },
      { element: "Mg", min: 2.1, max: 2.9 },
      { element: "Cr", min: 0.18, max: 0.28 },
      { element: "Zn", min: 5.1, max: 6.1 },
      { element: "Ti", max: 0.2 },
      { element: "Al", balance: true },
    ],
    conditions: [
      {
        id: "a97075-t651-plate",
        name: "T651 (peak aged)",
        form: "plate (B209)",
        properties: [
          { property: "yield_strength", value: 462, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent; check the governing table" },
          { property: "tensile_strength", value: 538, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209" },
        ],
      },
      {
        id: "a97075-t7351-plate",
        name: "T7351 (overaged)",
        form: "plate (B209)",
        properties: [
          { property: "yield_strength", value: 386, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent" },
          { property: "tensile_strength", value: 469, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209" },
        ],
        note: "Overaging trades ~15 % strength for greatly improved short-transverse SCC and exfoliation resistance.",
      },
    ],
    solidusK: 750, // estimated solidus ballpark
    notes: "Highest-strength common aluminum. Peak-aged T6 is SCC-susceptible in the short-transverse direction under sustained stress in humid/chloride service — the T6 vs T73 choice IS the SCC decision.",
  },
  {
    uns: "R50400",
    names: ["CP Titanium Grade 2"],
    family: ["Ti", "commercially-pure"],
    standards: ["ASTM B265"],
    composition: [
      { element: "O", max: 0.25 },
      { element: "Fe", max: 0.3 },
      { element: "C", max: 0.08 },
      { element: "N", max: 0.03 },
      { element: "H", max: 0.015 },
      { element: "Ti", balance: true },
    ],
    conditions: [
      {
        id: "r50400-annealed-sheet",
        name: "Annealed",
        form: "sheet/plate (B265)",
        properties: [
          { property: "yield_strength", value: 275, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265", note: "spec window 275–450 MPa" },
          { property: "tensile_strength", value: 345, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "elongation", value: 20, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
        ],
      },
    ],
    solidusK: 1941, // estimated solidus ballpark
    notes: "Outstanding oxidizing/chloride corrosion resistance. Niche SCC systems exist: anhydrous methanol, hot salt above ~250 °C.",
  },
  {
    uns: "R56400",
    names: ["Ti-6Al-4V", "Grade 5"],
    family: ["Ti", "alpha-beta"],
    standards: ["ASTM B265", "AMS 4911"],
    composition: [
      { element: "Al", min: 5.5, max: 6.75 },
      { element: "V", min: 3.5, max: 4.5 },
      { element: "Fe", max: 0.4 },
      { element: "O", max: 0.2 },
      { element: "Ti", balance: true },
    ],
    conditions: [
      {
        id: "r56400-annealed-sheet",
        name: "Annealed",
        form: "sheet/plate (B265)",
        properties: [
          { property: "yield_strength", value: 828, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "tensile_strength", value: 895, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "elongation", value: 10, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
        ],
      },
    ],
    solidusK: 1877, // estimated solidus ballpark
    notes: "The aerospace workhorse: best strength-to-weight in this seed set. Galvanically noble — check couples with aluminum and steel fasteners.",
  },
  {
    uns: "N06625",
    names: ["Alloy 625", "Inconel 625"],
    family: ["Ni", "solid-solution", "Ni-Cr-Mo"],
    standards: ["ASTM B443 (Grade 1)"],
    composition: [
      { element: "Cr", min: 20.0, max: 23.0 },
      { element: "Mo", min: 8.0, max: 10.0 },
      { element: "Nb", min: 3.15, max: 4.15, note: "Nb + Ta" },
      { element: "Fe", max: 5.0 },
      { element: "Ni", balance: true },
    ],
    conditions: [
      {
        id: "n06625-annealed-plate",
        name: "Annealed (Grade 1)",
        form: "plate (B443)",
        properties: [
          { property: "yield_strength", value: 414, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B443" },
          { property: "tensile_strength", value: 827, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B443" },
          { property: "elongation", value: 30, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B443" },
        ],
      },
    ],
    solidusK: 1563, // estimated solidus ballpark
    notes: "Near-immune to chloride SCC; the escalation path when duplex isn't enough. Priced accordingly.",
  },
  {
    uns: "C26000",
    names: ["Cartridge brass 70/30"],
    family: ["Cu", "brass", "Cu-Zn"],
    standards: ["ASTM B36 (plate/sheet/strip)"],
    composition: [
      { element: "Cu", min: 68.5, max: 71.5 },
      { element: "Pb", max: 0.07 },
      { element: "Fe", max: 0.05 },
      { element: "Zn", balance: true },
    ],
    conditions: [
      {
        id: "c26000-annealed",
        name: "Annealed (typical)",
        form: "sheet/strip",
        properties: [
          { property: "tensile_strength", value: 340, unit: "MPa", testTempC: 23, provenance: "estimated", source: "Widely published typical data", note: "Strongly temper-dependent (O60 soft → H08 spring); verify against B36 temper tables." },
        ],
      },
    ],
    solidusK: 1188, // estimated solidus ballpark
    notes: "The textbook season-cracking (ammonia SCC) alloy: > 15 % Zn + ammonia/amines + residual tensile stress. Stress-relieve after forming.",
  },
];
