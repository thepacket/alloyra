import type { MechanismId } from "@alloyra/core";

/**
 * Microstructure concept vocabulary — version 2026.08.2 (backlog B-104).
 *
 * Concepts make the expert's hunting terms first-class search targets even
 * when no alloy in the seed dataset documents the feature yet: a search for
 * "serrated grain boundaries" must land on an explanation and an honest
 * match count, never on silence. Every concept cites a source; definitions
 * are compressed textbook knowledge, not novel claims.
 */
export interface MicroConcept {
  id: string;
  name: string;
  synonyms: string[];
  /** What the feature is. */
  definition: string;
  /** How it is produced (processing / composition routes). */
  producedBy: string;
  /** What it does to properties — improves and degrades. */
  effects: string;
  /** Query string run against dataset microstructure haystacks. */
  probe: string;
  /** Mechanism filter this concept maps to, when one applies. */
  mechanism?: MechanismId;
  source: string;
}

export const microConcepts: MicroConcept[] = [
  {
    id: "serrated-grain-boundaries",
    name: "Serrated grain boundaries",
    synonyms: [
      "wavy grain boundaries",
      "grain boundary serration",
      "zigzag grain boundaries",
      "serrated grain boundary morphology",
    ],
    definition:
      "Deliberate waviness of grain boundaries — amplitude and wavelength on the micron scale — that mechanically interlocks adjacent grains.",
    producedBy:
      "Controlled slow cooling through the γ′ (or δ) solvus in Ni-base superalloys, where precipitates growing at the moving boundary drag it into a wave; also reported with grain-boundary carbide interactions.",
    effects:
      "Improves creep-rupture life and resistance to grain-boundary sliding, cavitation, and intergranular cracking. Quantified in the literature by serration amplitude/wavelength (FFT or curvature analysis of the boundary trace); no commercial tool measures it as of 2026.",
    probe: "serrated",
    source:
      "Koul & Gessinger, Acta Metall. 31 (1983) 1061 — mechanism of serrated grain boundary formation in Ni-base superalloys",
  },
  {
    id: "annealing-twins",
    name: "Annealing twins (Σ3 boundaries)",
    synonyms: [
      "grain boundary twinning",
      "twin boundaries",
      "sigma3 boundaries",
      "csl boundaries",
      "special boundaries",
    ],
    definition:
      "Coherent Σ3 twin boundaries formed by growth accidents during recrystallization and grain growth in low stacking-fault-energy FCC metals (austenitic stainless, brasses, Ni alloys).",
    producedBy:
      "Recrystallization/grain-growth anneals; density rises as stacking-fault energy falls. Iterative strain-anneal processing raises the special-boundary fraction deliberately (grain-boundary engineering).",
    effects:
      "High Σ3 (special-boundary) fraction breaks up the random-boundary network, improving resistance to intergranular corrosion, sensitization attack, and cracking; twin boundaries also strengthen by acting as slip barriers (Hall-Petch-like, nanotwin strengthening at fine spacing).",
    probe: "annealing twins",
    source:
      "Randle, Acta Mater. 52 (2004) 4067 — twinning-related grain boundary engineering",
  },
  {
    id: "deformation-twinning",
    name: "Deformation twinning",
    synonyms: ["mechanical twinning", "twip", "twinning induced plasticity"],
    definition:
      "Twinning as a plastic deformation mode, competing with slip. Favored by low stacking-fault energy (FCC), low temperature, high strain rate, and coarse grain; a primary secondary mode in HCP metals ({10-12} tensile twins in α-Ti).",
    producedBy:
      "Straining alloys whose composition puts stacking-fault energy in the twinning window (e.g. high-Mn TWIP steels ~20–30 mJ/m²); cryogenic or shock loading extends the window.",
    effects:
      "Twin boundaries accumulate during strain and refine the effective grain size ('dynamic Hall-Petch'), sustaining high strain-hardening rates and large uniform elongation; planar-slip/twinning alloys can trade off SCC and hydrogen response.",
    probe: "deformation twinning",
    mechanism: "strain-hardening",
    source:
      "Christian & Mahajan, Prog. Mater. Sci. 39 (1995) 1 — deformation twinning",
  },
  {
    id: "strain-hardening",
    name: "Strain (work) hardening",
    synonyms: ["work hardening", "cold work", "hollomon", "n-value", "flow curve"],
    definition:
      "Strengthening by dislocation accumulation during plastic strain, described empirically by Hollomon (σ = K·εⁿ), Ludwik, or Voce fits; the exponent n sets uniform elongation via the Considère criterion (necking at dσ/dε = σ).",
    producedBy:
      "Any cold work — temper rolling, drawing, forming. Capacity is highest in low-SFE austenitics and brasses (n ≈ 0.4–0.5) and in TRIP/TWIP alloys where transformation or twinning adds hardening.",
    effects:
      "Raises strength at the cost of ductility and stored residual stress (season-cracking and SCC relevance); high n means forgiving formability and blunt-notch tolerance. No commercial tool ships Hollomon/Voce fitting — practitioners fit in spreadsheets.",
    probe: "strain hardening",
    mechanism: "strain-hardening",
    source: "Dieter, Mechanical Metallurgy, 3rd ed., McGraw-Hill (1986), ch. 8",
  },
  {
    id: "precipitation-hardening",
    name: "Precipitation (age) hardening",
    synonyms: [
      "age hardening",
      "aging response",
      "gp zones",
      "orowan looping",
      "particle shearing",
      "overaging",
    ],
    definition:
      "Strengthening by a fine dispersion of second-phase particles from a supersaturated solid solution. Small coherent particles are sheared (Δσ ∝ √(f·r)); above a transition radius dislocations bow around them (Orowan, Δσ ∝ √f/λ).",
    producedBy:
      "Solution treat → quench → age (e.g. β″ in 6xxx Al, η′ in 7xxx Al, γ′/γ″ in Ni alloys, Cu in PH stainless). Peak strength sits at the shearing↔looping crossover; LSW coarsening (r³ ∝ t) drives overaging beyond it.",
    effects:
      "Largest single strengthening increment available in Al and Ni systems. Peak-aged states can trade SCC resistance (7xxx T6 vs overaged T73); grain-boundary precipitates and precipitate-free zones control intergranular failure paths.",
    probe: "precipitation",
    mechanism: "precipitation",
    source:
      "Gladman, Mater. Sci. Technol. 15 (1999) 30 — precipitation hardening in metals",
  },
  {
    id: "solid-solution-strengthening",
    name: "Solid-solution strengthening",
    synonyms: ["substitutional strengthening", "interstitial strengthening"],
    definition:
      "Strengthening by dissolved atoms whose size and modulus misfit pin dislocations (Fleischer/Labusch scaling); interstitials (C, N, O) are far more potent per wt% than substitutionals.",
    producedBy:
      "Alloying within solubility limits: N in austenitics and duplex, O in CP titanium, Mo/W/Nb in Ni alloys, Zn in brass.",
    effects:
      "Temperature-stable strengthening with no aging treatment needed; interstitial variants raise strength but can cost toughness (DBTT shift in ferritics) and weldability.",
    probe: "solid solution",
    mechanism: "solid-solution",
    source: "Courtney, Mechanical Behavior of Materials, 2nd ed. (2000), ch. 5",
  },
  {
    id: "grain-refinement",
    name: "Grain refinement (Hall-Petch)",
    synonyms: ["hall-petch", "grain size strengthening", "fine grain practice"],
    definition:
      "Yield strength rises with the inverse square root of grain size: σy = σ0 + k·d^-1/2, because boundaries block slip transmission.",
    producedBy:
      "Controlled rolling/normalizing, recrystallization control, pinning particles (AlN, Nb/Ti/V microalloying), rapid solidification; the only mechanism that raises strength AND toughness together.",
    effects:
      "Strength and impact toughness improve; creep resistance worsens (boundary sliding/diffusion paths multiply) — which is why creep alloys want COARSE or serrated-boundary grains.",
    probe: "grain refinement",
    mechanism: "grain-refinement",
    source:
      "Hall, Proc. Phys. Soc. B 64 (1951) 747; Petch, J. Iron Steel Inst. 174 (1953) 25",
  },
  {
    id: "transformation-strengthening",
    name: "Transformation (martensitic) strengthening",
    synonyms: ["martensite", "quench and temper", "trip"],
    definition:
      "Strengthening by displacive transformation: carbon-supersaturated martensite in steels combines interstitial pinning, high dislocation density, and fine lath/twin substructure; tempering trades strength for toughness through carbide precipitation.",
    producedBy:
      "Austenitize → quench past the nose → temper (Q&T steels); or strain-induced transformation of metastable austenite during service (TRIP, quantified by Md30).",
    effects:
      "Highest strengths available in steels; above ~38 HRC brings hydrogen-embrittlement and sulfide-SCC susceptibility (the ISO 15156 hardness caps exist because of this microstructure).",
    probe: "martensite",
    mechanism: "transformation",
    source: "Krauss, Steels: Processing, Structure, and Performance, 2nd ed., ASM (2015)",
  },
  {
    id: "gb-carbides-sensitization",
    name: "Grain-boundary carbides / sensitization",
    synonyms: ["cr23c6", "chromium depletion", "intergranular corrosion", "weld decay"],
    definition:
      "Cr₂₃C₆ precipitation on austenite grain boundaries (≈500–800 °C exposure) depletes adjacent chromium below passivity, opening an intergranular corrosion and IGSCC path.",
    producedBy:
      "Weld HAZ thermal cycles, slow cooling, or service in the sensitization window; suppressed by low-C grades (304L/316L), stabilization (Ti/Nb), or solution annealing.",
    effects:
      "Degrading feature: intergranular attack and cracking in oxidizing acids and chloride service. High annealing-twin (Σ3) fractions interrupt the susceptible boundary network — the grain-boundary-engineering countermeasure.",
    probe: "sensitized",
    source: "ASM Specialty Handbook: Stainless Steels, ASM International (1994)",
  },
];
