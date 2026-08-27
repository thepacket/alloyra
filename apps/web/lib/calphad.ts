import type {
  EquilibriumQuery,
  EquilibriumResult,
  ModelProvider,
  ProviderCapabilities,
} from "@alloyra/core";

/**
 * HTTP implementation of the ModelProvider equilibrium contract, talking
 * to services/calphad through the /api/calphad proxy. The UI consumes
 * ONLY the ModelProvider interface — swapping backends never touches it.
 */
export const calphadProvider: ModelProvider = {
  id: "pycalphad-bridge",

  async capabilities(): Promise<ProviderCapabilities> {
    try {
      const res = await fetch("/api/calphad/health");
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
    const res = await fetch("/api/calphad/equilibrium", {
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
        citation: `pycalphad equilibrium over ${body.database_file}`,
        note: "Cite the TDB's own publication in any report.",
      },
      note: body.note,
    };
  },
};
