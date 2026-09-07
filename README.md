# Alloyra

**Research preview** — live at [alloyra.fly.dev](https://alloyra.fly.dev/).

An alloy-design workbench for metallurgists. Captures the duty (application,
environment, loads), ranks candidate alloys, tunes composition off a base
metal, and audits candidates against interaction failure modes (SCC, hydrogen
embrittlement, creep, galvanic) that no single-property filter can catch.

Requirements: see the **Alloyra Blueprint** artifact (§ numbers referenced
throughout the code).

## Layout

- `packages/core` — pure TS domain library: composition handling, calculators
  (PREN, WRC-1992, CE(IIW), Andrews Ms, Larson-Miller), microstructure
  descriptor model + search (strengthening mechanisms, twinning,
  grain-boundary character), provenance types. Zero framework imports;
  validation cases in `test/`.
- `packages/data` — versioned seed dataset (spec-min values with citations)
  and the Postgres-first Drizzle schema (not yet wired; M0 reads seeds).
- `apps/web` — Next.js workbench UI. Fixed-viewport shell, ⌘K palette,
  dense grids, provenance chips, in-house SVG plot kit (property charts,
  calculator sweep sparklines) — blueprint § 8.1: an instrument, not a
  website.

Backlog: `BACKLOG.md`. Competitive analysis and design v2:
`docs/competitive-analysis.md`, `docs/design-v2.md`.
- `packages/calphad` — the in-browser CALPHAD engine (backlog B-501,
  **cross-checked**): TDB parser, compound-energy-formalism Gibbs
  energies, multicomponent tangent-plane equilibrium, temperature sweeps,
  Scheil solidification, and sampled isopleth maps — all in a web worker.
  Validated against pycalphad on a 52-equilibrium battery across all four
  shipped databases; see `docs/engine-validation.md`.
- `services/calphad` — Python pycalphad service. **Not deployed and not
  required by the product**: it serves as the offline validation oracle
  for the engine (`services/calphad/scripts/`) and as an optional
  self-host for anyone who wants a second opinion from pycalphad. Ships
  license-vetted assessed databases; see
  `services/calphad/databases/SOURCES.md`.

## Validation oracle (optional, local)

All phase computation in the product runs in the visitor's browser —
there is no calculation server. To regenerate the engine-validation
report against pycalphad locally:

```bash
cd services/calphad
uv venv .venv && uv pip install -p .venv/bin/python -e .
cd ../../packages/calphad
node scripts/gen-cases.ts
(cd ../../services/calphad && .venv/bin/python scripts/crosscheck_oracle.py \
  ../../packages/calphad/scripts/crosscheck-cases.json \
  ../../packages/calphad/scripts/crosscheck-oracle.json)
node scripts/crosscheck.ts   # writes docs/engine-validation.md
```

## Rule authoring

Seed rules ship in `@alloyra/data` and are never mutated. Experts edit
through a local overlay on the Failure rules page — edit/add/disable with
structural validation (citations required) — and every comparison records
the effective ruleset label (e.g. `2026.08.0+local(2)`). Overlays
export/import as JSON for sharing.

## Run

```bash
pnpm install
pnpm dev      # workbench at http://localhost:3000
pnpm test     # calculator validation cases
```

## Release boundary

Alloyra v0.1.0 is a **research preview**: appropriate for demonstration,
materials education, preliminary screening, and failure-rule development.
It is **not** appropriate for material qualification, procurement
specification, code-compliance decisions, or safety-critical design
approval. All 15 seed failure rules are drafts — excluded from audits by
default, and promotable only through a named, dated review record.
Outputs are screening guidance for expert judgment, never design approval.

## Deployment (fly.io)

One Fly app; visitors install nothing and no compute runs server-side:

- **`alloyra`** — the workbench. `pnpm build` emits `apps/web/out/`
  (~1.5 MB), served by nginx from a `shared-cpu-1x` / 256 MB machine
  that suspends when idle. No server-side code; all user state lives in
  the visitor's browser, and all CALPHAD computation runs in the
  visitor's tab. There is no hosted calculation endpoint to abuse or
  meter — the former `alloyra-calphad` bridge is retired (its code stays
  in `services/calphad` as the validation oracle / optional self-host).

```bash
fly deploy --ha=false --strategy bluegreen                    # workbench
```

Full details — files, assumptions, CSP configuration, local smoke
tests — are in [DEPLOY.md](DEPLOY.md).

## License and contributions

MIT — see [LICENSE](LICENSE). Pull requests are welcome; changes to the
failure-rule content get a careful review, so cite the standard or source
behind every value. Forking is welcome too.

## Data policy

Only redistributable values: standards' published minimums (`spec-min`) or
clearly flagged `estimated` typicals. Nothing from licensed databases.
Every value carries provenance and a citation; `computed` values always show
their formula and validity window.

## Study workflow and evidence coverage

The active study name, selected duty and shortlist follow the user between
workbench pages. Saving a duty selects it for the active study; the home
page links directly to screening and the seawater example. The Saved studies page creates, duplicates and switches independent studies.
Existing single-study browser data migrates without removing the legacy recovery keys.

Comparison performance is a weighted summary of available criteria.
Input coverage is reported separately and is **not** a confidence or
validation percentage. Partial results retain their shortlist order;
only candidates with complete requested criteria are automatically ranked.
PREN is limited to stainless-family candidates across screening, comparison
and studio. A single-temperature yield record contributes to the duty score
or stress elimination only when its test temperature matches the duty
temperature exactly. Other temperatures are evidence gaps; no tolerance,
interpolation or extrapolation is assumed. Rule flags remain independent.

Strengthening fit and particle inputs start empty. Older stored parameters
are preserved as unverified; entering or explicitly reviewing them enables
applicable calculations. Changing the base grade requires renewed review.
Matrix presets are labeled assumed until reviewed, and incompatible presets
block Orowan output. Composition and LMP scenario input origins are shown in
the studio and carried into portable bundles and readable reports.

### Condition screening, trade-offs and portable records

Screening operates on all 29 alloy conditions rather than 27 grades. Property
lookups, chart identities, rationale reports and comparison handoff preserve
the exact condition; a missing property never falls back to another condition.
The comparison includes reference-relative trade-offs and a sampled 0–2 weight
sensitivity plot. Incomplete evidence suppresses preferred-candidate claims.
Density controls, collapsible navigation, a keyboard-accessible evidence drawer,
and three studio sections make detailed work easier to read.

A versioned `alloyra-study` JSON bundle contains study inputs, reference snapshots,
rule overlays/history, score and screening snapshots, empirical outputs and
recorded worker requests/responses. Import validates before an atomic storage
write and creates a new study. A different reference snapshot remains available
for report/export, with live calculation panes disabled to avoid silently mixing
reference versions. Historical outputs are reviewed in Saved studies; live panes
recompute on demand. Each result snapshot carries its own inputs.

Worker runs retain outputs on completion/error/cancellation, with periodic
progress saves and the originating study ID. Browser termination can leave an
incomplete record. Runs include solver/worker and TDB SHA-256 fingerprints;
`apps/web/scripts/engine-manifest.mjs` refreshes them at build time. Validation
coverage matches the archived 2026-08-29 report by database, normalized composition
and exact temperature. Changed fingerprints suppress coverage. The baseline
fingerprint associates the repository implementation with the archived report;
it is not a new execution of the 52-case oracle battery. Do not refresh the
baseline after solver changes without reviewing/regenerating validation evidence.
The point battery does not establish trajectory or isopleth-boundary coverage.

### Measured material records and verification plans

Material records accept manually entered measurements or UTF-8 CSV (2 MB).
CSV columns are `heat_id,uns,condition_id,form,thickness_mm,source,kind,name,value,unit,test_temp_c`.
Each row is one chemistry value (`kind=chemistry`, element symbol, `unit=wt%`,
blank temperature) or test (`kind=test`, property ID, explicit temperature).
Supported tests: yield_strength and tensile_strength in MPa, elongation in %,
and density in g/cm³. Metadata repeats for each heat/condition. Quoted commas,
newlines, escaped quotes, CRLF and BOM are supported. Blank values, inequalities,
duplicate element/test points, inconsistent metadata and totals above 100% fail
validation before anything is saved. Thickness may be explicitly unknown.
Review the parsed record before saving; source labels are supplied by the user,
not authenticated certificates. Corrections create a new immutable record.

Comparison selects one record per reference condition. Measured chemistry and
tests replace the reference values for that candidate; missing values are not
borrowed from the specification. Yield chooses an exact duty-temperature test
when present. Measured PREN requires explicit Cr, Mo, N and W (zeros permitted);
missing terms suppress the index and its score. Content-based rules preserve
unknown elements, while predicates about specification limits retain the original
reference specification separately. The existing mid-spec Scheil comparison is
disabled for measured records: it must not infer missing chemistry or balance.

Verification actions derive from the active duty, shortlist, selected evidence
and active rules. They request relevant tests/inputs, flag out-of-range measured
chemistry, and identify mechanisms or draft assumptions needing review. Owners,
status and resolution evidence are stored as append-only updates. A resolved
item requires a note; changed underlying inputs reopen it for review. Checking
an action does not alter data, scores, rule review status or qualification.
Current plan snapshots, measured records and update history travel with the
study bundle and readable report. Prior result/plan snapshots retain the inputs
used when generated; visit the plan after changing inputs to refresh its snapshot.
