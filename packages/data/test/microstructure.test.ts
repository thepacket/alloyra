import { describe, expect, it } from "vitest";
import {
  hasMechanism,
  matchesMicroQuery,
  microstructureHaystack,
} from "@alloyra/core";
import { alloys, microConcepts } from "../src/index.ts";

const conditions = alloys.flatMap((a) =>
  a.conditions.map((c) => ({ alloy: a, cond: c })),
);

describe("microstructure seeds (E1 discipline)", () => {
  it("every condition carries a cited microstructure block", () => {
    for (const { alloy, cond } of conditions) {
      expect(cond.microstructure, `${alloy.uns}/${cond.id}`).toBeDefined();
      expect(cond.microstructure!.source.length, `${alloy.uns}/${cond.id} source`).toBeGreaterThan(10);
      expect(cond.microstructure!.matrix.length).toBeGreaterThan(0);
    }
  });

  it("exactly one dominant mechanism per condition", () => {
    for (const { alloy, cond } of conditions) {
      const dominant = cond.microstructure!.strengthening.filter(
        (t) => t.role === "dominant",
      );
      expect(dominant.length, `${alloy.uns}/${cond.id}`).toBe(1);
    }
  });

  it("density is present on every condition (Ashby chart axis)", () => {
    for (const { alloy, cond } of conditions) {
      const d = cond.properties.find((p) => p.property === "density");
      expect(d, `${alloy.uns}/${cond.id}`).toBeDefined();
      expect(d!.value).toBeGreaterThan(2);
      expect(d!.value).toBeLessThan(10);
    }
  });
});

describe("microstructure search semantics", () => {
  const hay = (uns: string) => {
    const a = alloys.find((x) => x.uns === uns)!;
    return microstructureHaystack(a.conditions[0]!.microstructure!);
  };

  it("'serrated' matches only documented serration classes, never none-documented", () => {
    const matches = conditions.filter(({ cond }) =>
      matchesMicroQuery(microstructureHaystack(cond.microstructure!), "serrated"),
    );
    for (const m of matches) {
      expect(m.cond.microstructure!.grainBoundaries?.serration).not.toBe("none-documented");
    }
    // Honest search: the superalloys with documented serration heat treatments.
    expect(matches.map((m) => m.alloy.uns).sort()).toEqual(["N06625", "N07718"]);
  });

  it("mechanism synonyms resolve — 'age hardening' finds the aged Al tempers", () => {
    expect(matchesMicroQuery(hay("A97075"), "age hardening")).toBe(true);
    expect(matchesMicroQuery(hay("A96061"), "age hardening")).toBe(true);
    expect(matchesMicroQuery(hay("K02600"), "age hardening")).toBe(false);
  });

  it("'annealing twins' finds low-SFE FCC alloys and not ferritic steel", () => {
    expect(matchesMicroQuery(hay("S30400"), "annealing twins")).toBe(true);
    expect(matchesMicroQuery(hay("C26000"), "annealing twins")).toBe(true);
    expect(matchesMicroQuery(hay("K02600"), "annealing twins")).toBe(false);
  });

  it("mechanism tags are queryable directly", () => {
    const a7075 = alloys.find((x) => x.uns === "A97075")!;
    expect(hasMechanism(a7075.conditions[0]!.microstructure!, "precipitation")).toBe(true);
    const a36 = alloys.find((x) => x.uns === "K02600")!;
    expect(hasMechanism(a36.conditions[0]!.microstructure!, "precipitation")).toBe(false);
  });
});

describe("concept vocabulary", () => {
  it("ids unique, every concept cited with definition and probe", () => {
    const ids = microConcepts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of microConcepts) {
      expect(c.source.length, c.id).toBeGreaterThan(10);
      expect(c.definition.length, c.id).toBeGreaterThan(20);
      expect(c.probe.length, c.id).toBeGreaterThan(0);
      expect(c.synonyms.length, c.id).toBeGreaterThan(0);
    }
  });

  it("the reviewer's four hunting terms all resolve to a concept", () => {
    const all = microConcepts.flatMap((c) =>
      [c.name, ...c.synonyms].map((s) => s.toLowerCase()),
    );
    for (const term of [
      "serrated grain boundary morphology",
      "strain hardening",
      "precipitation hardening",
      "grain boundary twinning",
    ]) {
      expect(
        all.some((s) => s.includes(term.split(" ")[0]!)),
        term,
      ).toBe(true);
    }
  });
});
