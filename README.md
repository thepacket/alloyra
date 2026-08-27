# Alloyra

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

## Run

```bash
pnpm install
pnpm dev      # workbench at http://localhost:3000
pnpm test     # calculator validation cases
```

## Data policy

Only redistributable values: standards' published minimums (`spec-min`) or
clearly flagged `estimated` typicals. Nothing from licensed databases.
Every value carries provenance and a citation; `computed` values always show
their formula and validity window.
