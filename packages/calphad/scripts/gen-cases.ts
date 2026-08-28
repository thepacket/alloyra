/**
 * Engine-validation battery — case generator (B-501 promotion evidence).
 * Builds the cross-check case list from the DATASET's own mid-spec
 * compositions (max-only elements at half-max, balance absorbs), checks
 * coverage against the shipped TDBs, and writes crosscheck-cases.json for
 * both the pycalphad oracle and the TS-engine comparator.
 *
 * Run: node scripts/gen-cases.ts   (from packages/calphad)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alloys } from "../../data/src/index.ts";
import { midpointComposition } from "../../core/src/composition.ts";
import { parseTdb } from "../src/tdb.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TDB_DIR = join(here, "../../../apps/web/public/tdb");

interface Case {
  id: string;
  db: string;
  uns: string;
  name: string;
  wt: Record<string, number>;
  tempsC: number[];
}

function midWt(uns: string): Record<string, number> {
  const a = alloys.find((x) => x.uns === uns);
  if (!a) throw new Error(`unknown UNS ${uns}`);
  const bal = a.composition.find((r) => r.balance)?.element;
  if (!bal) throw new Error(`${uns}: no balance element`);
  const mid = midpointComposition(a.composition, { includeResidualsAtHalfMax: true });
  const wt: Record<string, number> = {};
  let sum = 0;
  for (const [el, val] of Object.entries(mid)) {
    if (typeof val === "number" && val > 0) {
      wt[el] = val;
      sum += val;
    }
  }
  wt[bal] = Number((100 - sum).toFixed(4));
  return wt;
}

const BATTERY: { db: string; unses: string[]; tempsC: number[] }[] = [
  {
    db: "mc_fe_v2.059.pycalphad",
    unses: ["S31603", "S30400", "S32205", "S32750", "S41000", "S17400"],
    tempsC: [500, 700, 900, 1100, 1300],
  },
  {
    db: "mc_ni_v2.034.pycalphad",
    unses: ["N06625", "N07718", "N10276"],
    tempsC: [650, 900, 1150],
  },
  {
    db: "mc_al_v2.032.pycalphad",
    unses: ["A96061", "A97075", "A95083"],
    tempsC: [200, 400, 550],
  },
];

/** Solder joints aren't dataset grades — two canonical compositions. */
const SOLDER_CASES: Case[] = [
  {
    id: "solder-sac305",
    db: "NIST-solder",
    uns: "-",
    name: "SAC305 (Sn-3.0Ag-0.5Cu)",
    wt: { Ag: 3.0, Cu: 0.5, Sn: 96.5 },
    tempsC: [120, 200],
  },
  {
    id: "solder-sn37pb",
    db: "NIST-solder",
    uns: "-",
    name: "Sn-37Pb eutectic",
    wt: { Pb: 37, Sn: 63 },
    tempsC: [120, 200],
  },
];

const cases: Case[] = [];
for (const group of BATTERY) {
  const tdb = parseTdb(readFileSync(join(TDB_DIR, `${group.db}.tdb`), "utf8"));
  for (const uns of group.unses) {
    const a = alloys.find((x) => x.uns === uns)!;
    const wt = midWt(uns);
    const missing = Object.keys(wt).filter((el) => !tdb.elements.includes(el.toUpperCase()));
    if (missing.length > 0) {
      console.log(`skip ${uns} on ${group.db}: uncovered ${missing.join(",")}`);
      continue;
    }
    cases.push({
      id: `${group.db.split("_")[0]}-${uns}`,
      db: group.db,
      uns,
      name: a.names[0] ?? uns,
      wt,
      tempsC: group.tempsC,
    });
  }
}
cases.push(...SOLDER_CASES);

const out = join(here, "crosscheck-cases.json");
writeFileSync(out, JSON.stringify(cases, null, 2));
console.log(
  `${cases.length} cases, ${cases.reduce((s, c) => s + c.tempsC.length, 0)} equilibria → ${out}`,
);
