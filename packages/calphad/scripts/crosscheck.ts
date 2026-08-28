/**
 * Engine-validation comparator (B-501 promotion evidence). Runs every
 * battery equilibrium through the in-browser TS engine at its DEFAULT
 * budgets (exactly what a visitor's tab runs), compares against the
 * pycalphad oracle, and writes docs/engine-validation.md with the full
 * per-equilibrium table and honest summary statistics.
 *
 * Run (after gen-cases.ts and crosscheck_oracle.py):
 *   node scripts/crosscheck.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTdb, pointEquilibrium, wtToMoleFractions } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TDB_DIR = join(here, "../../../apps/web/public/tdb");
const AUX_PHASE_RE = /^(GP_|CL_)|^BCC_DISL$/;
const suspend = (name: string) => AUX_PHASE_RE.test(name);

interface Case {
  id: string;
  db: string;
  uns: string;
  name: string;
  wt: Record<string, number>;
  tempsC: number[];
}
interface OracleRow {
  id: string;
  tempC: number;
  phases: { phase: string; fraction: number }[];
  gm: number;
  /** Phases pycalphad could not instantiate for this component set —
   *  suspended on the TS side too so the comparison stays fair. */
  excluded?: string[];
  /** Oracle failed for this equilibrium — not comparable, listed as such. */
  error?: string;
}

const cases = JSON.parse(readFileSync(join(here, "crosscheck-cases.json"), "utf8")) as Case[];
const oracle = JSON.parse(readFileSync(join(here, "crosscheck-oracle.json"), "utf8")) as OracleRow[];
const oracleBy = new Map(oracle.map((r) => [`${r.id}@${r.tempC}`, r]));

const dbCache = new Map<string, ReturnType<typeof parseTdb>>();
const loadDb = (id: string) => {
  let db = dbCache.get(id);
  if (!db) {
    db = parseTdb(readFileSync(join(TDB_DIR, `${id}.tdb`), "utf8"));
    dbCache.set(id, db);
  }
  return db;
};

/** Merge duplicate phase instances and drop display-threshold slivers. */
const mergedSet = (phases: { phase: string; fraction: number }[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const p of phases) m.set(p.phase, (m.get(p.phase) ?? 0) + p.fraction);
  for (const [k, f] of m) if (f <= 0.005) m.delete(k);
  return m;
};

interface Row {
  id: string;
  name: string;
  db: string;
  tempC: number;
  setMatch: boolean;
  tsSet: string;
  pySet: string;
  maxDFrac: number;
  dG: number;
  ms: number;
}

const rows: Row[] = [];
const oracleFailures: { id: string; name: string; tempC: number; error: string }[] = [];
for (const c of cases) {
  const db = loadDb(c.db);
  const x = wtToMoleFractions(c.wt);
  for (const tempC of c.tempsC) {
    const ref = oracleBy.get(`${c.id}@${tempC}`);
    if (!ref) {
      console.log(`no oracle for ${c.id}@${tempC} — skipped`);
      continue;
    }
    if (ref.error) {
      oracleFailures.push({ id: c.id, name: c.name, tempC, error: ref.error });
      console.log(`${c.id} @ ${tempC}C: oracle failed (${ref.error.slice(0, 60)}…) — not comparable`);
      continue;
    }
    const excluded = new Set(ref.excluded ?? []);
    const t0 = Date.now();
    const r = pointEquilibrium(db, x, tempC + 273.15, {
      suspend: (name: string) => suspend(name) || excluded.has(name),
    });
    const ms = Date.now() - t0;
    const ts = mergedSet(r.feasible ? r.phases : []);
    const py = mergedSet(ref.phases);
    const names = new Set([...ts.keys(), ...py.keys()]);
    let maxD = 0;
    for (const n of names) maxD = Math.max(maxD, Math.abs((ts.get(n) ?? 0) - (py.get(n) ?? 0)));
    const setMatch = [...names].every((n) => ts.has(n) === py.has(n));
    const dG = r.feasible ? Math.abs(r.gPerMoleAtom - ref.gm) : Number.NaN;
    rows.push({
      id: c.id,
      name: c.name,
      db: c.db,
      tempC,
      setMatch,
      tsSet: [...ts.keys()].sort().join("+") || "(infeasible)",
      pySet: [...py.keys()].sort().join("+"),
      maxDFrac: maxD,
      dG,
      ms,
    });
    console.log(
      `${c.id} @ ${tempC}C: ${setMatch ? "SET OK " : "SET DIFF"} maxΔfrac ${(maxD * 100).toFixed(2)}% ΔG ${dG.toFixed(1)} J/mol-atom (${ms} ms)`,
    );
  }
}

const n = rows.length;
const matches = rows.filter((r) => r.setMatch).length;
const maxDFrac = Math.max(...rows.map((r) => r.maxDFrac));
const meanDFrac = rows.reduce((s, r) => s + r.maxDFrac, 0) / n;
const gs = rows.filter((r) => Number.isFinite(r.dG));
const maxDG = Math.max(...gs.map((r) => r.dG));
const meanDG = gs.reduce((s, r) => s + r.dG, 0) / gs.length;

const perDb = [...new Set(rows.map((r) => r.db))].map((db) => {
  const rs = rows.filter((r) => r.db === db);
  return {
    db,
    n: rs.length,
    match: rs.filter((r) => r.setMatch).length,
    maxD: Math.max(...rs.map((r) => r.maxDFrac)),
    maxG: Math.max(...rs.filter((r) => Number.isFinite(r.dG)).map((r) => r.dG)),
  };
});

