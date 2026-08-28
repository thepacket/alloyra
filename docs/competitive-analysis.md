# Alloyra Competitive Analysis

Date: 2026-08-28. Scope: software in real use by metallurgists and materials
researchers, surveyed to extract the feature set expected of an alloy-design
workbench and to locate Alloyra's gaps. Feeds `BACKLOG.md` Epic E2+.

Product categories surveyed:

1. **CALPHAD / property-prediction suites** — Thermo-Calc (+DICTRA,
   TC-PRISMA, Steel Models), JMatPro, Pandat (CompuTherm), FactSage, MatCalc.
2. **Materials selection & databases** — Ansys Granta Selector/MI,
   Total Materia, MatWeb, ASM Alloy Center, Materials Project, Citrine.
3. **Microstructure characterization & simulation** — MIPAR, Oxford
   AZtecCrystal, EDAX OIM Analysis, MTEX, DREAM.3D, MICRESS, ImageJ/Fiji,
   plus strengthening-decomposition tooling.

---

## 1. Where Alloyra stands today (v0.1.0-research-preview)

Selection advisor (13 alloys, 3-criterion weighted ranking), duty profiles,
failure-mode audit (15 draft rules), composition studio with 7 empirical
calculators (PREN, WRC-1992 frame, CE(IIW), Ms Andrews, Md30, LMP, spec
intervals), single-point CALPHAD equilibrium via hosted pycalphad.
Fully client-side except CALPHAD. Two hand-rolled visuals (WRC scatter
frame, phase-fraction bars); no charting layer. No microstructure data,
no strengthening models, no phase diagrams, no property curves.

## 2. CALPHAD / property-prediction suites

### What the category offers (superset across Thermo-Calc, JMatPro, Pandat, FactSage, MatCalc)

**Equilibrium & phase diagrams:** single-point multicomponent equilibrium with
metastable/suspended phases; one-axis property diagrams (phase fraction vs T);
binary/ternary mapping, isothermal sections, isopleths; liquidus projections;
generalized-axis diagrams (activity, chemical potential); Pourbaix and
predominance diagrams; material-to-material mixing (dissimilar joints).

**Solidification:** lever rule and Scheil-Gulliver (+back-diffusion, solute
trapping for AM); microsegregation profiles; freezing range, latent heat;
secondary dendrite arm spacing; hot-cracking susceptibility indices.

**Kinetics & transformation diagrams:** KWN/Langer-Schwartz precipitation
(nucleation/growth/coarsening, PSDs, heterogeneous nucleation sites);
TTT/TTP and CCT diagrams; pearlite/bainite/ferrite/martensite models;
Ms/Bs and martensite-fraction temperatures; critical temperatures
(A1/A3/Acem); Jominy/Grossmann hardenability; 1D multicomponent diffusion
(DICTRA-class: carburizing, homogenization, dissimilar-joint interdiffusion).

**Microstructure state:** grain growth with Zener pinning; static/dynamic
recrystallization; dislocation density evolution; hot-rolling grain-size
evolution; flow-stress simulation from microstructure state (MatCalc,
PanEvolution).

**Property prediction:** yield/tensile strength decomposed into solid-solution
+ precipitation (Orowan vs shearing) + Hall-Petch + dislocation terms
(Thermo-Calc Yield Strength model, MatCalc, PanEvolution); hardness incl.
tempering; age-hardening curves; flow stress vs T and strain rate; creep and
rupture life; elastic constants; density, CTE, specific heat, thermal
conductivity, electrical resistivity vs temperature — all per-phase and
whole-alloy.

**Workflow:** Python SDKs everywhere (TC-Python, PanPython, JMatPro API);
high-throughput/batch calculation over composition grids with criteria-based
mining (Pandat HTC); uncertainty propagation by Gaussian sampling of inputs
(Thermo-Calc Property Model Calculator); composition optimization against
property objectives (JMatPro MPO, FactOptimal); user-written property models.

### Category verdicts relevant to Alloyra

- **None of the five runs in a browser.** All are licensed desktop software.
  A client-side workbench does not compete on database depth, but it wins on
  zero-install access — exactly Alloyra's deployment thesis.
