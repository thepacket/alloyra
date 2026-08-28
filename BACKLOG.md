# Alloyra Backlog

Feature backlog for Alloyra. Items carry no time estimates by policy. Ordering
within an epic is dependency order, not priority. IDs are stable (`B-###`);
strike items rather than renumbering.

Sources:

- **[EXPERT]** — field feedback from a practicing PhD metallurgist, 2026-08-28.
- **[COMP]** — gap extracted from the competitive analysis
  (`docs/competitive-analysis.md`).

Status notes (2026-08-28, dataset 2026.08.2): first slices shipped for
**B-101/B-102/B-103/B-104** (microstructure descriptors + mechanism tags on
all 14 conditions, concept vocabulary with 9 cited cards, database search +
⌘K entries), **B-201/B-202** (SVG plot kit; property chart with derived
σy/ρ axis and screened-out grey-out), **B-206** (calculator sweep
sparklines), **B-701/B-702/B-703 partial** (family color system, spectral
titlebar, home property-space chart). Ground rule 4 enforcement same day
(dataset 2026.08.3): dataset 13 → 27 grades (B-305), placeholder element
prices deleted — the price table now ships empty and user-owned. Remaining
scope of those items stays open below.

Architecture ground rules for every item (owner-stated, 2026-08-28):

1. **Client-side first.** Everything runs in the visitor's browser unless
   proven technically impossible. Memory appetite is not a veto — do not
   restrict a design because it seems memory-hungry.
2. **Instrument, not website.** Fixed-viewport workbench, dense, colorful,
   hi-tech. No marketing chrome.
3. **Plots are a must.** Every number the app shows should be able to appear
   on a chart with axes, provenance, and its position relative to peers —
   never a bare value "from we don't know where".
4. **Professional-grade data only (added 2026-08-28).** Alloyra is a serious
   tool for professionals, not a demo: no demo/teaching databases, no
   placeholder or invented values anywhere in the product. Every shipped
   value is spec-cited or clearly flagged literature-typical; anything the
   product cannot source honestly ships empty with an explicit "enter your
   own" state instead of a fabricated default.

---

## Epic E1 — Microstructure data layer & feature search [EXPERT]

The reviewing metallurgist's core critique: *"I looked for a way to search for
microstructural features but didn't see one. I would go hunting for serrated
grain boundary morphology. Strain hardening, precipitation hardening, things
like that. Grain boundary twinning."* Today microstructure exists only as
free-text notes; there is no data field, no vocabulary, no search.

- **B-101 — Microstructure descriptor schema.** Extend the alloy/condition
  data model with structured, citable microstructural descriptors:
  matrix phase(s) and crystal structure; secondary phases/constituents
  (carbides, sigma, delta ferrite, retained austenite…) with typical fraction
  ranges; grain size (ASTM E112 G and/or µm, with condition dependence);
  grain boundary character (incl. **serrated/wavy GB morphology**, carbide
  decoration, GB films); twinning (annealing twins / Σ3 fraction class,
  deformation twinning propensity, TWIP behavior); precipitate populations
  (type, coherency, typical size/spacing class, hardening vs embrittling);
  texture/anisotropy class. Every descriptor carries provenance + citation
  like every other Alloyra value.
- **B-102 — Dominant strengthening-mechanism tagging.** Tag each
  alloy+condition with its operative strengthening mechanisms
  (solid solution, **strain/work hardening**, **precipitation/age hardening**,
  grain refinement, transformation/martensitic, dispersion, order
  strengthening) with the dominant one marked. This is what lets an expert
  "go hunting" by mechanism.
- **B-103 — Microstructural feature search.** Query surface (database
  filters + ⌘K palette) over B-101/B-102 vocabulary: e.g.
  "serrated grain boundaries" → alloys/conditions where GB serration is
  documented (waspaloy-type superalloy heat treatments), "grain boundary
  twinning" → high-SFE/low-SFE classification and annealing-twin-rich
  austenitics/Ni alloys, "precipitation hardening" → PH grades across
  families. Faceted filtering combinable with property and duty filters.
- **B-104 — Controlled microstructure vocabulary.** The searchable taxonomy
  behind B-103 (synonyms: "GB serration" = "wavy grain boundaries";
  "age hardening" = "precipitation hardening"), versioned like the ruleset,
  extensible through the same local-overlay mechanism as failure rules.
- **B-105 — Strengthening-mechanism calculators.** Quantitative models
  alongside the existing empirical calculators, each with validity windows
  and missingness propagation like PREN/Ms today:
  Hall-Petch (σy vs d^-1/2, tabulated k_y per family); Hollomon / Ludwik /
  Voce **strain-hardening** fits (n, K) where flow-curve data exists, with
  Considère uniform-elongation implication; precipitation strengthening
  (shearing vs Orowan looping regimes, strength vs particle size/spacing);
  solid-solution strengthening (Labusch-type per-element coefficients);
  superposition rule with stated caveats.
