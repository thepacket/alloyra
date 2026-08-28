import type { Alloy } from "../types.ts";

/**
 * Seed dataset — version 2026.08.2 (see DATASET_VERSION in index.ts).
 *
 * Licensing rule (blueprint N-5): only values that standards publish as
 * guaranteed minimums, or clearly-flagged typical values, appear here.
 * Nothing is copied from licensed databases (MMPDS, ASM tables).
 * Every value cites its source; ESTIMATED values must be verified against
 * certified data before use in design.
 *
 * Microstructure blocks (2026.08.2, backlog E1) are literature-typical
 * descriptors with block-level citations — searchable vocabulary, not
 * measured characterization of any specific heat.
 */

const DENSITY_SRC = "Widely published typical density — verify against certs";

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
          { property: "density", value: 8.0, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC), metastable — equiaxed recrystallized grains",
          constituents: [
            {
              phase: "Cr₂₃C₆ at grain boundaries",
              role: "embrittling",
              note: "only if sensitized (weld HAZ / 500–800 °C exposure) — not present as-annealed",
            },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "clean high-angle boundaries as-annealed; carbide decoration is the sensitization signature",
          },
          twinning: {
            annealingTwins: "abundant",
            deformationNote:
              "strain-induced α′-martensite plus mechanical twinning at high strain / low temperature (metastable — see Md30)",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "interstitial N + C, substitutional Cr/Ni" },
            { mechanism: "grain-refinement", role: "active" },
            {
              mechanism: "strain-hardening",
              role: "active",
              note: "exceptional work-hardening capacity (n ≈ 0.45 annealed; TRIP contribution from strain-induced martensite)",
            },
          ],
          features: ["low stacking-fault energy", "TRIP", "metastable austenite"],
          source: "ASM Specialty Handbook: Stainless Steels (1994); ASM Handbook Vol. 9 (2004)",
        },
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
          { property: "density", value: 8.0, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC), metastable — equiaxed recrystallized grains",
          grainBoundaries: {
            serration: "none-documented",
            note: "low carbon starves Cr₂₃C₆ — boundaries stay clean through weld thermal cycles (the point of the L grade)",
          },
          twinning: {
            annealingTwins: "abundant",
            deformationNote: "strain-induced α′-martensite as in 304; slightly leaner interstitial content",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "lower C than 304 — hence the lower strength minimums" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "high work-hardening capacity (n ≈ 0.45 annealed)" },
          ],
          features: ["low stacking-fault energy", "sensitization-resistant", "metastable austenite"],
          source: "ASM Specialty Handbook: Stainless Steels (1994); ASM Handbook Vol. 9 (2004)",
        },
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
          { property: "density", value: 8.0, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC) — more stable than 304 (higher Ni + Mo)",
          grainBoundaries: {
            serration: "none-documented",
            note: "low carbon resists sensitization as in 304L",
          },
          twinning: {
            annealingTwins: "abundant",
            deformationNote: "less strain-induced martensite than 304 — higher austenite stability (see Md30)",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Mo adds substitutional strengthening over 304L" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "n ≈ 0.4 annealed — slightly below 304" },
          ],
          features: ["low stacking-fault energy", "stable austenite"],
          source: "ASM Specialty Handbook: Stainless Steels (1994); ASM Handbook Vol. 9 (2004)",
        },
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
          { property: "density", value: 8.0, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC), stable — equiaxed recrystallized grains",
          constituents: [
            {
              phase: "sigma / chi intermetallics",
              role: "embrittling",
              note: "higher Mo accelerates sigma formation on slow cooling or 600–900 °C exposure",
            },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "abundant" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "highest Mo of the seed austenitics" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active" },
          ],
          features: ["low stacking-fault energy", "sigma-phase watch"],
          source: "ASM Specialty Handbook: Stainless Steels (1994); ASM Handbook Vol. 9 (2004)",
        },
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
          { property: "density", value: 7.8, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix:
            "duplex ≈ 50/50 ferrite (BCC) + austenite (FCC) — fine banded two-phase structure in rolled plate",
          constituents: [
            {
              phase: "sigma / chi / Cr₂N",
              role: "embrittling",
              note: "form in the 700–950 °C window (fabrication) — solution anneal dissolves them",
            },
            {
              phase: "α′ (spinodal Cr-rich ferrite decomposition)",
              role: "embrittling",
              note: "475 °C embrittlement of the ferrite phase on long exposure ~300–550 °C",
            },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "phase boundaries (α/γ) dominate the boundary network — the microstructural basis of the SCC resistance",
          },
          twinning: { annealingTwins: "present", deformationNote: "in the austenite islands" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "N is the potent addition (0.14–0.20 wt%)" },
            {
              mechanism: "grain-refinement",
              role: "active",
              note: "fine duplex phase spacing acts as an effective Hall-Petch refinement — ~2× austenitic yield",
            },
            { mechanism: "strain-hardening", role: "active" },
          ],
          texture: "banded α/γ structure in rolled plate — through-thickness anisotropy",
          features: ["duplex", "phase balance", "475C embrittlement watch"],
          source: "Gunn (ed.), Duplex Stainless Steels, Abington (1997); ASM Specialty Handbook: Stainless Steels (1994)",
        },
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
      { element: "Mn", min: 0.8, max: 1.2, note: "regulated for plate over ~20 mm; thinner product may be unregulated" },
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
          { property: "density", value: 7.85, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "polygonal ferrite (BCC) + pearlite colonies, often banded in rolled plate",
          constituents: [
            {
              phase: "pearlite (ferrite + cementite lamellae)",
              role: "hardening",
              note: "fraction scales with carbon; carries the UTS above the ferrite baseline",
            },
            { phase: "MnS inclusions", role: "embrittling", note: "elongated in rolling — through-thickness ductility penalty" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: {
            annealingTwins: "absent",
            deformationNote: "BCC ferrite twins only under shock/cryogenic loading",
          },
          strengthening: [
            { mechanism: "grain-refinement", role: "dominant", note: "ferrite grain size is the main strength lever (Hall-Petch)" },
            { mechanism: "solid-solution", role: "active", note: "Mn, plus interstitial C/N (strain-aging source)" },
          ],
          texture: "pearlite/ferrite banding along rolling direction",
          features: ["ferrite-pearlite", "strain aging", "yield point elongation"],
          source: "Krauss, Steels: Processing, Structure, and Performance, 2nd ed., ASM (2015)",
        },
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
          { property: "density", value: 7.85, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "tempered lath martensite (BCC) — high dislocation density retained from the quench",
          constituents: [
            {
              phase: "tempered carbides (cementite → alloy carbides)",
              role: "hardening",
              note: "fine dispersion from 425 °C temper — the strength/toughness trade dial",
            },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "prior-austenite boundaries are the temper-embrittlement (350–575 °C) and hydrogen-cracking path",
          },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "transformation", role: "dominant", note: "martensitic C supersaturation + lath substructure" },
            { mechanism: "dispersion", role: "active", note: "tempered carbide dispersion" },
            { mechanism: "strain-hardening", role: "active", note: "transformation-inherited dislocation density" },
            { mechanism: "solid-solution", role: "active", note: "Ni/Cr/Mo" },
          ],
          features: ["quench and temper", "prior austenite grain boundaries", "temper embrittlement watch"],
          source: "Krauss, Steels: Processing, Structure, and Performance, 2nd ed., ASM (2015); ASM Handbook Vol. 4 (1991)",
        },
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
          { property: "density", value: 2.7, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "aluminum solid solution (FCC), recrystallized or fibrous depending on product",
          constituents: [
            {
              phase: "β″ needles (Mg₅Si₆ precursor to Mg₂Si)",
              role: "hardening",
              note: "peak-aged coherent needles, sheared by dislocations",
            },
            { phase: "Fe-rich intermetallics (AlFeSi)", role: "inert", note: "insoluble constituent particles from casting" },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "narrow precipitate-free zones beside boundaries in aged tempers",
          },
          twinning: { annealingTwins: "absent", deformationNote: "high stacking-fault energy — slip only" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "β″ at peak age (T6) — shearing regime" },
            { mechanism: "solid-solution", role: "active", note: "residual Mg/Si in solution" },
          ],
          features: ["age hardenable", "precipitate-free zones", "HAZ softening when welded"],
          source: "Polmear, Light Alloys, 5th ed., Butterworth-Heinemann (2017)",
        },
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
          { property: "density", value: 2.81, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "aluminum solid solution (FCC), unrecrystallized pancake grains in plate",
          constituents: [
            { phase: "GP zones + η′ (MgZn₂ precursor)", role: "hardening", note: "peak-aged fine coherent dispersion — shearing regime" },
            {
              phase: "η (MgZn₂) on grain boundaries",
              role: "embrittling",
              note: "near-continuous GB films + precipitate-free zones — the short-transverse SCC path",
            },
            { phase: "Cr-bearing dispersoids (Al₁₂Mg₂Cr)", role: "grain-refining", note: "retard recrystallization" },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "GB η + PFZ control intergranular fracture and SCC in T6",
          },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "η′/GP at peak age — largest increment in the seed set" },
            { mechanism: "solid-solution", role: "active" },
            { mechanism: "grain-refinement", role: "active", note: "dispersoid-stabilized elongated grain structure" },
          ],
          texture: "strong rolled-plate texture; short-transverse direction is the SCC-critical orientation",
          features: ["peak aged", "precipitate-free zones", "grain boundary films"],
          source: "Polmear, Light Alloys, 5th ed., Butterworth-Heinemann (2017)",
        },
      },
      {
        id: "a97075-t7351-plate",
        name: "T7351 (overaged)",
        form: "plate (B209)",
        properties: [
          { property: "yield_strength", value: 386, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent" },
          { property: "tensile_strength", value: 469, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209" },
          { property: "density", value: 2.81, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "aluminum solid solution (FCC), unrecrystallized pancake grains in plate",
          constituents: [
            {
              phase: "η′/η (MgZn₂), coarsened",
              role: "hardening",
              note: "overaged past peak — Orowan looping regime; ~15 % strength surrendered vs T651",
            },
            {
              phase: "η (MgZn₂) on grain boundaries, discontinuous",
              role: "inert",
              note: "coarsened, broken-up GB precipitates — the microstructural reason T73 resists SCC",
            },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "coarsened η′/η — Orowan (looping) regime" },
            { mechanism: "solid-solution", role: "active" },
          ],
          texture: "as T651 — rolled-plate anisotropy remains",
          features: ["overaged", "orowan looping", "SCC-resistant temper"],
          source: "Polmear, Light Alloys, 5th ed., Butterworth-Heinemann (2017)",
        },
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
          { property: "density", value: 4.51, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "equiaxed α (HCP)",
          constituents: [
            { phase: "TiH₂ hydrides", role: "embrittling", note: "precipitate above ~100–150 ppm H — the hydrogen limit exists for this" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: {
            annealingTwins: "rare",
            deformationNote:
              "{10-12} tensile twinning is a significant deformation mode in α-Ti, especially at low temperature and coarse grain",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "interstitial O sets the grade (O_max 0.25 for Gr 2) + Fe" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "twinning contributes to hardening in HCP" },
          ],
          texture: "sheet basal texture from rolling — modest in-plane anisotropy",
          features: ["hcp", "interstitial strengthening", "hydride watch"],
          source: "Lütjering & Williams, Titanium, 2nd ed., Springer (2007)",
        },
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
          { property: "density", value: 4.43, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "mill-annealed α (HCP) grains + intergranular β (BCC) — fine two-phase structure",
          grainBoundaries: {
            serration: "none-documented",
            note: "α/β interfaces dominate; continuous GB-α forms in β-processed material (different condition)",
          },
          twinning: {
            annealingTwins: "absent",
            deformationNote: "deformation twinning largely suppressed by Al solute and fine grain size (unlike CP-Ti)",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Al in α (+ O interstitial); V stabilizes and strengthens β" },
            { mechanism: "grain-refinement", role: "active", note: "fine two-phase α/β spacing" },
          ],
          texture: "processing-dependent α texture; mill-annealed plate is moderately anisotropic",
          features: ["alpha-beta", "two-phase", "mill annealed"],
          source: "Lütjering & Williams, Titanium, 2nd ed., Springer (2007)",
        },
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
          { property: "density", value: 8.44, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "γ austenite (FCC) Ni-Cr solid solution",
          constituents: [
            { phase: "MC / M₆C carbides", role: "inert", note: "scattered primary carbides" },
            {
              phase: "γ″ (Ni₃Nb, ordered BCT) — service-induced",
              role: "hardening",
              note: "slowly ages in at ~550–750 °C exposure; intentional in Grade 2 / 625 PLUS",
            },
            {
              phase: "δ (Ni₃Nb, orthorhombic)",
              role: "embrittling",
              note: "long exposure ~650–900 °C transforms γ″ → δ with ductility loss",
            },
          ],
          grainBoundaries: {
            serration: "possible-by-heat-treatment",
            note: "grain-boundary serration via controlled slow cooling is documented for γ′/δ-forming Ni superalloys; not a standard mill practice for annealed Grade 1 625",
          },
          twinning: { annealingTwins: "abundant", deformationNote: "low-SFE FCC — planar slip" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Mo + Nb are among the most potent substitutional strengtheners in Ni" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "high work-hardening from planar slip" },
          ],
          features: ["superalloy", "service aging watch", "planar slip"],
          source:
            "Floreen, Fuchs & Yang, 'The Metallurgy of Alloy 625', Superalloys 718, 625, 706 and Various Derivatives, TMS (1994)",
        },
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
          { property: "density", value: 8.53, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "α brass (FCC Cu-Zn solid solution), equiaxed recrystallized grains",
          grainBoundaries: { serration: "none-documented" },
          twinning: {
            annealingTwins: "abundant",
            deformationNote:
              "the textbook annealing-twin microstructure (SFE ≈ 14 mJ/m²); deformation twinning joins slip at large strain",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "~30 wt% Zn" },
            {
              mechanism: "strain-hardening",
              role: "active",
              note: "very high work-hardening capacity (n ≈ 0.5 annealed) — rolled tempers O60→H08 are strain-hardening in action",
            },
            { mechanism: "grain-refinement", role: "active", note: "anneal-controlled grain size sets temper formability" },
          ],
          features: ["low stacking-fault energy", "cartridge brass", "residual stress sensitivity"],
          source: "ASM Specialty Handbook: Copper and Copper Alloys, ASM International (2001)",
        },
      },
    ],
    solidusK: 1188, // estimated solidus ballpark
    notes: "The textbook season-cracking (ammonia SCC) alloy: > 15 % Zn + ammonia/amines + residual tensile stress. Stress-relieve after forming.",
  },
  {
    uns: "S41000",
    names: ["410", "1.4006"],
    family: ["Fe", "stainless", "martensitic"],
    standards: ["ASTM A240/A240M"],
    composition: [
      { element: "C", min: 0.08, max: 0.15 },
      { element: "Mn", max: 1.0 },
      { element: "Si", max: 1.0 },
      { element: "Cr", min: 11.5, max: 13.5 },
      { element: "Ni", max: 0.75 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s41000-annealed-plate",
        name: "Annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 205, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 450, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 20, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M", note: "verify governing edition/product form" },
          { property: "density", value: 7.75, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "ferrite (BCC) + dispersed Cr-rich carbides (annealed state of a hardenable composition)",
          constituents: [
            { phase: "M₂₃C₆ carbides", role: "hardening", note: "spheroidized dispersion in the annealed condition" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Cr + interstitials in ferrite" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "dispersion", role: "active", note: "annealed carbide dispersion" },
          ],
          features: ["hardenable", "quench-and-temper capable", "12Cr"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
        note: "Hardenable to tempered-martensite conditions (not seeded); heat-treated data must come from the governing product spec.",
      },
    ],
    solidusK: 1755, // estimated solidus ballpark
    notes: "General-purpose 12 % Cr martensitic stainless. Modest corrosion resistance; hardened-and-low-tempered conditions carry hydrogen/SCC hardness caps like other high-strength steels.",
  },
  {
    uns: "S43000",
    names: ["430", "1.4016"],
    family: ["Fe", "stainless", "ferritic"],
    standards: ["ASTM A240/A240M", "EN 10088-2"],
    composition: [
      { element: "C", max: 0.12 },
      { element: "Mn", max: 1.0 },
      { element: "Si", max: 1.0 },
      { element: "Cr", min: 16.0, max: 18.0 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s43000-annealed-sheet",
        name: "Annealed",
        form: "sheet/plate (A240)",
        properties: [
          { property: "yield_strength", value: 205, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 450, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 22, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "density", value: 7.7, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "ferrite (BCC), fully ferritic to the melt",
          constituents: [
            {
              phase: "α′ (Cr-rich spinodal decomposition)",
              role: "embrittling",
              note: "475 °C embrittlement on ~300–550 °C exposure — the classic ferritic-stainless service limit",
            },
            { phase: "Cr carbides at grain boundaries", role: "embrittling", note: "rapid sensitization in weld HAZ (interstitials diffuse fast in BCC)" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent", deformationNote: "BCC — slip only at ordinary conditions" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Cr + interstitial C/N" },
            { mechanism: "grain-refinement", role: "active", note: "grain growth in welds is the ductility hazard" },
          ],
          features: ["ferritic", "475C embrittlement watch", "DBTT"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
      },
    ],
    solidusK: 1770, // estimated solidus ballpark
    notes: "Ferritic 17 % Cr: immune to chloride SCC (the classic austenitic counterexample) but tough-to-weld, DBTT-limited, and 475 °C-embrittlement-prone.",
  },
  {
    uns: "S17400",
    names: ["17-4 PH", "630", "1.4542"],
    family: ["Fe", "stainless", "precipitation-hardening"],
    standards: ["ASTM A693 (Grade 630)", "ASTM A564/A564M"],
    composition: [
      { element: "C", max: 0.07 },
      { element: "Mn", max: 1.0 },
      { element: "Si", max: 1.0 },
      { element: "Cr", min: 15.0, max: 17.5 },
      { element: "Ni", min: 3.0, max: 5.0 },
      { element: "Cu", min: 3.0, max: 5.0 },
      { element: "Nb", min: 0.15, max: 0.45, note: "Nb + Ta" },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s17400-h900",
        name: "H900 (peak aged)",
        form: "plate (A693)",
        properties: [
          { property: "yield_strength", value: 1170, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A693" },
          { property: "tensile_strength", value: 1310, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A693" },
          { property: "elongation", value: 10, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A693", note: "thickness-dependent; verify governing table" },
          { property: "density", value: 7.75, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "low-carbon lath martensite (BCC)",
          constituents: [
            { phase: "Cu-rich precipitates (coherent BCC → FCC ε-Cu)", role: "hardening", note: "peak-aged at 480 °C — the PH in 17-4 PH" },
            { phase: "NbC", role: "grain-refining", note: "stabilizes C, pins prior-austenite grains" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "Cu-rich particles in martensite — shearing regime at H900" },
            { mechanism: "transformation", role: "active", note: "martensitic matrix" },
            { mechanism: "solid-solution", role: "active" },
          ],
          features: ["precipitation hardening", "peak aged", "martensitic PH"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
        note: "Peak-aged H900 carries the usual high-strength penalty: hydrogen-embrittlement and SCC susceptibility — overage (H1025/H1150) for aqueous service.",
      },
      {
        id: "s17400-h1150",
        name: "H1150 (overaged)",
        form: "plate (A693)",
        properties: [
          { property: "yield_strength", value: 725, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A693" },
          { property: "tensile_strength", value: 930, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A693" },
          { property: "elongation", value: 16, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A693" },
          { property: "density", value: 7.75, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "tempered lath martensite (BCC) + reverted austenite",
          constituents: [
            { phase: "Cu precipitates, coarsened (incoherent)", role: "hardening", note: "overaged at 620 °C — Orowan regime, strength traded for toughness" },
            { phase: "reverted austenite", role: "inert", note: "improves toughness and hydrogen tolerance" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "coarsened Cu particles — Orowan looping" },
            { mechanism: "transformation", role: "active" },
          ],
          features: ["overaged", "orowan looping", "SCC-tolerant temper"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
      },
    ],
    solidusK: 1677, // estimated solidus ballpark
    notes: "The workhorse precipitation-hardening stainless: one solution treatment, one low-distortion age. The H900↔H1150 choice is the strength-vs-environmental-cracking dial.",
  },
  {
    uns: "N08904",
    names: ["904L", "1.4539"],
    family: ["Fe", "stainless", "super-austenitic"],
    standards: ["ASTM B625", "ASTM A240/A240M"],
    composition: [
      { element: "C", max: 0.02 },
      { element: "Mn", max: 2.0 },
      { element: "Si", max: 1.0 },
      { element: "Cr", min: 19.0, max: 23.0 },
      { element: "Ni", min: 23.0, max: 28.0 },
      { element: "Mo", min: 4.0, max: 5.0 },
      { element: "Cu", min: 1.0, max: 2.0 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "n08904-annealed-plate",
        name: "Solution annealed",
        form: "plate (B625)",
        properties: [
          { property: "yield_strength", value: 220, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B625", note: "verify governing edition" },
          { property: "tensile_strength", value: 490, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B625" },
          { property: "elongation", value: 35, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B625" },
          { property: "density", value: 7.95, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC), fully stable (high Ni)",
          constituents: [
            { phase: "sigma / chi intermetallics", role: "embrittling", note: "high Mo — avoid slow cooling through 600–1000 °C" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "abundant" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Mo + Cu; Cu adds reducing-acid (H₂SO₄) resistance" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active" },
          ],
          features: ["super-austenitic", "stable austenite", "sulfuric acid service"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
      },
    ],
    solidusK: 1623, // estimated solidus ballpark
    notes: "High-Ni super-austenitic for sulfuric/phosphoric acid and chloride service beyond 317L; the step before 6-Mo grades and nickel alloys.",
  },
  {
    uns: "S31254",
    names: ["6Mo super-austenitic (S31254)", "254-type", "1.4547"],
    family: ["Fe", "stainless", "super-austenitic"],
    standards: ["ASTM A240/A240M"],
    composition: [
      { element: "C", max: 0.02 },
      { element: "Mn", max: 1.0 },
      { element: "Si", max: 0.8 },
      { element: "Cr", min: 19.5, max: 20.5 },
      { element: "Ni", min: 17.5, max: 18.5 },
      { element: "Mo", min: 6.0, max: 6.5 },
      { element: "Cu", min: 0.5, max: 1.0 },
      { element: "N", min: 0.18, max: 0.25 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s31254-annealed-plate",
        name: "Solution annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 310, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M", note: "verify governing edition" },
          { property: "tensile_strength", value: 655, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M", note: "verify governing edition" },
          { property: "elongation", value: 35, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "density", value: 8.0, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "austenite (FCC), N-strengthened, fully stable",
          constituents: [
            { phase: "sigma / chi / Laves", role: "embrittling", note: "6 % Mo makes intermetallic precipitation fast — solution anneal and quench; watch weld HAZ" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "abundant" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "N (0.18–0.25 wt%) is the potent interstitial; Mo substitutional" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "N raises work-hardening rate" },
          ],
          features: ["6-Mo", "nitrogen strengthened", "seawater-capable"],
          source: "ASM Specialty Handbook: Stainless Steels (1994)",
        },
      },
    ],
    solidusK: 1593, // estimated solidus ballpark
    notes: "6-Mo grade: PREN ≥ 42, crevice-resistant in ambient seawater. Weld with over-alloyed (625-type) filler — autogenous welds lose Mo locally at solidification cells.",
  },
  {
    uns: "S32750",
    names: ["2507 super duplex", "1.4410"],
    family: ["Fe", "stainless", "duplex"],
    standards: ["ASTM A240/A240M"],
    composition: [
      { element: "C", max: 0.03 },
      { element: "Mn", max: 1.2 },
      { element: "Si", max: 0.8 },
      { element: "Cr", min: 24.0, max: 26.0 },
      { element: "Ni", min: 6.0, max: 8.0 },
      { element: "Mo", min: 3.0, max: 5.0 },
      { element: "N", min: 0.24, max: 0.32 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "s32750-annealed-plate",
        name: "Solution annealed",
        form: "plate (A240)",
        properties: [
          { property: "yield_strength", value: 550, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "tensile_strength", value: 795, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "elongation", value: 15, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM A240/A240M" },
          { property: "density", value: 7.8, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "duplex ≈ 50/50 ferrite (BCC) + austenite (FCC), finely banded",
          constituents: [
            { phase: "sigma / chi / Cr₂N", role: "embrittling", note: "higher Cr+Mo than 2205 — even narrower fabrication windows" },
            { phase: "α′ (spinodal)", role: "embrittling", note: "475 °C embrittlement of ferrite; ~250 °C practical service ceiling" },
          ],
          grainBoundaries: { serration: "none-documented", note: "α/γ phase-boundary network dominates" },
          twinning: { annealingTwins: "present", deformationNote: "in austenite islands" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "N 0.24–0.32 wt% — highest in the seed set" },
            { mechanism: "grain-refinement", role: "active", note: "fine duplex spacing" },
            { mechanism: "strain-hardening", role: "active" },
          ],
          texture: "banded α/γ rolled-plate structure",
          features: ["super duplex", "PREN ≥ 40", "phase balance critical"],
          source: "Gunn (ed.), Duplex Stainless Steels, Abington (1997)",
        },
      },
    ],
    solidusK: 1650, // estimated solidus ballpark
    notes: "Super duplex: ~550 MPa yield with seawater-grade pitting resistance. Everything 2205 must watch, 2507 must watch harder — sigma, nitrides, 475 °C.",
  },
  {
    uns: "G41300",
    names: ["4130", "AISI 4130"],
    family: ["Fe", "low-alloy-steel", "Cr-Mo"],
    standards: ["ASTM A29/A29M", "AMS 6370"],
    composition: [
      { element: "C", min: 0.28, max: 0.33 },
      { element: "Mn", min: 0.4, max: 0.6 },
      { element: "Si", min: 0.15, max: 0.35 },
      { element: "Cr", min: 0.8, max: 1.1 },
      { element: "Mo", min: 0.15, max: 0.25 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "g41300-normalized",
        name: "Normalized 870 °C",
        form: "bar/tube",
        properties: [
          { property: "yield_strength", value: 435, unit: "MPa", testTempC: 23, provenance: "estimated", source: "Widely published typical data", note: "Typical, not guaranteed — verify against certs and governing spec." },
          { property: "tensile_strength", value: 670, unit: "MPa", testTempC: 23, provenance: "estimated", source: "Widely published typical data", note: "Typical, not guaranteed." },
          { property: "density", value: 7.85, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "fine ferrite + pearlite (normalized); bainite appears in faster-cooled sections",
          constituents: [
            { phase: "pearlite", role: "hardening", note: "refined by the normalize" },
          ],
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "grain-refinement", role: "dominant", note: "normalizing refines ferrite grain size" },
            { mechanism: "solid-solution", role: "active", note: "Cr, Mo, Mn" },
          ],
          features: ["weldable chromoly", "hardenable", "aircraft tube"],
          source: "Krauss, Steels: Processing, Structure, and Performance, 2nd ed., ASM (2015)",
        },
        note: "Q&T conditions (not seeded) reach far higher strength with the usual >38 HRC hydrogen/sulfide caveats.",
      },
    ],
    solidusK: 1705, // estimated solidus ballpark
    notes: "The weldable Cr-Mo steel (aircraft tube, bike frames, pressure parts). Lower C than 4340 keeps the weld HAZ manageable.",
  },
  {
    uns: "A92024",
    names: ["2024"],
    family: ["Al", "wrought", "2xxx (Al-Cu-Mg)"],
    standards: ["ASTM B209", "AMS 4037"],
    composition: [
      { element: "Cu", min: 3.8, max: 4.9 },
      { element: "Mg", min: 1.2, max: 1.8 },
      { element: "Mn", min: 0.3, max: 0.9 },
      { element: "Si", max: 0.5 },
      { element: "Fe", max: 0.5 },
      { element: "Zn", max: 0.25 },
      { element: "Al", balance: true },
    ],
    conditions: [
      {
        id: "a92024-t3-sheet",
        name: "T3 (solution treated + cold worked + naturally aged)",
        form: "sheet (B209)",
        properties: [
          { property: "yield_strength", value: 290, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent; check the governing table" },
          { property: "tensile_strength", value: 435, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent" },
          { property: "elongation", value: 15, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B209", note: "thickness-dependent" },
          { property: "density", value: 2.78, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "aluminum solid solution (FCC), elongated grains in sheet",
          constituents: [
            { phase: "GPB zones / S″ (Al₂CuMg precursors)", role: "hardening", note: "natural aging after quench + cold work" },
            { phase: "Al₂CuMg / Al₂Cu constituents", role: "embrittling", note: "coarse insoluble particles — fatigue-crack initiation sites and local cathodes (pitting)" },
            { phase: "Mn-bearing dispersoids (Al₂₀Cu₂Mn₃)", role: "grain-refining" },
          ],
          grainBoundaries: { serration: "none-documented", note: "GB precipitation + PFZ drive intergranular corrosion in improperly quenched material" },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "GPB/S″ clusters — natural aging" },
            { mechanism: "strain-hardening", role: "active", note: "the cold-work step in T3" },
            { mechanism: "solid-solution", role: "active" },
          ],
          texture: "rolled sheet texture; usually supplied alclad for corrosion protection",
          features: ["damage tolerant", "naturally aged", "alclad practice"],
          source: "Polmear, Light Alloys, 5th ed., Butterworth-Heinemann (2017)",
        },
      },
    ],
    solidusK: 775, // estimated solidus ballpark
    notes: "The damage-tolerance aerospace alloy (fuselage skins, lower wing). Poor bare corrosion resistance — clad it or coat it; essentially non-weldable by fusion.",
  },
  {
    uns: "A95083",
    names: ["5083"],
    family: ["Al", "wrought", "5xxx (Al-Mg)"],
    standards: ["ASTM B928 (marine)", "ASTM B209"],
    composition: [
      { element: "Mg", min: 4.0, max: 4.9 },
      { element: "Mn", min: 0.4, max: 1.0 },
      { element: "Cr", min: 0.05, max: 0.25 },
      { element: "Si", max: 0.4 },
      { element: "Fe", max: 0.4 },
      { element: "Al", balance: true },
    ],
    conditions: [
      {
        id: "a95083-h116-plate",
        name: "H116 (strain hardened, exfoliation-resistant)",
        form: "plate (B928)",
        properties: [
          { property: "yield_strength", value: 215, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B928", note: "thickness-dependent" },
          { property: "tensile_strength", value: 305, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B928" },
          { property: "elongation", value: 10, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B928", note: "thickness-dependent" },
          { property: "density", value: 2.66, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "aluminum solid solution (FCC) with retained cold-work dislocation structure",
          constituents: [
            {
              phase: "β (Al₃Mg₂) at grain boundaries",
              role: "embrittling",
              note: "precipitates on long exposure > ~65 °C (sensitization) — continuous GB films open intergranular corrosion/SCC; H116 temper is qualified against it (ASTM G66/G67)",
            },
            { phase: "Mn/Cr dispersoids", role: "grain-refining" },
          ],
          grainBoundaries: {
            serration: "none-documented",
            note: "GB β-phase continuity is the sensitization metric",
          },
          twinning: { annealingTwins: "absent" },
          strengthening: [
            {
              mechanism: "strain-hardening",
              role: "dominant",
              note: "the H-temper IS strain hardening — 5xxx alloys are not heat-treatable",
            },
            { mechanism: "solid-solution", role: "active", note: "4.0–4.9 wt% Mg — the strongest common non-heat-treatable Al solute" },
            { mechanism: "grain-refinement", role: "active" },
          ],
          features: ["non-heat-treatable", "marine plate", "sensitization watch"],
          source: "Polmear, Light Alloys, 5th ed., Butterworth-Heinemann (2017)",
        },
      },
    ],
    solidusK: 847, // estimated solidus ballpark
    notes: "The marine aluminum: weldable, seawater-tolerant, strain-hardened. Keep sustained service below ~65 °C or manage β-phase sensitization (the textbook non-heat-treatable strain-hardening system).",
  },
  {
    uns: "R56320",
    names: ["Ti-3Al-2.5V", "Grade 9"],
    family: ["Ti", "near-alpha"],
    standards: ["ASTM B265", "AMS 4943 (tubing)"],
    composition: [
      { element: "Al", min: 2.5, max: 3.5 },
      { element: "V", min: 2.0, max: 3.0 },
      { element: "Fe", max: 0.25 },
      { element: "O", max: 0.15 },
      { element: "Ti", balance: true },
    ],
    conditions: [
      {
        id: "r56320-annealed",
        name: "Annealed",
        form: "sheet/tube (B265)",
        properties: [
          { property: "yield_strength", value: 483, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "tensile_strength", value: 620, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "elongation", value: 15, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B265" },
          { property: "density", value: 4.48, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "predominantly α (HCP) with small intergranular β fraction — the 'half-6-4' lean α-β",
          grainBoundaries: { serration: "none-documented" },
          twinning: {
            annealingTwins: "rare",
            deformationNote: "some {10-12} twinning retained — less than CP-Ti, more than Ti-6-4 (lower Al)",
          },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "Al in α + O interstitial" },
            { mechanism: "grain-refinement", role: "active" },
            { mechanism: "strain-hardening", role: "active", note: "cold-workable — the reason it makes tubing" },
          ],
          features: ["cold formable", "hydraulic tubing", "lean alpha-beta"],
          source: "Lütjering & Williams, Titanium, 2nd ed., Springer (2007)",
        },
      },
    ],
    solidusK: 1900, // estimated solidus ballpark
    notes: "The cold-workable middle ground between CP-Ti and Ti-6-4: aircraft hydraulic tubing, bicycle frames. Retains most of titanium's corrosion behavior.",
  },
  {
    uns: "N07718",
    names: ["Alloy 718", "Inconel 718"],
    family: ["Ni", "precipitation-hardened", "Ni-Fe-Cr"],
    standards: ["ASTM B637", "AMS 5662/5663"],
    composition: [
      { element: "Ni", min: 50.0, max: 55.0 },
      { element: "Cr", min: 17.0, max: 21.0 },
      { element: "Nb", min: 4.75, max: 5.5, note: "Nb + Ta" },
      { element: "Mo", min: 2.8, max: 3.3 },
      { element: "Ti", min: 0.65, max: 1.15 },
      { element: "Al", min: 0.2, max: 0.8 },
      { element: "C", max: 0.08 },
      { element: "Fe", balance: true },
    ],
    conditions: [
      {
        id: "n07718-sta",
        name: "Solution treated + double aged (718/720 °C class)",
        form: "bar/forging (B637)",
        properties: [
          { property: "yield_strength", value: 1035, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B637" },
          { property: "tensile_strength", value: 1275, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B637" },
          { property: "elongation", value: 12, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B637" },
          { property: "density", value: 8.19, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "γ austenite (FCC) Ni-Fe-Cr",
          constituents: [
            {
              phase: "γ″ (Ni₃Nb, ordered DO22 BCT)",
              role: "hardening",
              note: "the primary strengthener — coherent discs, sluggish aging (the weldability secret)",
            },
            { phase: "γ′ (Ni₃(Al,Ti))", role: "hardening", note: "secondary, ~⅓ of the precipitate fraction" },
            {
              phase: "δ (Ni₃Nb, orthorhombic) at grain boundaries",
              role: "grain-refining",
              note: "deliberate δ controls grain size in forging; excessive δ consumes Nb and costs strength",
            },
            { phase: "NbC / Laves (segregation)", role: "embrittling", note: "solidification segregation — the AM/casting homogenization problem" },
          ],
          grainBoundaries: {
            serration: "possible-by-heat-treatment",
            note: "serrated grain boundaries are produced in 718-class superalloys by controlled slow cooling through the δ/γ′ solvus — documented route to improved creep-rupture and dwell-fatigue resistance",
          },
          twinning: { annealingTwins: "abundant", deformationNote: "low-SFE FCC, planar slip" },
          strengthening: [
            { mechanism: "precipitation", role: "dominant", note: "γ″ discs — shearing with strong order contribution" },
            { mechanism: "order", role: "active", note: "APB/stacking effects in γ″/γ′" },
            { mechanism: "solid-solution", role: "active", note: "Mo, Nb in γ" },
            { mechanism: "grain-refinement", role: "active", note: "δ-pinned fine grain in forgings" },
          ],
          features: ["superalloy", "gamma double prime", "serration heat treatment documented", "turbine and oilfield workhorse"],
          source:
            "Sundararaman, Mukhopadhyay & Banerjee, Metall. Trans. A 23 (1992) 2015 — γ″/γ′ precipitation in Alloy 718; Koul & Gessinger, Acta Metall. 31 (1983) 1061 — GB serration mechanism",
        },
      },
    ],
    solidusK: 1533, // estimated solidus ballpark
    notes: "The most-produced superalloy: jet-engine discs to oilfield hangers (API 6ACRA caps hardness for sour service). Usable to ~650 °C, where γ″ → δ transformation ends its life.",
  },
  {
    uns: "N10276",
    names: ["Alloy C-276", "Hastelloy C-276"],
    family: ["Ni", "solid-solution", "Ni-Mo-Cr"],
    standards: ["ASTM B575"],
    composition: [
      { element: "Cr", min: 14.5, max: 16.5 },
      { element: "Mo", min: 15.0, max: 17.0 },
      { element: "W", min: 3.0, max: 4.5 },
      { element: "Fe", min: 4.0, max: 7.0 },
      { element: "Co", max: 2.5 },
      { element: "C", max: 0.01 },
      { element: "Ni", balance: true },
    ],
    conditions: [
      {
        id: "n10276-annealed-plate",
        name: "Solution annealed",
        form: "plate (B575)",
        properties: [
          { property: "yield_strength", value: 283, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B575" },
          { property: "tensile_strength", value: 690, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B575" },
          { property: "elongation", value: 40, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B575" },
          { property: "density", value: 8.89, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "γ austenite (FCC) Ni-Mo-Cr solid solution",
          constituents: [
            { phase: "μ phase / M₆C (long exposure)", role: "embrittling", note: "600–900 °C exposure — keep welds solution annealed where practical" },
          ],
          grainBoundaries: { serration: "none-documented", note: "ultra-low C keeps boundaries carbide-free as-welded — the C-276 innovation" },
          twinning: { annealingTwins: "abundant" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "16 % Mo + 4 % W — near the practical solid-solution ceiling in Ni" },
            { mechanism: "strain-hardening", role: "active" },
            { mechanism: "grain-refinement", role: "active" },
          ],
          features: ["universal corrosion alloy", "as-welded serviceable"],
          source: "ASM Handbook Vol. 2 (1990); ASM Specialty Handbook: Nickel, Cobalt, and Their Alloys (2000)",
        },
      },
    ],
    solidusK: 1598, // estimated solidus ballpark
    notes: "The 'when nothing else survives' alloy: hot contaminated acids, wet chlorine, mixed oxidizing/reducing service. Buys immunity with density and price.",
  },
  {
    uns: "N04400",
    names: ["Monel 400", "Alloy 400"],
    family: ["Ni", "solid-solution", "Ni-Cu"],
    standards: ["ASTM B127"],
    composition: [
      { element: "Ni", min: 63.0, note: "Ni + Co" },
      { element: "Cu", min: 28.0, max: 34.0 },
      { element: "Fe", max: 2.5 },
      { element: "Mn", max: 2.0 },
      { element: "C", max: 0.3 },
      { element: "Si", max: 0.5 },
    ],
    conditions: [
      {
        id: "n04400-annealed-plate",
        name: "Hot-rolled, annealed",
        form: "plate (B127)",
        properties: [
          { property: "yield_strength", value: 193, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B127" },
          { property: "tensile_strength", value: 483, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B127" },
          { property: "elongation", value: 35, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B127" },
          { property: "density", value: 8.8, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "single-phase Ni-Cu solid solution (FCC) — isomorphous system, no second phase to manage",
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "present" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "~30 % Cu in Ni" },
            { mechanism: "strain-hardening", role: "active", note: "cold-worked tempers roughly double the annealed yield" },
            { mechanism: "grain-refinement", role: "active" },
          ],
          features: ["isomorphous", "seawater and HF service"],
          source: "ASM Handbook Vol. 2 (1990); ASM Specialty Handbook: Nickel, Cobalt, and Their Alloys (2000)",
        },
      },
    ],
    solidusK: 1573, // estimated solidus ballpark
    notes: "The classic Ni-Cu: seawater fasteners/shafts, hydrofluoric acid service. Watch ammonia-bearing environments (Cu-alloy SCC heritage) and sulfur attack when hot.",
  },
  {
    uns: "C70600",
    names: ["90-10 copper-nickel", "CuNi 90/10"],
    family: ["Cu", "cupronickel", "Cu-Ni"],
    standards: ["ASTM B171 (plate)", "ASTM B466 (pipe)"],
    composition: [
      { element: "Ni", min: 9.0, max: 11.0 },
      { element: "Fe", min: 1.0, max: 1.8, note: "deliberate — erosion-corrosion resistance" },
      { element: "Mn", max: 1.0 },
      { element: "Zn", max: 1.0 },
      { element: "Cu", balance: true },
    ],
    conditions: [
      {
        id: "c70600-annealed-plate",
        name: "Annealed",
        form: "plate (B171)",
        properties: [
          { property: "yield_strength", value: 105, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B171", note: "verify governing table/thickness" },
          { property: "tensile_strength", value: 275, unit: "MPa", testTempC: 23, provenance: "spec-min", source: "ASTM B171" },
          { property: "elongation", value: 30, unit: "%", testTempC: 23, provenance: "spec-min", source: "ASTM B171", note: "verify governing table" },
          { property: "density", value: 8.94, unit: "g/cm³", testTempC: 23, provenance: "estimated", source: DENSITY_SRC },
        ],
        microstructure: {
          matrix: "single-phase Cu-Ni solid solution (FCC) — isomorphous, with Fe held in solution by the anneal",
          grainBoundaries: { serration: "none-documented" },
          twinning: { annealingTwins: "present" },
          strengthening: [
            { mechanism: "solid-solution", role: "dominant", note: "10 % Ni + deliberate Fe" },
            { mechanism: "strain-hardening", role: "active" },
            { mechanism: "grain-refinement", role: "active" },
          ],
          features: ["seawater piping", "biofouling resistant"],
          source: "ASM Specialty Handbook: Copper and Copper Alloys, ASM International (2001)",
        },
      },
    ],
    solidusK: 1372, // estimated solidus ballpark
    notes: "The seawater piping standard: inherent biofouling resistance, immune to season cracking (unlike brass). Respect flow-velocity limits — erosion-corrosion is its failure mode.",
  },
];