- The table-stakes *visual* vocabulary of the category: property diagrams
  (fraction vs T), phase-diagram sections, Scheil curves, C-curves (TTT/CCT),
  age-hardening curves, strength-vs-temperature plots, PSD histograms.
  An alloy tool without these plots reads as a toy to this audience.
- The strength-decomposition model (σy = σ0 + Δσss + Δσppt + k·d^-1/2 + Δσdisl)
  is a commercial mainstream feature (three of five suites), directly matching
  the expert reviewer's "strain hardening, precipitation hardening" ask.
- No suite offers a failure-mode auditing workflow — Alloyra's differentiator
  survives contact with the incumbents.

## 3. Microstructure characterization & simulation tools

### What the category offers (superset across MIPAR, AZtecCrystal, OIM Analysis, MTEX, DREAM.3D, MICRESS, ImageJ)

**Features quantified:** grain size/distribution per ASTM E112 (twins
excludable); grain shape; orientation maps (IPF coloring); misorientation
angle/axis distributions; CSL/Σ boundary classification (Σ3 twins, Σ9, Σ27)
with boundary-length fractions; grain boundary character distribution;
annealing vs deformation twin statistics; parent-grain reconstruction
(KS/NW orientation relationships); phase fractions; precipitate size/spacing/
number density/volume fraction (incl. multimodal γ′); porosity, cracks,
inclusions; KAM/GROD/GOS local-strain maps; GND density; pole figures and
full ODF texture analysis.

**Analysis & workflow:** ML constituent classification and trainable
segmentation (MIPAR Spotlight, AZtec Classification Tool); interactive
linked plot↔map queries (OIM); grain-list filtering by any measured property
(AZtec, MTEX scripting); batch dataset processing; synthetic 3D
microstructure generation (DREAM.3D); phase-field evolution simulation with
CALPHAD coupling (MICRESS).

### Category verdicts relevant to Alloyra

- **Every serious tool is desktop-bound** (the only browser-native offering
  found is the nascent MECS WebApp). The browser niche is open.
- **No tool in any category lets a user *search a materials database by
  microstructural descriptor*** — the exact thing the expert reviewer went
  hunting for. MTEX comes closest and requires writing MATLAB code against
  one dataset at a time.
- **Two capabilities have no commercial home at all:** quantified serrated
  grain-boundary morphology (literature-only: FFT amplitude/wavelength,
  curvature methods) and Hollomon/Ludwik/Voce strain-hardening fitting with
  Considère analysis (done ad hoc in Excel/Python by everyone).
- The expert's four asks map to well-defined, chartable quantities:
  - *Serrated GB morphology* — serration amplitude/wavelength; produced by
    slow cooling through the γ′ solvus in Ni superalloys; improves creep
    rupture and intergranular cracking resistance.
  - *Strain hardening* — n, K (Hollomon/Ludwik), Voce saturation stress;
    uniform elongation via Considère; correlates with SFE/twinning class.
  - *Precipitation hardening* — precipitate phase, radius, spacing, fraction;
    shearing (∝√(f·r)) vs Orowan (∝√f/λ) with a transition radius; LSW
    coarsening (r³ ∝ t) predicting overaging.
  - *Grain boundary twinning* — Σ3 length fraction, twin density/thickness,
    annealing vs deformation twins; grain-boundary-engineering metric for
    corrosion/cracking resistance; nanotwin strengthening.

## 4. Materials selection & database platforms

### What the category offers (superset across Granta Selector/MI, Total Materia, MatWeb, ASM Alloy Center, Materials Project, Citrine)

