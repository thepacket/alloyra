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

describe("temperature stepping (B-502) tracks the pycalphad sweep", () => {
  const suspend = (name: string) => /^(GP_|CL_)|^BCC_DISL$/.test(name);
  const sweepRef = JSON.parse(
    readFileSync(join(here, "fixtures/tsweep-316l-reference.json"), "utf8"),
  ) as { tC: number; phases: { phase: string; fraction: number }[] }[];
  // Subset keeps the suite fast while covering multi-phase, single-phase,
  // and delta-ferrite regimes; warm starts still chain between them.
  const temps = [500, 800, 1000, 1400];

  it("phase sets and fractions match at each step", { timeout: 60000 }, async () => {
    const { stepTemperature } = await import("../src/index.ts");
    const db = parseTdb(
      readFileSync(
        join(here, "../../../services/calphad/databases/mc_fe_v2.059.pycalphad.tdb"),
        "utf8",
      ),
    );
    const x = {
      FE: 1 - 0.182 - 0.114 - 0.0145 - 0.0007 - 0.0101 - 0.0074 - 0.002,
      CR: 0.182, NI: 0.114, MO: 0.0145, C: 0.0007, MN: 0.0101, SI: 0.0074, N: 0.002,
    };
    const pts = stepTemperature(db, x, temps.map((t) => t + 273.15), { suspend });
    for (let i = 0; i < temps.length; i++) {
      const want = sweepRef.find((r) => r.tC === temps[i])!;
      const got = pts[i]!.result;
      expect(got.feasible).toBe(true);
      // Every reference phase above 2% must appear within 3%; extra
      // sub-2% slivers near phase boundaries are tolerated.
      for (const w of want.phases) {
        if (w.fraction < 0.02) continue;
        const mine = got.phases.find((p) => p.phase === w.phase);
        expect(mine, `${temps[i]} °C missing ${w.phase}`).toBeDefined();
        expect(Math.abs(mine!.fraction - w.fraction)).toBeLessThan(0.03);
      }
      for (const p of got.phases) {
        if (p.fraction < 0.02) continue;
        expect(
          want.phases.some((w) => w.phase === p.phase),
          `${temps[i]} °C extra ${p.phase} at ${p.fraction.toFixed(3)}`,
        ).toBe(true);
      }
    }
  });
});

describe("Scheil solidification (B-504) matches the pycalphad `scheil` package", () => {
  const suspend = (name: string) => /^(GP_|CL_)/.test(name);
  const scheilRef = JSON.parse(
    readFileSync(join(here, "fixtures/scheil-reference.json"), "utf8"),
  ) as {
    name: string;
    elB: string;
    xB: number;
    tStart: number;
    temperatures: number[];
    fractionSolid: number[];
    liquidusK: number;
    finalK: number;
    phaseAmounts: Record<string, number>;
  }[];

  for (const c of scheilRef) {
    it(`${c.name}: Al-${(c.xB * 100).toFixed(0)}${c.elB}`, { timeout: 60000 }, async () => {
      const { scheilSolidify } = await import("../src/index.ts");
      const db = parseTdb(
        readFileSync(
          c.name === "alzn"
            ? join(here, "fixtures/alzn_mey.tdb")
            : join(here, "../../../services/calphad/databases/mc_al_v2.032.pycalphad.tdb"),
          "utf8",
        ),
      );
      const comp: Record<string, number> = { AL: 1 - c.xB, [c.elB]: c.xB };
      const r = scheilSolidify(db, comp, { tStartK: c.tStart, dT: 2, suspend, cutoff: 0.001 });
      expect(r.terminated).toBe("solidified");
      expect(Math.abs((r.liquidusK ?? 0) - c.liquidusK)).toBeLessThanOrEqual(2);
      expect(Math.abs((r.solidusK ?? 0) - c.finalK)).toBeLessThanOrEqual(4);
      for (const [phase, amount] of Object.entries(c.phaseAmounts)) {
        expect(Math.abs((r.solidTotals[phase] ?? 0) - amount)).toBeLessThan(0.005);
      }
      // Fraction-solid curve at sampled reference temperatures.
      for (let i = 0; i < c.temperatures.length; i += 5) {
        const tRef = c.temperatures[i]!;
        if (tRef > (r.liquidusK ?? 0) || tRef < (r.solidusK ?? 0)) continue;
        const nearest = r.steps.reduce((b, s2) =>
          Math.abs(s2.tK - tRef) < Math.abs(b.tK - tRef) ? s2 : b,
        );
        expect(Math.abs(1 - nearest.fLiquid - c.fractionSolid[i]!)).toBeLessThan(0.015);
      }
    });
  }
});

describe("Kou hot-cracking index (B-504 follow-through)", () => {
  it("is computed and finite for a solidified Al-Zn run", { timeout: 60000 }, async () => {
    const { scheilSolidify } = await import("../src/index.ts");
    const r = scheilSolidify(db, { AL: 0.8, ZN: 0.2 }, { tStartK: 950, dT: 2, cutoff: 0.001 });
    expect(r.terminated).toBe("solidified");
    expect(r.kouIndexK).toBeDefined();
    expect(r.kouIndexK!).toBeGreaterThan(0);
    expect(Number.isFinite(r.kouIndexK!)).toBe(true);
    // Liquid enrichment trace: Zn piles up in the last liquid.
    const first = r.steps.find((s2) => 1 - s2.fLiquid > 0.05)!;
    const late = [...r.steps].reverse().find((s2) => s2.fLiquid > 0.01)!;
    expect(late.liquidX.ZN!).toBeGreaterThan(first.liquidX.ZN!);
  });
});
