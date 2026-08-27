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
  (PREN, WRC-1992, CE(IIW), Andrews Ms, Larson-Miller), provenance types.
  Zero framework imports; validation cases in `test/`.
- `packages/data` — versioned seed dataset (spec-min values with citations)
  and the Postgres-first Drizzle schema (not yet wired; M0 reads seeds).
- `apps/web` — Next.js workbench UI. Fixed-viewport shell, ⌘K palette,
  dense grids, provenance chips (blueprint § 8.1: an instrument, not a website).
- `services/calphad` — Python microservice wrapping pycalphad behind the
  `ModelProvider` seam (equilibrium phase fractions). Thermodynamic
  databases are user-supplied; see `services/calphad/databases/README.md`.

## CALPHAD bridge

```bash
cd services/calphad
uv venv .venv && uv pip install -p .venv/bin/python -e .
.venv/bin/uvicorn main:app --port 8791
```

The studio's phase-equilibrium panel finds it via `/api/calphad/*`
(override the address with `CALPHAD_URL`). Without the service or without
databases, the panel degrades to an honest offline/no-database state.

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

Production is static files only: `pnpm build` emits `apps/web/out/`
(~1.5 MB), which nginx serves from a single `shared-cpu-1x` / 256 MB
machine that suspends when idle — no server-side code, no secrets, no
database. All state lives in the visitor's browser; the CALPHAD bridge
runs on the engineer's workstation and is never deployed.

```bash
fly launch --no-deploy    # first time — answer no to overwriting fly.toml
fly deploy --ha=false --strategy bluegreen
```

Blue-green keeps redeploys zero-downtime on the single machine. Full
details — files, assumptions, CSP/bridge configuration, local smoke
test — are in [DEPLOY.md](DEPLOY.md).

## License and contributions

MIT — see [LICENSE](LICENSE). Pull requests are **not accepted** and are
closed automatically: the failure-rule content requires named expert
review that a PR workflow cannot provide. Forking is welcome.

## Data policy

Only redistributable values: standards' published minimums (`spec-min`) or
clearly flagged `estimated` typicals. Nothing from licensed databases.
Every value carries provenance and a citation; `computed` values always show
their formula and validity window.
