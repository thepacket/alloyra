import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  binaryPointEquilibrium,
  buildPhaseModel,
  parseTdb,
  pointEquilibrium,
  wtToMoleFractions,
} from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const db = parseTdb(readFileSync(join(here, "fixtures/alzn_mey.tdb"), "utf8"));
const ref = JSON.parse(
  readFileSync(join(here, "fixtures/alzn-reference.json"), "utf8"),
) as {
  gm: { phase: string; yAl: number; T: number; GM: number }[];
  equilibria: {
    T: number;
    xZn: number;
    phases: { phase: string; fraction: number; xZn: number }[];
  }[];
};

describe("TDB parsing (Al-Zn, an Mey 1993)", () => {
  it("reads elements, phases, and parameters", () => {
    expect(db.elements).toContain("AL");
    expect(db.elements).toContain("ZN");
    expect([...db.phases.keys()].sort()).toEqual(["FCC_A1", "HCP_A3", "LIQUID"]);
    expect(db.parameters.length).toBe(12);
    expect(db.skipped).toEqual([]);
  });

  it("evaluates piecewise functions with references (GHSERAL)", () => {
    // GHSERAL(600) from the SGTE expression, cross-checked by hand:
    const v = db.evalFunction("GHSERAL", 600);
    expect(v).toBeLessThan(-15000);
    expect(v).toBeGreaterThan(-25000);
    // reference chaining: GALHCP = 5481 − 1.8·T + GHSERAL
    expect(db.evalFunction("GALHCP", 600)).toBeCloseTo(5481 - 1.8 * 600 + v, 6);
  });
});

describe("CEF Gibbs energies match pycalphad (per mole-atom)", () => {
  for (const g of ref.gm) {
    it(`${g.phase} at yAl=${g.yAl}, T=${g.T} K`, () => {
      const phase = db.phases.get(g.phase)!;
      const model = buildPhaseModel(db, phase, ["AL", "ZN"])!;
      const y = [[g.yAl, 1 - g.yAl]];
      const gm = model.gm(y, g.T) / model.atomsPerFormula(y);
      expect(gm).toBeCloseTo(g.GM, 3); // within 0.001 J/mol-atom
    });
  }
});

describe("binary equilibrium matches pycalphad", () => {
  const XTOL = 0.01; // phase-composition tolerance (grid resolution 1/800)
  const FTOL = 0.03; // phase-fraction tolerance

  for (const eq of ref.equilibria) {
    it(`T=${eq.T} K, x(Zn)=${eq.xZn}`, () => {
      const r = binaryPointEquilibrium(db, ["AL", "ZN"], eq.xZn, eq.T);
      expect(r.phases.length).toBe(eq.phases.length);
      const got = [...r.phases].sort((a, b) => a.x - b.x);
      const want = [...eq.phases].sort((a, b) => a.xZn - b.xZn);
      for (let i = 0; i < want.length; i++) {
        expect(got[i]!.phase).toBe(want[i]!.phase);
        expect(Math.abs(got[i]!.x - want[i]!.xZn)).toBeLessThan(XTOL);
        expect(Math.abs(got[i]!.fraction - want[i]!.fraction)).toBeLessThan(FTOL);
      }
    });
  }

  it("resolves the FCC miscibility gap as FCC + FCC (not one phase)", () => {
    const r = binaryPointEquilibrium(db, ["AL", "ZN"], 0.3, 600);
    expect(r.tieLine).toBe(true);
    expect(r.phases.map((p) => p.phase)).toEqual(["FCC_A1", "FCC_A1"]);
  });
});