**Search & filtering:** designation/trade-name/standard-number search;
cross-standard equivalence tables (UNS/EN/DIN/JIS/GB/GOST, 80+ SDOs) with
algorithmic "similar material" ranking; composition search with per-element
ranges; unlimited multi-property range filtering; periodic-table
include/exclude widgets; condition-scoped dataset search ("materials having
an S-N curve at temperature X, R-ratio Y"); Boolean full-text search.

**Selection methodology (Granta Selector = the Ashby reference
implementation):** interactive property charts with family envelopes;
derived-property axes (E^1/2/ρ); selection boxes/lines drawn on charts;
performance-index gradient lines derived from function/constraint/objective;
chained multi-stage screening (chart + limit + tree) with progressive
grey-out of rejected materials; find-similar substitution analysis;
engineering solver turning load cases into property requirements; eco audit
(embodied energy/CO2) and cost as screenable axes; auto-generated
selection-rationale reports.

**Data coverage (Total Materia = depth benchmark):** ~570,000 materials;
full stress-strain curves by temperature/strain rate/condition; S-N and E-N
fatigue with R-ratio metadata; creep/stress-rupture; fracture toughness at
temperature; formability; temperature-dependent property curves;
heat-treatment condition variants; weld-consumable compatibility; corrosion
tables by medium/concentration/temperature; statistical design allowables
(MMPDS A-/B-basis); compliance data.

**Visualization:** interactive scatter/bubble charts with zoom and family
coloring; interactive curve viewers; comparison overlays; rejected-material
grey-out preserved for context; 3D/ternary phase diagram apps (Materials
Project); Pourbaix apps.

**Workflow:** side-by-side comparison with difference highlighting vs a
reference; favorites/material lists; CAE material-card export (25+ solver
formats); REST APIs and Python clients; data versioning + approval
traceability (Granta MI); ML property prediction for gap-filling; sequential
learning for experiment design (Citrine).

### Category verdicts relevant to Alloyra

- **Ashby charts with drawn selection regions are the expected grammar of
  materials selection.** Alloyra ranks by three weighted criteria with no
  chart; to this audience, selection *is* a chart operation. Desktop-only
  Granta leaves the browser implementation open.
- **Cross-standard designation equivalence is table stakes** in every
  database product and absent in Alloyra.
- Condition-aware curve data (stress-strain, S-N, creep) is what separates a
  "database" from a "datasheet pile" — and is precisely the "values coming
  from we don't know where" complaint inverted: curves with test-condition
  metadata are the provenance-rich presentation.
- Granta's staged-screening *report* (documenting why each material was
  eliminated) matches Alloyra's transparency ethos and its existing
  hard-constraint elimination — extend, don't replace.
- No product audits failure modes. The moat holds across all three
  categories.

## 5. Client-side CALPHAD feasibility

Owner rule: client-side unless proven technically impossible. **Verdict:
not impossible — two independently proven paths exist.**

- **Path A — Pyodide + pycalphad.** pycalphad imported and ran under
  Pyodide in 2022: pycalphad PR #408 (merged, by lead developer Richard
  Otis) added WASM compatibility fixes incl. a symengine lambda-backend
  fallback for no-LLVM environments; the `materialsgenomefoundation/
  mgf-dist-pyodide` repo holds working build recipes for the gmp/symengine/
  pycalphad wheel chain. Blockers today: symengine is not in official
  Pyodide, recipes are ~4 years stale, wheels must be rebuilt per Pyodide
  release. Costs: ~60–120 MB first-load payload, ~3–10× slowdown (no
  symengine JIT under WASM → ~0.5–10 s per equilibrium point), permanent
  wheel-maintenance tax.
- **Path B — scoped native TS (or Rust→WASM) engine.** Proven pattern:
  `web-calphad` (actively developed, last push 2026-08-22) parses
  user-supplied .tdb files locally and computes Gibbs curves, common
  tangents, and isotherm sections entirely in-browser (Rust/WASM; binary
  systems). Components for Alloyra's scope: TDB parser (line-oriented DSL,
  ~1–2k lines; pycalphad's pyparsing grammar is the reference), CEF/
  sublattice Gibbs model (ideal + Redlich-Kister-Muggianu excess +
  Inden-Hillert-Jarl magnetic), global minimization via constitution-space
  sampling + lower convex hull + constrained refinement (the pycalphad/
  OpenCalphad algorithm, published). Millisecond evaluation, tens-of-KB
  bundle. The hard 20% is the global minimizer (miscibility gaps,
  vanishing phases). `Calphad.jl` (by a pycalphad core dev) shows the
  reimplementation shape.
