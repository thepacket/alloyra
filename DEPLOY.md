# Deploying to fly.io

Alloyra deploys as ONE Fly app, so visitors install nothing and no
compute runs server-side:

1. **`alloyra`** — the workbench: the Next static export (`apps/web/out/`,
   ~1.5 MB) served by nginx. No secrets, no volumes, no database; user
   state lives in the browser, and all CALPHAD computation runs in the
   visitor's tab (web worker). `shared-cpu-1x`, 256 MB, suspended when
   idle.

The former **`alloyra-calphad`** hosted calculation service is RETIRED
(scaled to zero machines) — an always-on public compute endpoint was an
abuse/cost risk with no remaining product role once the in-browser engine
was cross-checked (`docs/engine-validation.md`). Its code stays in
`services/calphad` as the offline validation oracle and can be self-hosted
from `services/calphad/fly.toml` by anyone who wants a live pycalphad
second opinion.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Two stages: `node:22-alpine` runs `pnpm install && pnpm --filter @alloyra/web build`, `nginx:1.27-alpine` serves `apps/web/out/` |
| `deploy/nginx.conf` | gzip, immutable caching for `/_next/static/`, directory-route resolution, `/healthz` |
| `deploy/security-headers.conf` | CSP and the other response headers, included per-location |
| `fly.toml` | App name, region, machine size, health check |
| `.dockerignore` | Keeps `node_modules`, exports, `.git`, `services/` and `*.md` out of the build context |

## First deploy

```bash
fly launch --no-deploy
```

Answer no when it offers to overwrite `fly.toml`. It will rename the app if
`alloyra` is taken, and it may change `primary_region` — the config here
defaults to `yyz` (Toronto).

Then:

```bash
fly deploy
```

Deployed at **[alloyra.fly.dev](https://alloyra.fly.dev/)** (single machine,
`--ha=false`).

## Redeploying

```bash
fly deploy --ha=false --strategy bluegreen                 # workbench
```

Blue-green keeps workbench updates zero-downtime on a single machine: Fly boots one
extra machine on the new version, waits for its `/healthz` check, switches
traffic, and destroys the old one — the second machine exists only for the
seconds the deploy takes. Plain `fly deploy --ha=false` (rolling) also
works; it restarts the one machine, a gap of a few seconds during which
Fly's proxy holds most requests rather than failing them.

## What the configuration assumes

- **All state is in the browser.** Duty profiles, comparisons, studio
  sessions, and rule overlays live in `localStorage` on the deployed origin.
  Machines can suspend, restart, or move regions with zero data impact —
  which is exactly why `auto_stop_machines = 'suspend'` and
  `min_machines_running = 0` are safe.
- **The calculation service is hosted.** The CSP's `connect-src` allows
  nothing — `connect-src 'self'` only: the engine's TDB downloads are
  same-origin and no external service is called.
- **CSP allows `'unsafe-inline'`** for scripts and styles: Next's static
  export bootstraps with inline scripts, and React inline style attributes
  drive the score/phase bars. Tightening to hashes is possible but not worth
  it until the export stops using inline bootstrap scripts.

## Local smoke test

```bash
docker build -t alloyra . && docker run --rm -p 8080:80 alloyra
# then open http://localhost:8080/database/
```
