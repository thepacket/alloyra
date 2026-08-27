import type {
  EquilibriumQuery,
  EquilibriumResult,
  ModelProvider,
  ProviderCapabilities,
} from "@alloyra/core";

/**
 * HTTP implementation of the ModelProvider equilibrium contract. The
 * browser calls the bridge DIRECTLY — there is no server-side proxy, so
 * the deployed app stays pure static files and the bridge runs wherever
 * the engineer runs it (default: their own machine). Override with
 * NEXT_PUBLIC_CALPHAD_URL at build time for a shared bridge.
 * The UI consumes ONLY the ModelProvider interface — swapping backends
 * never touches it.
 */
const BRIDGE = process.env.NEXT_PUBLIC_CALPHAD_URL ?? "http://127.0.0.1:8791";

export const calphadProvider: ModelProvider = {
  id: "pycalphad-bridge",

  async capabilities(): Promise<ProviderCapabilities> {
    try {
      const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(5000) });
      const body = await res.json();
      if (!res.ok) {
        return { available: false, reason: body.detail ?? "service error", systems: [] };
      }
      const systems = (body.databases ?? []) as ProviderCapabilities["systems"];
      if (systems.length === 0) {
        return {
          available: false,
          reason:
            "Service is running but no thermodynamic databases are installed — drop .tdb files into services/calphad/databases and restart it.",
          systems: [],
        };
      }
      return { available: true, systems };
    } catch {
      return { available: false, reason: "request failed", systems: [] };
    }
  },

  async equilibrium(q: EquilibriumQuery): Promise<EquilibriumResult> {
    const res = await fetch(`${BRIDGE}/equilibrium`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        database_id: q.databaseId,
        composition_wt: q.compositionWt,
        temp_c: q.tempC,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.detail ?? body.error ?? `equilibrium failed (${res.status})`);
    }
    return {
      databaseId: body.database_id,
      databaseFile: body.database_file,
      tempC: body.temp_c,
      phases: body.phases,
      provenance: "computed",
      source: {
        citation: `pycalphad ${body.pycalphad_version ?? ""} · ${body.database_file} (sha256 ${String(body.database_sha256 ?? "").slice(0, 12)}…) · T=${body.temp_c} °C, P=${body.pressure_pa ?? 101325} Pa, N=1`,
        note: `Phases considered: ${(body.phases_considered ?? []).join(", ")}.`,
      },
      note: body.note,
    };
  },
};