const fmt = (v: number, d = 2) => v.toFixed(d);
const lines: string[] = [];
lines.push("# In-browser CALPHAD engine — validation against pycalphad");
lines.push("");
lines.push(`Generated ${new Date().toISOString()} · \`@alloyra/calphad\` at DEFAULT budgets (what a visitor's browser runs) vs pycalphad with the hosted service's exact semantics (same TDBs, same auxiliary-phase suspension, same wt%→mole conversion). Compositions are the DATASET's own mid-specs (max-only elements at half-max). Regenerate: \`node scripts/gen-cases.ts\` → \`crosscheck_oracle.py\` → \`node scripts/crosscheck.ts\` in \`packages/calphad\`.`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- **${n} equilibria** across ${cases.length} compositions and ${perDb.length} databases`);
lines.push(`- Phase-set agreement (phases > 0.5 %, duplicates merged): **${matches}/${n}**`);
lines.push(`- Max phase-fraction deviation: **${fmt(maxDFrac * 100)} %** (mean ${fmt(meanDFrac * 100)} %)`);
lines.push(`- Max |ΔG|: **${fmt(maxDG, 1)} J/mol-atom** (mean ${fmt(meanDG, 1)})`);
lines.push("");
lines.push("| database | equilibria | set match | max Δfraction | max \\|ΔG\\| (J/mol-atom) |");
lines.push("|---|---|---|---|---|");
for (const d of perDb) {
  lines.push(`| ${d.db} | ${d.n} | ${d.match}/${d.n} | ${fmt(d.maxD * 100)} % | ${fmt(d.maxG, 1)} |`);
}
lines.push("");
lines.push("## Every equilibrium");
lines.push("");
lines.push("| case | T (°C) | sets agree | TS engine set | pycalphad set | max Δfrac | \\|ΔG\\| | TS ms |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(
    `| ${r.name} | ${r.tempC} | ${r.setMatch ? "✓" : "**✗**"} | ${r.tsSet} | ${r.pySet} | ${fmt(r.maxDFrac * 100)} % | ${fmt(r.dG, 1)} | ${r.ms} |`,
  );
}
lines.push("");
// Repricing verdicts (scripts/reprice_disagreements.py, 2026-08-28):
// pycalphad equilibrium RESTRICTED to the engine's phase set, compared to
// its own free equilibrium. Negative Δ = the ENGINE found the deeper
// minimum. Update these after any battery regeneration that changes the
// disagreement list.
const VERDICTS: Record<string, string> = {
  "mc-S31603@700": "repriced: engine's set +9.4 J/mol-atom above pycalphad's — near-degenerate sliver (engine adds 1.2 % SIGMA).",
  "mc-S32205@500": "repriced: +24.0 J/mol-atom — engine trades CR3NI2SIN for FCC in a 5-phase 500 °C assemblage.",
  "mc-S17400@500": "repriced: +221.0 J/mol-atom — engine's worst genuine miss (5-phase 500 °C assemblage; missed FCC+G_PHASE+M23C6).",
  "mc-N07718@650": "repriced: −3.3 J/mol-atom — ENGINE DEEPER; degenerate BCC sliver.",
  "mc-N07718@900": "repriced: −916.3 J/mol-atom — ENGINE DEEPER: pycalphad's own pricing of the engine's DELTA+FCC state beats its free equilibrium; pycalphad solver miss on the GAMMA_DP system.",
  "mc-N07718@1150": "repriced: −1201.2 J/mol-atom — ENGINE DEEPER: pycalphad prices FCC-only at −91215.2 vs its equilibrium −90014.0. Single-phase γ at 1150 °C also matches 718's known solidus (~1260 °C).",
  "mc-N10276@650": "repriced: +5.4 J/mol-atom — degenerate (engine adds P_PHASE).",
};

const verdictLines = rows
  .filter((r) => !r.setMatch && VERDICTS[`${r.id}@${r.tempC}`])
  .map((r) => `- **${r.name} @ ${r.tempC} °C** — ${VERDICTS[`${r.id}@${r.tempC}`]}`);
if (verdictLines.length > 0) {
  lines.push("## Disagreements investigated (repricing verdicts)");
  lines.push("");
  lines.push(
    "Method: pycalphad equilibrium RESTRICTED to the engine's phase set at the same composition and temperature, compared with pycalphad's free equilibrium (`services/calphad/scripts/reprice_disagreements.py`). A negative Δ means the engine found a DEEPER minimum than the reference solver.",
  );
  lines.push("");
  lines.push(...verdictLines);
  lines.push("");
}

if (oracleFailures.length > 0) {
  lines.push("## Oracle failures (not comparable — pycalphad-side limitations, not engine results)");
  lines.push("");
  for (const f of oracleFailures) {
    lines.push(`- ${f.name} @ ${f.tempC} °C: ${f.error}`);
  }
  lines.push("");
}
lines.push("## Reading the numbers honestly");
lines.push("");
lines.push("- A set disagreement is not automatically an engine error: near-degenerate assemblages (two states within ~1 J/mol-atom) can legitimately tip either way between two minimizers. Every disagreement above is listed, not averaged away.");
lines.push("- The battery covers the dataset's mid-spec compositions on the four shipped databases. It says nothing about compositions far outside those windows, other databases, or properties the engine does not compute.");
lines.push("- The hosted pycalphad service remains the reference implementation; the cross-check line in the studio compares the two live on demand.");
lines.push("");

writeFileSync(join(here, "../../../docs/engine-validation.md"), lines.join("\n"));
console.log(`\n${matches}/${n} set matches · maxΔfrac ${fmt(maxDFrac * 100)}% · maxΔG ${fmt(maxDG, 1)} → docs/engine-validation.md`);