- **B-106 — Microstructure ↔ failure-rule integration.** Failure rules gain
  clauses over microstructural descriptors (e.g. sensitization rule keyed to
  GB carbide descriptor, not just family string-match; creep rules aware of
  serrated-GB heat treatments; SCC rules aware of deformation-twinning /
  planar-slip classes).
- **B-107 — Grain-size input in the studio.** Grain size becomes a first-class
  studio input: restores the omitted Md30 grain-size term, feeds Hall-Petch,
  and appears on plots. (Removes the standing `md30.ts` limitation.)

## Epic E2 — Visualization & plot layer [COMP] [OWNER]

Owner requirement: *"Plots are a must, not only values coming from we don't
know where."* Competitive finding: the category's visual grammar is property
charts, curve viewers, phase/property diagrams, and C-curves; Alloyra ships
two hand-rolled visuals and no charting layer.

- **B-201 — Plot kit.** A reusable client-side charting foundation (SVG/canvas,
  no server): scatter, line/curve families, log axes, bands/regions,
  histograms, hover inspection with provenance chips, brush selection,
  greyed-out context series, PNG/SVG export. Theme-native (dark, colorful,
  hi-tech), dense-instrument styling — not a stock chart look.
- **B-202 — Ashby property chart.** Interactive material-property chart in
  the database view: any property vs any property, log/linear, family
  envelopes ("bubbles"), derived-axis expressions (e.g. σy/ρ),
  drawable selection boxes and index lines; eliminated materials grey out
  in place (Granta Selector's grammar, browser-native).
- **B-203 — Staged screening + rationale report.** Chained screening stages
  (chart region + numeric limits + family tree) with progressive grey-out and
  an auto-generated report documenting why each candidate was eliminated —
  extends the existing hard-constraint elimination and audit transparency.
- **B-204 — Curve viewers.** Interactive viewers for curve-valued data with
  test-condition metadata (temperature, strain rate, R-ratio): stress-strain,
  S-N fatigue, creep/stress-rupture and LMP master curves. Depends on B-301.
- **B-205 — Comparison charts.** Score breakdowns and multi-candidate
  overlays as charts (per-criterion bars, candidate overlays on the Ashby
  chart, strength-vs-temperature overlays), replacing number-only tables as
  the primary comparison surface.
- **B-206 — Studio sweep plots.** Every studio calculator gains a sweep
  plot: value vs each contributing element across its slider range (with the
  current point marked and validity window shaded) — the direct answer to
  "values from we don't know where."
- **B-207 — WRC-1992 FN iso-lines.** Digitize the ferrite-number iso-lines
  so the existing WRC frame becomes a working constitution diagram
  (standing debt noted in `StudioView.tsx`).

## Epic E3 — Database depth & search [COMP]

- **B-301 — Property model v2.** Replace the closed 5-value `PropertyId`
  union with an extensible, unit-typed property vocabulary covering
  mechanical (incl. toughness, impact/DBTT, fatigue), elastic, physical,
  thermal, and electrical properties; support scalar, interval, and
  **curve-valued** records (value vs temperature/strain/cycles) with
  test-condition metadata and per-record provenance. This is the data-model
  redesign that everything in E1/E2 stands on.
- **B-302 — Cross-standard equivalence.** UNS ↔ EN ↔ DIN ↔ JIS ↔ GB ↔ GOST
  designation cross-referencing (table stakes in every database product),
  plus algorithmic similar-grade ranking by composition/property closeness
  (extends existing `nearestGrades`).
- **B-303 — Composition search.** Per-element min/max range search and a
  periodic-table include/exclude filter over the database.
- **B-304 — Condition-scoped search.** Find alloys *having* a given data
  kind under given conditions (e.g. "has S-N data at R = −1", "has creep
  data above 600 °C", "available as plate, welded condition").
- **B-305 — Dataset expansion.** Grow the dataset with the same citation
  discipline (ground rule 4); priority families driven by E1 searchability.
  *2026-08-28: expanded 13 → 27 grades (dataset 2026.08.3): PH/martensitic/
  ferritic/super-austenitic/6-Mo/super-duplex stainless, 718, C-276,
  Monel 400, 2024-T3, 5083-H116, Ti Gr 9, 90-10 CuNi, 4130.* Still open:
  TWIP/Hadfield (deformation-twinning exemplars), creep-resistant ferritics
  (9Cr/P91), maraging, cast alloys; per-family coverage floors.
- **B-306 — Cost & sustainability axes.** Indicative cost/kg and embodied
  CO2/energy as first-class, screenable, plottable properties (replacing the
  placeholder studio price table).

## Epic E4 — Selection methodology [COMP]

- **B-401 — Performance indices.** Function/constraint/objective picker
  deriving Ashby performance indices (beam stiffness at min mass → E^1/2/ρ),
  rendered as gradient lines on B-202 charts and usable as ranking criteria.
- **B-402 — Find-similar substitution.** One-click "find substitutes for
  this grade" ranked by property-profile closeness with per-property deltas.
- **B-403 — Ranking v2.** Grow past the fixed 3-criterion weighted mean:
  arbitrary criteria from the property vocabulary, explicit
  constraint-vs-objective separation (Pareto front view), transparent
  per-criterion normalization. (Absorbs the previously deferred
  "Pareto/constraint scoring separation" item.)
- **B-404 — Duty-to-requirement solver.** Translate duty-profile load cases
  into derived property requirements (design stress + factor → σy floor;
  cyclic duty → fatigue criterion) that auto-seed screening stages.

## Epic E5 — Phase & transformation modeling [COMP]

- **B-501 — Client-side CALPHAD engine.** Move equilibrium calculation into
  the browser per the owner's client-side-first rule. Feasibility proven
  (`docs/competitive-analysis.md` §5); chosen path: scoped TS/WASM engine —
  TDB parser, CEF sublattice Gibbs model (R-K-M excess + magnetic),
  convex-hull-seeded global minimization — validated point-by-point against
  the hosted pycalphad service, which is demoted to correctness oracle and
  fallback. (Pyodide-pycalphad documented as full-fidelity fallback path.)
- **B-502 — Property diagrams.** One-axis stepping: equilibrium phase
  fraction vs temperature for a fixed composition (the CALPHAD category's
  bread-and-butter plot), replacing today's single-point bars.
- **B-503 — Phase diagram sections.** Binary diagrams and isopleth sections
  through multicomponent systems, plotted with labeled phase regions.
- **B-504 — Scheil solidification.** Scheil-Gulliver fraction-solid curves,
  freezing range, and microsegregation profiles; flags hot-cracking-prone
  wide-freezing-range compositions for the failure engine.
- **B-505 — Steel transformation kinetics.** Empirical TTT/CCT C-curves,
  Jominy hardenability, and martensite-fraction (Koistinen-Marburger)
  models for steels — chartable, citation-backed, validity-windowed like
  existing calculators.
- **B-506 — Precipitation & aging kinetics.** KWN-class precipitation
  simulation producing aging curves (strength vs time at temperature),
  LSW coarsening / overaging prediction, and shearing→Orowan transition —
  quantitative backbone for the E1 precipitation-hardening features.
- **B-507 — Assessed thermodynamic database library.** Ground rule 4 applied
  to CALPHAD: replace the Al-Zn *teaching* database (`alzn_mey.tdb`) as the
  only baked-in TDB with a library of license-vetted, openly redistributable
  **published assessments** relevant to the dataset's families (Fe-Cr-Ni-Mo-
  N-C, Al-Mg-Si / Al-Zn-Mg-Cu, Ni, Ti systems), each carrying license text,
  citation, and sha256 in the service manifest and surfaced in the UI's
  database picker. Vetted candidate list: `services/calphad/databases/
  SOURCES.md`. User-supplied commercial TDBs remain first-class.

## Epic E6 — Workbench platform [COMP]

- **B-601 — Uncertainty propagation.** Sampling-based uncertainty on every
  calculator (composition ranges in → value distributions out, shown as
  bands on plots, never bare points). Thermo-Calc is the only incumbent
  with this; it composes naturally with Alloyra's interval discipline.
- **B-602 — Batch composition screening.** High-throughput sweep over a
  composition grid in the studio (workers, client-side) with criteria-based
  filtering of results — Pandat HTC's concept at browser scale.
- **B-603 — CAE export.** Export selected alloy+condition property sets as
  solver material cards (at minimum a documented JSON/CSV schema; solver
  formats as demand warrants).
- **B-604 — Scripting surface.** A typed in-browser scripting console over
  `@alloyra/core` (the incumbents all ship Python SDKs; Alloyra's analog is
  its TS core exposed in-app).

## Epic E7 — Instrument look & feel v2 [OWNER]

Owner requirement restated 2026-08-28: webapp not website, **colorful,
hi-tech**, plots everywhere. The fixed-viewport instrument shell (blueprint
§ 8.1) stays; the surface gets the color and density of a modern instrument.

- **B-701 — Theme v2.** Richer accent system over the steel-dark base:
  per-family color identities used consistently across chips, charts, and
  maps; status/provenance colors intensified; glow/depth treatment for
  active data surfaces. Colorful without abandoning legibility discipline.
- **B-702 — Data-dense home.** Replace the website-ish scrolling home with
  an instrument dashboard: live mini-charts of the dataset (family map,
  property-space thumbnail), recent work, coverage disclosure kept.
- **B-703 — Micro-visualization everywhere.** Sparklines/mini-plots inline
  in tables and detail panels (spec intervals drawn as interval bars, PREN
  ranges as bands) so no numeric value appears without a visual anchor.
