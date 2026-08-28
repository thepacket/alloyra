import { describe, expect, it } from "vitest";
import { alloys, PROPERTY_VOCABULARY } from "../src/index.ts";

/**
 * B-301 vocabulary enforcement: every seed record draws from the property
 * vocabulary with its canonical unit, and curve records are well-formed.
 * Plus physical sanity anchors on the NIST cryogenic fits — a typo in a
 * fit coefficient shows up here as an absurd room-temperature value.
 */

const allRecords = alloys.flatMap((a) => a.conditions.flatMap((c) => c.properties));
const allCurves = alloys.flatMap((a) => a.conditions.flatMap((c) => c.curves ?? []));

describe("property vocabulary (B-301)", () => {
  it("every scalar record uses a vocabulary id with its canonical unit", () => {
    for (const r of allRecords) {
      const def = PROPERTY_VOCABULARY[r.property];
      expect(def, `unknown property id '${r.property}'`).toBeDefined();
      expect(r.unit, `unit mismatch on '${r.property}'`).toBe(def.unit);
    }
  });

  it("interval records bracket their headline value", () => {
    for (const r of allRecords) {
      if (!r.interval) continue;
      expect(r.interval.lo).toBeLessThanOrEqual(r.value);
      expect(r.interval.hi).toBeGreaterThanOrEqual(r.value);
    }
  });

  it("curve records are well-formed: vocabulary id, canonical unit, sorted finite points", () => {
    expect(allCurves.length).toBeGreaterThan(0);
    for (const c of allCurves) {
      const def = PROPERTY_VOCABULARY[c.property];
      expect(def, `unknown curve property '${c.property}'`).toBeDefined();
      expect(c.unit).toBe(def.unit);
      expect(c.points.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < c.points.length; i++) {
        const [x, y] = c.points[i]!;
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        if (i > 0) expect(x).toBeGreaterThan(c.points[i - 1]![0]);
      }
      expect(c.source.length).toBeGreaterThan(10);
    }
  });
});

describe("NIST cryogenic fit sanity anchors", () => {
  const curveById = (id: string) => {
    const c = allCurves.find((c) => c.id === id);
    expect(c, `missing curve ${id}`).toBeDefined();
    return c!;
  };
  const at = (id: string, xTarget: number) => {
    const c = curveById(id);
    return c.points.reduce((best, p) =>
      Math.abs(p[0] - xTarget) < Math.abs(best[0] - xTarget) ? p : best,
    )[1];
  };

  it("304 thermal conductivity ≈ 15 W/(m·K) at room temperature", () => {
    const k = at("s30400-nist-k", 300);
    expect(k).toBeGreaterThan(12);
    expect(k).toBeLessThan(18);
  });

  it("6061-T6 thermal conductivity ≈ 160 W/(m·K) at room temperature", () => {
    const k = at("a96061-nist-k", 300);
    expect(k).toBeGreaterThan(130);
    expect(k).toBeLessThan(190);
  });

  it("304/316 Young's modulus ≈ 195 GPa near room temperature", () => {
    for (const id of ["s30400-nist-e", "s31603-nist-e"]) {
      const e = at(id, 290);
      expect(e).toBeGreaterThan(185);
      expect(e).toBeLessThan(215);
    }
  });

  it("6061-T6 Young's modulus ≈ 69 GPa near room temperature", () => {
    const e = at("a96061-nist-e", 293);
    expect(e).toBeGreaterThan(64);
    expect(e).toBeLessThan(75);
  });

  it("304 specific heat ≈ 480 J/(kg·K) at room temperature and small at 4 K", () => {
    const cp = at("s30400-nist-cp", 300);
    expect(cp).toBeGreaterThan(400);
    expect(cp).toBeLessThan(560);
    expect(at("s30400-nist-cp", 4)).toBeLessThan(5);
  });

  it("thermal contraction is ~0 at 293 K and strongly negative at 4 K", () => {
    for (const [id, coldMin, coldMax] of [
      ["s30400-nist-dl", -320, -280],
      ["a96061-nist-dl", -440, -390],
    ] as const) {
      // 300 K sits 7 K ABOVE the 293 K reference: expect a small positive
      // expansion (≈ CTE·7 K ≈ 10–16 units of 10⁻⁵), nowhere near the
      // hundreds-negative cryogenic values a coefficient typo would give.
      expect(Math.abs(at(id, 300))).toBeLessThan(30);
      const cold = at(id, 4);
      expect(cold).toBeGreaterThan(coldMin);
      expect(cold).toBeLessThan(coldMax);
    }
  });
});
