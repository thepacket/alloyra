/**
 * In-browser CALPHAD engine catalog — shared by the studio's equilibrium
 * panel and the comparison view. These are the license-vetted TDBs shipped
 * at /tdb/ (hash-synced with the hosted service's copies by test).
 */
export const ENGINE_DBS = [
  "mc_fe_v2.059.pycalphad",
  "mc_ni_v2.034.pycalphad",
  "mc_al_v2.032.pycalphad",
  "NIST-solder",
];

/** Base-metal hint from a database id (mc_fe → FE). */
export function baseHint(id: string): string | undefined {
  const m = /(?:^|[_-])(fe|ni|al)(?:[_.-]|$)/i.exec(id);
  if (m) return m[1]!.toUpperCase();
  if (/solder/i.test(id)) return "SN";
  return undefined;
}

/** The shipped database whose base metal matches, if any. */
export function engineDbForBase(base: string): string | undefined {
  return ENGINE_DBS.find((id) => baseHint(id) === base.toUpperCase());
}

/**
 * Scheil start temperature (°C) with comfortable superheat for the base
 * metal — the coarse liquid descent makes the superheat range cheap, so
 * generous margins cost little and never clip a liquidus.
 */
export function scheilStartCFor(base: string): number {
  switch (base.toUpperCase()) {
    case "AL":
      return 800;
    case "SN":
      return 400;
    case "NI":
      return 1500;
    default:
      return 1600;
  }
}
