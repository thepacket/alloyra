# Alloyra is a pure client-side app: the build produces a static export and
# nginx serves it. No server component runs in production — the CALPHAD
# bridge (services/calphad) is a workstation-side companion and is
# deliberately NOT part of this image.

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Manifests first so the dependency layer caches across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @alloyra/web build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/apps/web/out /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
