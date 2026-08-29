/**
 * Engine speed benchmark — the fixed cases used while tuning the solver.
 * Run: node scripts/bench.ts [--opts '{"samplesPerPhase":2000}']
 * Prints per-case time, G, phase set, and total — compare against the
 * battery oracle for quality (crosscheck.ts remains the real gate).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTdb, pointEquilibrium, wtToMoleFractions } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TDB = (f: string) =>
  parseTdb(readFileSync(join(here, `../../../apps/web/public/tdb/${f}.tdb`), "utf8"));
const suspend = (n: string) => /^(GP_|CL_)|^BCC_DISL$/.test(n);

const extra = process.argv.includes("--opts")
  ? JSON.parse(process.argv[process.argv.indexOf("--opts") + 1]!)
  : {};

const dbs = {
  fe: TDB("mc_fe_v2.059.pycalphad"),
  ni: TDB("mc_ni_v2.034.pycalphad"),
  al: TDB("mc_al_v2.032.pycalphad"),
};

const CASES: { name: string; db: keyof typeof dbs; wt: Record<string, number>; tK: number }[] = [
  { name: "316L @ 773K (hard low-T)", db: "fe", wt: { C: 0.015, Mn: 1, Si: 0.375, Cr: 17, Ni: 12, Mo: 2.5, N: 0.05, Fe: 67.06 }, tK: 773.15 },
  { name: "316L @ 1173K", db: "fe", wt: { C: 0.015, Mn: 1, Si: 0.375, Cr: 17, Ni: 12, Mo: 2.5, N: 0.05, Fe: 67.06 }, tK: 1173.15 },
  { name: "2205 @ 773K", db: "fe", wt: { C: 0.015, Mn: 1, Si: 0.5, Cr: 22.5, Ni: 5.5, Mo: 3.25, N: 0.17, Fe: 67.065 }, tK: 773.15 },
  { name: "625 @ 923K", db: "ni", wt: { Cr: 21.5, Mo: 9, Nb: 3.65, Fe: 2.5, Ni: 63.35 }, tK: 923.15 },
  { name: "7075 @ 473K", db: "al", wt: { Zn: 5.6, Mg: 2.5, Cu: 1.6, Cr: 0.23, Si: 0.2, Fe: 0.25, Mn: 0.15, Ti: 0.1, Al: 89.37 }, tK: 473.15 },
];

let total = 0;
for (const c of CASES) {
  const x = wtToMoleFractions(c.wt);
  const t0 = performance.now();
  const r = pointEquilibrium(dbs[c.db], x, c.tK, { suspend, ...extra });
  const ms = performance.now() - t0;
  total += ms;
  console.log(
    `${c.name.padEnd(24)} ${ms.toFixed(0).padStart(6)} ms  G=${r.feasible ? r.gPerMoleAtom.toFixed(1) : "—"}  ` +
      `${r.samples.toLocaleString()} evals  ${r.phases.map((p) => `${p.phase}:${p.fraction.toFixed(3)}`).join(" ")}`,
  );
}
console.log(`TOTAL ${total.toFixed(0)} ms`);
