# Alloyra Design v2

Date: 2026-08-28. Follows the competitive analysis
(`docs/competitive-analysis.md`) and expert field feedback. Supersedes the
Blueprint where they conflict; § references still point at the Blueprint.

## 1. Verdict on the v1 design

Judged against the owner's ground rules (client-side first; webapp not
website; colorful hi-tech; plots mandatory; **professional-grade data only —
no demo databases or datasets, added 2026-08-28**) and the competitive
field:

| v1 design decision | Verdict | Disposition |
|---|---|---|
| Client-side everything, static export, ~1.5 MB | **Right** — zero-install is a moat no incumbent has | Keep |
| Hosted pycalphad as the only CALPHAD path | **Wrong** under the client-side rule — browser CALPHAD is proven feasible | Redo: B-501 TS/WASM engine; service demoted to oracle/fallback |
| Fixed-viewport instrument shell (§ 8.1, U-1…U-6) | **Right** — this is the webapp-not-website requirement | Keep |
| Steel-grey near-monochrome theme | **Wrong** against "colorful, hi-tech" — reads muted, not instrumented | Redo: theme v2 (E7) |
| Numbers-first UI, two ad-hoc visuals, no chart layer | **Wrong** — the field's shared grammar is charts; "values from we don't know where" | Redo: plot kit + charts everywhere (E2) |
| `PropertyId` closed union of 5 scalar RT properties | **Wrong** — cannot hold curves, temperature dependence, fatigue/creep/toughness | Redo: property model v2 (B-301) |
| No microstructure representation at all | **Wrong** — the expert's core critique; blocks the open-niche features | Redo: microstructure layer (E1) |
| Provenance discipline, missingness honesty, failure-rule engine | **Right** — differentiators confirmed by the analysis | Keep; extend to new layers |
| localStorage-only user state | Right for research preview | Keep (export/import already exists) |

Net: the *architecture* is right, the *shell* is right, the *epistemics*
are right. What is wrong is the **data model's expressiveness** and the
**visual layer** — both are redone below.

## 2. Data model v2

### 2.1 Property records (replaces the 5-value union)

- `PropertyId` becomes an open, unit-typed vocabulary (mechanical, elastic,
  physical, thermal, electrical, fatigue, creep, toughness). Each id
  declares unit, axis semantics, and better-is direction for charts.
- A record's `value` generalizes from scalar to
  `scalar | interval | curve`. Curves carry typed axes (vs temperature,
  strain, cycles, LMP) and mandatory test-condition metadata
  (temperature, strain rate, R-ratio, orientation, environment).
  Provenance and citation stay mandatory per record.
- Spec-permitted intervals (existing `specRange`) become just another
  interval-valued record with `provenance: "computed"`.

### 2.2 Microstructure layer (new, Epic E1)

Per alloy+condition, structured descriptors — every one cited:

- `matrix`: phase(s) + crystal structure (e.g. austenite/FCC, tempered
  martensite/BCT→BCC).
- `constituents[]`: secondary phases/precipitates — type, role
  (`hardening | embrittling | inert | grain-refining`), coherency class,
  typical fraction/size class where citable.
- `grainBoundaries`: character notes — carbide decoration, serration
  (`none | possible-by-heat-treatment | characteristic`), films.
- `twinning`: annealing-twin density class (tied to stacking-fault
  energy), deformation-twinning propensity (TWIP window), Σ3 relevance.
- `strengthening`: the mechanism vector —
  `solid-solution | strain-hardening | precipitation | grain-refinement |
  transformation | dispersion | order` — each `dominant | active | none`,
  with per-mechanism notes (e.g. Hollomon n-range for strain hardening,
  aging peak for precipitation).
- `texture`: anisotropy class where relevant (rolled plate, extrusions).

All fields optional-with-honesty: absent = undocumented, never "none".
The vocabulary (with synonyms: "age hardening" = "precipitation
hardening", "GB serration" = "wavy grain boundaries") is versioned data,
searchable from the database facets and the ⌘K palette, and extensible
through the same overlay mechanism as failure rules.

### 2.3 Why this ordering

The microstructure layer is deliberately *descriptive before predictive*:
descriptors + mechanism tags make the expert's searches land immediately;
the quantitative models (Hall-Petch, KWN, Hollomon fits — B-105/B-506)
then attach numbers to descriptors that already exist, instead of
inventing a parallel structure.

## 3. Visual layer

- **Plot kit** (B-201): one in-house SVG chart system, theme-native, no
  external chart dependency (keeps the bundle small and the look
  instrument-grade). Primitives: scatter with family envelopes and brush
  regions, line/curve families with validity-window shading, interval
  bars, histograms, C-curves. Every mark carries provenance on hover.
- **Rule: no naked numbers.** Any displayed value must either sit on a
  plot or carry an inline micro-visualization (interval bar, sweep
  sparkline) showing where it lives and where it came from.
- **Theme v2** (B-701): keep the dark instrument base; add a saturated
  family-color system (Fe/Al/Ti/Ni/Cu each own a hue used consistently in
  chips, rows, chart marks), intensified status colors, and a hi-tech
  finish (glow accents on active data surfaces, gridline glass panels).
  Contrast discipline from v1 reviews is retained.

## 4. Client-side CALPHAD

Per §5 of the competitive analysis: scoped TS/WASM engine (TDB parser →
CEF sublattice Gibbs → convex-hull-seeded minimization), validated against
the hosted pycalphad service on identical TDBs. The service remains as
correctness oracle and fallback for databases beyond the engine's scope.
This satisfies the client-side rule without discarding fidelity.

## 5. Sequencing (dependency order, no time estimates)

1. Theme v2 + plot kit + charts over existing data (E7, B-201/202/206/703)
2. Microstructure descriptors + mechanism search over current 13 alloys (E1)
3. Property model v2 + dataset depth (B-301, B-305, curves → B-204)
4. Strengthening calculators + screening/selection upgrades (B-105, E4)
5. Client-side CALPHAD + transformation modeling (E5)
6. Platform features (E6)
