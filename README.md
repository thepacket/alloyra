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

MIT — see [LICENSE](LICENSE). Pull requests are **not accepted** and are
closed automatically: the failure-rule content requires named expert
review that a PR workflow cannot provide. Forking is welcome.

## Data policy

Only redistributable values: standards' published minimums (`spec-min`) or
clearly flagged `estimated` typicals. Nothing from licensed databases.
Every value carries provenance and a citation; `computed` values always show
their formula and validity window.
