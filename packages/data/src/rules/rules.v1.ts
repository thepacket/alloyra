import type { FailureRule } from "@alloyra/core";

/**
 * Failure-rule set v1 (blueprint § 6, R-5.2/R-5.3). Rules are DATA:
 * individually cited, versioned, and editable without touching engine code.
 *
 * Thresholds are textbook anchors, deliberately soft (near-bands per
 * R-5.5), and every rule is a flag for expert judgment, not a verdict
 * (R-5.4). reviewedBy is honest: none of these have expert sign-off yet —
 * that review is open question 2 in the blueprint.
 */
export const RULESET_VERSION = "2026.08.1";

const SEED = "seed — awaiting expert review";

export const failureRules: FailureRule[] = [
  {
    id: "scc-chloride-austenitic",
    name: "Chloride SCC — austenitic stainless",
    severity: "serious",
    when: [
      { kind: "family", path: ["Fe", "stainless", "austenitic"] },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 50, nearBand: 0.5 },
      { kind: "duty", field: "tempMaxC", op: ">=", value: 60, nearBand: 0.15 },
      { kind: "tensileStress" },
    ],
    mechanism:
      "Transgranular chloride stress corrosion cracking. Needs the triple: susceptible austenitic structure, chlorides at elevated temperature, and tensile stress (residual welding stress counts). Duplex and ferritic grades are far more resistant.",
    citation: "ASM Handbook Vol. 13A; NACE literature",
    mitigations: [
      "Switch to duplex (e.g. 2205) or ferritic grade",
      "Stress-relieve to reduce residual tensile stress",
      "Lower metal temperature below ~60 °C or shield from chloride concentration",
    ],
    thresholdBasis:
      "50 ppm / 60 °C are screening landmarks from the SCC literature, not safe-operating boundaries; stress level, oxygen, and concentration by evaporation all shift them.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "iso15156-sour-service",
    name: "Sour service — mandatory ISO 15156 qualification check",
    severity: "serious",
    when: [
      { kind: "family", path: ["Fe"] },
      { kind: "duty", field: "h2sKpa", op: ">=", value: 0.3, nearBand: 0.5 },
    ],
    mechanism:
      "H₂S at this partial pressure places steel selection under ANSI/NACE MR0175 / ISO 15156. This flag mandates a traceable qualification against the standard's tables — material class, hardness, heat treatment, environmental region (pH, H₂S, chloride, temperature), and application scope. Alloyra does NOT evaluate those tables and issues no pass or disqualification; the standard supplements, not replaces, the applicable design codes.",
    citation: "ANSI/NACE MR0175 / ISO 15156-2:2020",
    mitigations: [
      "Perform the ISO 15156 code-table evaluation for the specific material class and environmental region",
      "Obtain certified hardness surveys for base metal, weld, and HAZ",
    ],
    thresholdBasis:
      "0.3 kPa is the conventional scoping landmark for sour service; applicability of the standard is what triggers, not a fitness verdict.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "scc-sulfide-hsla",
    name: "Sulfide SCC susceptibility — high-strength steel in sour service",
    severity: "serious",
    when: [
      { kind: "family", path: ["Fe"] },
      { kind: "notFamily", path: ["Fe", "stainless"] },
      { kind: "yieldAtLeast", mpa: 1000, nearBand: 0.1 },
      { kind: "duty", field: "h2sKpa", op: ">=", value: 0.3, nearBand: 0.5 },
    ],
    mechanism:
      "Hydrogen from H₂S corrosion embrittles high-strength steel; susceptibility rises steeply with strength/hardness. Yield ≥ ~1000 MPa is a COARSE PROXY for exceeding ISO 15156 hardness caps — it flags elevated susceptibility for the qualification check above, it does not disqualify.",
    citation: "ANSI/NACE MR0175 / ISO 15156; ASM Handbook Vol. 13A",
    mitigations: [
      "Select a sour-service-qualified grade and temper within the hardness cap",
      "Qualify to ISO 15156 with certified hardness surveys before use",
    ],
    thresholdBasis:
      "Strength is a proxy — the standard's actual limits are hardness- and class-based; hardness data would replace this proxy.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "he-cathodic-hs-steel",
    name: "Hydrogen embrittlement — cathodic protection on high-strength steel",
    severity: "caution",
    when: [
      { kind: "family", path: ["Fe"] },
      { kind: "yieldAtLeast", mpa: 1000, nearBand: 0.1 },
      { kind: "dutyFlag", field: "cathodicProtection", value: true },
    ],
    mechanism:
      "Cathodic overprotection generates hydrogen at the steel surface; above ~1000 MPa yield the embrittlement risk rises steeply. Potential control matters as much as alloy choice.",
    citation: "ASM Handbook Vol. 13A; DNV-RP-B401",
    mitigations: [
      "Limit protection potential (avoid over-polarization)",
      "Use a lower-strength temper where the design allows",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "scc-season-cracking-brass",
    name: "Season cracking — brass in ammonia service",
    severity: "serious",
    when: [
      { kind: "family", path: ["Cu", "brass"] },
      { kind: "contentAtLeast", element: "Zn", wtPct: 15 },
      { kind: "dutyFlag", field: "ammonia", value: true },
      { kind: "tensileStress" },
    ],
    mechanism:
      "Intergranular SCC of >15 % Zn brasses exposed to ammonia/amines with residual or applied tensile stress — the classic 'season cracking'.",
    citation: "ASM Handbook Vol. 13B",
    mitigations: [
      "Stress-relief anneal after forming (~260–300 °C)",
      "Move to a low-Zn brass, cupronickel, or bronze",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "scc-7xxx-peak-aged",
    name: "SCC — peak-aged 7xxx aluminum, sustained stress in chloride/humid service",
    severity: "serious",
    when: [
      { kind: "family", path: ["Al", "wrought", "7xxx (Al-Zn-Mg-Cu)"] },
      { kind: "conditionIncludes", text: "peak aged" },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 1, nearBand: 0 },
      { kind: "tensileStress" },
    ],
    mechanism:
      "Intergranular SCC in the short-transverse direction of peak-aged (T6-class) 7xxx plate under sustained tension in humid/chloride environments; exfoliation often accompanies it.",
    citation: "ASM Handbook Vol. 13B; Alcoa technical literature",
    mitigations: [
      "Overage to T73/T7351 (~15 % strength penalty, large SCC gain)",
      "Avoid sustained short-transverse tension in design and assembly",
      "Shot peen critical surfaces",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "scc-7xxx-overaged-residual",
    name: "SCC residual watch — overaged 7xxx aluminum",
    severity: "caution",
    when: [
      { kind: "family", path: ["Al", "wrought", "7xxx (Al-Zn-Mg-Cu)"] },
      { kind: "conditionIncludes", text: "overaged" },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 1, nearBand: 0 },
      { kind: "tensileStress" },
    ],
    mechanism:
      "T73-class overaging greatly improves but does not erase 7xxx SCC susceptibility; keep short-transverse sustained stresses low.",
    citation: "ASM Handbook Vol. 13B",
    mitigations: ["Detail to minimize short-transverse tension", "Periodic inspection of clamped joints"],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "sensitization-austenitic",
    name: "Sensitization — welded non-L austenitic stainless in corrosive service",
    severity: "serious",
    when: [
      { kind: "family", path: ["Fe", "stainless", "austenitic"] },
      { kind: "specMaxAbove", element: "C", above: 0.04 },
      { kind: "dutyFlag", field: "welded", value: true },
      { kind: "mediumIn", anyOf: ["immersion", "process-fluid", "soil"] },
    ],
    mechanism:
      "Weld HAZ dwell in the 450–850 °C range precipitates Cr carbides at grain boundaries, depleting adjacent Cr → intergranular attack / IGSCC in subsequent corrosive service. L-grades (C ≤ 0.03) and stabilized grades resist.",
    citation: "ASTM A262; ASM Handbook Vol. 13A",
    mitigations: [
      "Use the L-grade (304L/316L) or a stabilized grade (321/347)",
      "Solution anneal after welding where practical",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "pitting-stainless-chloride",
    name: "Pitting — stainless with modest PREN in strong chloride",
    severity: "caution",
    when: [
      { kind: "family", path: ["Fe", "stainless"] },
      { kind: "prenBelow", value: 32 },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 500, nearBand: 0.3 },
    ],
    mechanism:
      "Chloride pitting initiates where PREN is inadequate for the chloride level and temperature; 300-series grades (PREN ≲ 30) pit in strong chloride, seawater-class service generally wants PREN ≥ 40.",
    citation: "PREN comparative screening relation",
    mitigations: [
      "Step up in PREN (316L → 317L → duplex → 6-Mo)",
      "Control temperature and chloride concentration/evaporation",
    ],
    thresholdBasis:
      "Comparative PREN screening only — ignores temperature, pH, oxidizing potential, surface condition, deposits, and evaporative concentration. G48 testing ranks alloys under accelerated ferric-chloride conditions and does not predict service.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "crevice-stainless",
    name: "Crevice corrosion — stainless with crevices in chloride service",
    severity: "caution",
    when: [
      { kind: "family", path: ["Fe", "stainless"] },
      { kind: "dutyFlag", field: "crevices", value: true },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 100, nearBand: 0.3 },
    ],
    mechanism:
      "Occluded chemistry under deposits/gaskets acidifies and concentrates chloride; crevice attack initiates well below the open-surface pitting threshold (CCT < CPT).",
    citation: "ASTM G48; ASM Handbook Vol. 13A",
    mitigations: [
      "Design out crevices (full-penetration welds, no backing strips, gasket choice)",
      "Higher-PREN grade sized to crevice (not open-surface) resistance",
    ],
    thresholdBasis:
      "100 ppm is a scoping landmark; real crevice initiation depends on temperature, crevice geometry, gasket material, and time.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "galvanic-couple",
    name: "Galvanic corrosion — dissimilar couple in an electrolyte",
    severity: "caution",
    when: [
      { kind: "galvanicCouplePresent" },
      { kind: "mediumIn", anyOf: ["immersion", "process-fluid", "soil"] },
    ],
    mechanism:
      "A declared dissimilar-metal couple in an electrolyte drives galvanic attack of the less noble member; severity scales with series separation and adverse cathode:anode area ratio. Check both for this specific pairing.",
    citation: "ASTM G82",
    mitigations: [
      "Isolate electrically (sleeves, washers, coatings on the CATHODE)",
      "Keep the anode large relative to the cathode",
    ],
    thresholdBasis:
      "Fires on any declared couple — it does not weigh galvanic-series separation, area ratio, electrolyte conductivity, or polarization. Treat as a prompt to run that assessment.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "creep-regime",
    name: "Creep regime — service above ~0.4 T_solidus",
    severity: "caution",
    when: [{ kind: "homologousTempAbove", fraction: 0.4, nearBand: 0.1 }],
    mechanism:
      "Above roughly 0.4 of the absolute solidus temperature, time-dependent deformation governs: design moves from yield-based to creep-rupture allowables (Larson-Miller interpolation, § 5).",
    citation: "Standard homologous-temperature criterion; Larson & Miller (1952)",
    mitigations: [
      "Design to creep-rupture data at life and temperature, not room-temperature yield",
      "Consider creep-resistant grades in the qualified condition (e.g. Alloy 625 as B443 Grade 2 solution-annealed — NOT the Grade 1 annealed database entry — or Grade 91) for sustained hot service",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "corrosion-fatigue",
    name: "Corrosion fatigue — cyclic load in a corrosive medium",
    severity: "caution",
    when: [
      { kind: "loadIn", anyOf: ["cyclic"] },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 1, nearBand: 0 },
    ],
    mechanism:
      "A corrosive environment removes the fatigue limit: S-N curves keep falling with cycles. Air-based fatigue data over-predicts life; environment-specific data or large knockdowns are required.",
    citation: "ASM Handbook Vol. 19",
    mitigations: [
      "Use environment-specific S-N data or apply corrosion-fatigue knockdowns",
      "Surface protection + compressive residual stress (peening)",
    ],
    thresholdBasis:
      "Any chloride flags the phenomenon; actual life depends on frequency, waveform, potential, stress amplitude, and surface condition — none of which this rule sees.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "scc-ti-hot-salt",
    name: "Hot-salt SCC — titanium with chloride deposits at temperature",
    severity: "caution",
    when: [
      { kind: "family", path: ["Ti"] },
      { kind: "duty", field: "chloridePpm", op: ">=", value: 1, nearBand: 0 },
      { kind: "duty", field: "tempMaxC", op: ">=", value: 250, nearBand: 0.15 },
      { kind: "tensileStress" },
    ],
    mechanism:
      "Dried chloride salt deposits on stressed titanium above ~250 °C can drive hot-salt SCC — niche, but severe when the geometry traps deposits.",
    citation: "ASM Handbook Vol. 13B",
    mitigations: ["Prevent salt deposition/drying on hot stressed surfaces", "Wash-down provisions in design"],
    thresholdBasis:
      "Bulk chloride is a weak proxy for deposited-salt chemistry and wet/dry history on hot surfaces.",
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
  {
    id: "lme-zinc-steel",
    name: "Liquid-metal embrittlement — zinc on stressed steel",
    severity: "caution",
    when: [
      { kind: "family", path: ["Fe"] },
      { kind: "lmeContact", anyOf: ["zinc"] },
      { kind: "tensileStress" },
    ],
    mechanism:
      "Molten zinc (galvanizing, weld-through of coated parts, fire exposure of galvanized structure) penetrates grain boundaries of stressed steel — a known LME pair.",
    citation: "ASM Handbook Vol. 13A (LME couples)",
    mitigations: [
      "Stress-relieve before galvanizing; control dip practice",
      "Remove coating locally before welding galvanized parts",
    ],
    reviewStatus: "draft",
    reviewedBy: SEED,
  },
];
