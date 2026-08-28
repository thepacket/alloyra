/**
 * wt% → mole-fraction conversion for the in-browser engine — mirrors the
 * hosted service's table (services/calphad/main.py) so both paths agree.
 * Standard atomic weights, CIAAW 2021 abridged.
 */
export const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  MG: 24.305, AL: 26.982, SI: 28.085, P: 30.974, S: 32.06,
  TI: 47.867, V: 50.942, CR: 51.996, MN: 54.938, FE: 55.845,
  CO: 58.933, NI: 58.693, CU: 63.546, ZN: 65.38, ZR: 91.224,
  NB: 92.906, MO: 95.95, SN: 118.71, TA: 180.95, W: 183.84,
  PB: 207.2, AG: 107.87, BI: 208.98, SB: 121.76, LA: 138.91,
  HF: 178.49, Y: 88.906, PD: 106.42,
};

/** Convert wt% to normalized mole fractions. Throws on unknown elements. */
export function wtToMoleFractions(wtPct: Record<string, number>): Record<string, number> {
  const moles: Record<string, number> = {};
  for (const [el, pct] of Object.entries(wtPct)) {
    const key = el.toUpperCase();
    const mass = ATOMIC_MASS[key];
    if (mass === undefined) throw new Error(`No atomic mass on file for element '${el}'.`);
    if (pct < 0) throw new Error(`Negative content for '${el}'.`);
    if (pct > 0) moles[key] = pct / mass;
  }
  const total = Object.values(moles).reduce((s, v) => s + v, 0);
  if (total <= 0) throw new Error("Empty composition.");
  const out: Record<string, number> = {};
  for (const [el, m] of Object.entries(moles)) out[el] = m / total;
  return out;
}