describe("production database (MatCalc mc_al, 183 phases)", () => {
  const mcAl = parseTdb(
    readFileSync(
      join(here, "../../../services/calphad/databases/mc_al_v2.032.pycalphad.tdb"),
      "utf8",
    ),
  );
  const mcRef = JSON.parse(
    readFileSync(join(here, "fixtures/mc_al-reference.json"), "utf8"),
  ) as {
    elB: string;
    T: number;
    xB: number;
    phases: { phase: string; fraction: number; xB: number }[];
  }[];
  // MatCalc's GP-zone/cluster auxiliary phases duplicate matrix energetics
  // and belong suspended in plain equilibrium (matching the reference run).
  const suspend = (name: string) => /^(GP_|CL_)/.test(name);

  it("parses completely (nothing silently skipped)", () => {
    expect(mcAl.phases.size).toBe(183);
    expect(mcAl.parameters.length).toBeGreaterThan(1900);
    expect(mcAl.skipped).toEqual([]);
  });

  const XTOL = 0.015;
  const FTOL = 0.04;
  for (const eq of mcRef) {
    it(`Al-${eq.elB} at T=${eq.T} K, x(${eq.elB})=${eq.xB} matches pycalphad`, () => {
      const r = binaryPointEquilibrium(mcAl, ["AL", eq.elB], eq.xB, eq.T, { suspend });
      expect(r.phases.length).toBe(eq.phases.length);
      const got = [...r.phases].sort((a, b) => a.x - b.x);
      const want = [...eq.phases].sort((a, b) => a.xB - b.xB);
      for (let i = 0; i < want.length; i++) {
        expect(got[i]!.phase).toBe(want[i]!.phase);
        expect(Math.abs(got[i]!.x - want[i]!.xB)).toBeLessThan(XTOL);
        expect(Math.abs(got[i]!.fraction - want[i]!.fraction)).toBeLessThan(FTOL);
      }
    });
  }
});

describe("multicomponent equilibrium matches pycalphad (production databases)", () => {
  const suspend = (name: string) => /^(GP_|CL_)|^BCC_DISL$/.test(name);
  const mcRef = JSON.parse(
    readFileSync(join(here, "fixtures/multicomponent-reference.json"), "utf8"),
  ) as {
    db: string;
    T: number;
    x: Record<string, number | null>;
    dependent: string;
    phases: { phase: string; fraction: number }[];
  }[];

  for (const c of mcRef) {
    it(`${c.db.replace(/_v.*/, "")} ${Object.keys(c.x).join("-")} at ${c.T} K`, { timeout: 30000 }, () => {
      const db = parseTdb(
        readFileSync(
          join(here, `../../../services/calphad/databases/${c.db}.tdb`),
          "utf8",
        ),
      );
      const x: Record<string, number> = {};
      let sum = 0;
      for (const [e, v] of Object.entries(c.x)) {
        if (v !== null) {
          x[e] = v;
          sum += v;
        }
      }
      x[c.dependent] = 1 - sum;
      const r = pointEquilibrium(db, x, c.T, { suspend });
      expect(r.feasible).toBe(true);
      expect(r.phases.length).toBe(c.phases.length);
      // Match by phase name (multisets) with fraction tolerance.
      const wantNames = c.phases.map((p) => p.phase).sort();
      const gotNames = r.phases.map((p) => p.phase).sort();
      expect(gotNames).toEqual(wantNames);
      for (const want of c.phases) {
        const mine = r.phases.find((p) => p.phase === want.phase)!;
        expect(Math.abs(mine.fraction - want.fraction)).toBeLessThan(0.005);
      }
    });
  }
});

describe("browser-served TDB copies stay in sync with the service", () => {
  for (const f of [
    "mc_fe_v2.059.pycalphad.tdb",
    "mc_ni_v2.034.pycalphad.tdb",
    "mc_al_v2.032.pycalphad.tdb",
    "NIST-solder.tdb",
  ]) {
    it(f, () => {
      const a = readFileSync(join(here, `../../../services/calphad/databases/${f}`));
      const b = readFileSync(join(here, `../../../apps/web/public/tdb/${f}`));
      const h = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
      expect(h(b)).toBe(h(a));
    });
  }
});

describe("wt% to mole fractions", () => {
  it("matches the hosted service's conversion for 316L mid-spec", () => {
    const x = wtToMoleFractions({ C: 0.015, Mn: 1.0, Si: 0.375, Cr: 17.0, Ni: 12.0, Mo: 2.5, N: 0.05, Fe: 67.06 });
    // Reference values from the service's earlier verified response.
    expect(x.CR).toBeCloseTo(0.18217897385110457, 6);
    expect(x.NI).toBeCloseTo(0.11392373185332694, 6);
    expect(x.C).toBeCloseTo(0.000695875197076359, 8);
    expect(Object.values(x).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
  });
});
