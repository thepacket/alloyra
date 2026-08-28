import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alloyra/core", "@alloyra/data", "@alloyra/calphad"],
  /**
   * Static export: `pnpm build` emits apps/web/out/ — plain files any
   * static server can host (the deployment target is 1 CPU / 250 MB, so
   * no Node server runs in production). All compute is client-side; the
   * CALPHAD bridge is called directly from the browser (lib/calphad.ts)
   * and runs wherever the engineer runs it.
   */
  output: "export",
  /** Emit route/index.html so any dumb static server resolves /route/. */
  trailingSlash: true,
};

export default nextConfig;