- **Rejected: Fortran→WASM port of OpenCalphad** — no existing port,
  research-grade toolchain risk.

**Recommendation adopted:** build Path B, validated point-by-point against
the existing hosted pycalphad service on the same TDBs — the service is
demoted from product dependency to correctness oracle and offline fallback.
Path A remains documented as the full-fidelity fallback.

## 6. Gap matrix and extracted feature set

Legend: ✓ has it · ◐ partial · ✗ absent. "Alloyra" = v0.1.0.

| Capability (category expectation) | Incumbent exemplar | Alloyra |
|---|---|---|
| Property diagrams (phase fraction vs T) | all CALPHAD suites | ✗ (single point only) |
| Phase diagram sections / isopleths | Thermo-Calc, Pandat | ✗ |
| Scheil solidification | all CALPHAD suites | ✗ |
| TTT/CCT, hardenability | Thermo-Calc Steel Models, JMatPro | ✗ |
| Precipitation kinetics / aging curves | TC-PRISMA, PanPrecipitation, MatCalc | ✗ |
| Yield-strength decomposition (ss+ppt+Hall-Petch+disl) | Thermo-Calc, MatCalc, Pandat | ✗ |
| Strain-hardening constitutive fits (Hollomon/Voce, Considère) | **no product** (ad hoc scripts) | ✗ → open niche |
| Microstructure descriptor **search** over a database | **no product** (MTEX scripting closest) | ✗ → open niche |
| Serrated-GB morphology quantification | **no product** (literature methods) | ✗ → open niche |
| Twin/CSL boundary statistics | AZtecCrystal, OIM, MTEX (per-dataset, desktop) | ✗ |
| Ashby charts + selection boxes/index lines | Granta Selector (desktop) | ✗ |
| Staged screening with rationale report | Granta Selector | ◐ (constraint elimination, no chart/report) |
| Cross-standard designation equivalence | Total Materia (80+ SDOs), ASM | ✗ |
| Composition range search | Total Materia, MatWeb, ASM | ✗ (family chips only) |
| Condition-aware curve data (S-N, creep, σ-ε) | Total Materia Extended Range | ✗ (RT spec-min scalars) |
| Find-similar substitution | Granta, Total Materia, ASM | ◐ (nearestGrades in studio) |
| Multi-criteria ranking | Total Materia Optimizer | ◐ (3 fixed criteria) |
| Uncertainty propagation | Thermo-Calc PMC only | ✗ |
| Batch/high-throughput composition screening | Pandat HTC | ✗ |
| Scripting/API surface | all suites (Python SDKs) | ✗ |
| Cost/eco as screening axes | Granta | ◐ (placeholder price table) |
| Failure-mode interaction auditing | **no product** | ✓ moat |
| Provenance discipline (measured/spec/computed) | Granta MI (enterprise only) | ✓ |
| Zero-install browser delivery | MECS WebApp (nascent) only | ✓ |
| Missingness honesty (unknown ≠ zero) | none | ✓ |

**Extracted feature set → `BACKLOG.md`:** Epic E1 (microstructure layer —
expert feedback), E2 (visualization/plot layer), E3 (database depth &
search), E4 (selection methodology), E5 (phase & transformation modeling,
incl. client-side CALPHAD per §5), E6 (workbench platform), E7 (instrument
look & feel v2).

**Positioning conclusion.** Alloyra's moat (failure-mode auditing,
provenance, missingness honesty, zero-install) is real — no incumbent
crosses it. Its exposure is that it currently lacks the *entire shared
visual and search vocabulary* of the field: property charts, curves,
phase/transformation diagrams, composition search, standards equivalence.
The expert reviewer's reaction ("I would go hunting for… didn't see one")
is the predictable response of any domain expert meeting a materials tool
without that vocabulary. The three open niches (microstructure-descriptor
search, strain-hardening fits, serration quantification) sit directly on
the reviewer's wishlist and are claimable browser-natively before any
incumbent moves.
