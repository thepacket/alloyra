# Deploying to fly.io

Alloyra has no server component in production. The Docker image is the Next
static export (`apps/web/out/`, ~1.5 MB) served by nginx, so a deployment is
static files behind Fly's TLS terminator — no secrets, no environment
variables, no volumes, no database. The machine spec matches the constraint
the app was architected for: `shared-cpu-1x`, 256 MB, suspended when idle.

The CALPHAD bridge (`services/calphad`) is **not** deployed. It runs on the
engineer's own workstation (pycalphad wants ~300–500 MB RSS, far beyond the
web host), and the browser calls it directly at `http://127.0.0.1:8791`.

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

Subsequent deploys are the same `fly deploy`. The app is reachable at
`https://<app>.fly.dev`.

## What the configuration assumes

- **All state is in the browser.** Duty profiles, comparisons, studio
  sessions, and rule overlays live in `localStorage` on the deployed origin.
  Machines can suspend, restart, or move regions with zero data impact —
  which is exactly why `auto_stop_machines = 'suspend'` and
  `min_machines_running = 0` are safe.
- **The CALPHAD bridge is per-engineer.** The CSP's `connect-src` allows
  `http://127.0.0.1:8791` / `http://localhost:8791` so the https page can
  reach a loopback bridge (browsers exempt loopback from mixed-content
  blocking; Safari can be stricter). To point at a shared remote bridge
  instead: give it TLS, add its origin to `connect-src` in
  `deploy/security-headers.conf`, set `NEXT_PUBLIC_CALPHAD_URL` at build
  time, and widen `CALPHAD_CORS_ORIGINS` on the bridge to the deployed
  origin.
- **CSP allows `'unsafe-inline'`** for scripts and styles: Next's static
  export bootstraps with inline scripts, and React inline style attributes
  drive the score/phase bars. Tightening to hashes is possible but not worth
  it until the export stops using inline bootstrap scripts.

## Local smoke test

```bash
docker build -t alloyra . && docker run --rm -p 8080:80 alloyra
# then open http://localhost:8080/database/
```
