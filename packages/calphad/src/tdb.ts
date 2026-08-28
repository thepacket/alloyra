import {
  compileExpression,
  evalPiecewise,
  type PiecewiseSegment,
  type Resolver,
} from "./expr.ts";

/**
 * TDB (Thermo-Calc database) parser (B-501). Line-oriented DSL: statements
 * end with '!', comments start with '$'. Parses the subset the CEF engine
 * needs — ELEMENT, FUNCTION, TYPE_DEFINITION (magnetic), PHASE,
 * CONSTITUENT, PARAMETER (G/L/TC/BMAGN) — and records what it skipped so
 * nothing is silently dropped.
 */

export interface TdbParameter {
  kind: "G" | "L" | "TC" | "BMAGN";
  phase: string;
  /** Constituent chain, one array of species per sublattice. */
  constituents: string[][];
  order: number;
  segments: PiecewiseSegment[];
}

export interface TdbPhase {
  name: string;
  typeChars: string;
  /** Sites per sublattice. */
  sites: number[];
  /** Species per sublattice (from CONSTITUENT). */
  constituents: string[][];
  magnetic?: { antiferromagneticFactor: number; structureFactor: number };
}

export interface TdbDatabase {
  elements: string[];
  phases: Map<string, TdbPhase>;
  parameters: TdbParameter[];
  /** Statements the parser recognized but does not model. */
  skipped: string[];
  evalFunction: (name: string, t: number) => number;
}

function splitStatements(src: string): string[] {
  // Strip $ comments (to end of line), then split on '!'.
  const noComments = src
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("$");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return noComments
    .split("!")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

/** Parse "298.15 expr; 700 Y expr; 933 Y expr; 2900 N" into segments. */
function parsePiecewise(body: string, resolve: Resolver): PiecewiseSegment[] {
  const parts = body.split(";").map((p) => p.trim());
  const segments: PiecewiseSegment[] = [];
  // First part: "<loT> <expr>"
  const first = parts[0]!;
  const m0 = /^([0-9.]+(?:[eE][+-]?\d+)?)\s+(.*)$/.exec(first);
  if (!m0) throw new Error(`Bad piecewise head: "${first.slice(0, 60)}"`);
  let lo = Number(m0[1]);
  let expr = m0[2]!;
  for (let i = 1; i < parts.length; i++) {
    // "<hiT> Y <nextExpr>"  or  "<hiT> N"
    const m = /^([0-9.]+(?:[eE][+-]?\d+)?)\s+([YN])\s*(.*)$/.exec(parts[i]!);
    if (!m) throw new Error(`Bad piecewise segment: "${parts[i]!.slice(0, 60)}"`);
    const hi = Number(m[1]);
    segments.push({ lo, hi, fn: compileExpression(expr, resolve) });
    if (m[2] === "N") return segments;
    lo = hi;
    expr = m[3]!;
  }
  // No trailing N — close the last open segment generously.
  segments.push({ lo, hi: 6000, fn: compileExpression(expr, resolve) });
  return segments;
}

export function parseTdb(src: string): TdbDatabase {
  const statements = splitStatements(src);
  const elements: string[] = [];
  const phases = new Map<string, TdbPhase>();
  const parameters: TdbParameter[] = [];
  const skipped: string[] = [];
  const functions = new Map<string, PiecewiseSegment[]>();
  const fnCache = new Map<string, Map<number, number>>();
  /** typedef char → magnetic spec */
  const magneticTypedefs = new Map<string, { antiferromagneticFactor: number; structureFactor: number }>();
  /** typedef char → phase name it amends (from GES A_P_D <phase> MAGNETIC) */
  const magneticPhases: { phase: string; afm: number; sf: number }[] = [];

  const resolve: Resolver = (name) => {
    return (t: number) => {
      const segs = functions.get(name);
      if (!segs) throw new Error(`TDB function "${name}" is not defined`);
      let cache = fnCache.get(name);
      if (!cache) {
        cache = new Map();
        fnCache.set(name, cache);
      }
      const hit = cache.get(t);
      if (hit !== undefined) return hit;
      const v = evalPiecewise(segs, t);
      if (cache.size < 4096) cache.set(t, v);
      return v;
    };
  };

  for (const st of statements) {
    const upper = st.toUpperCase();
    if (upper.startsWith("ELEMENT ")) {
      const parts = st.split(/\s+/);
      const el = parts[1]!.toUpperCase();
      if (el !== "/-") elements.push(el);
      continue;
    }
    if (upper.startsWith("FUNCTION ")) {
      const m = /^FUNCTION\s+(\S+)\s+(.*)$/i.exec(st)!;
      functions.set(m[1]!.toUpperCase(), parsePiecewise(m[2]!, resolve));
      continue;
    }
    if (upper.startsWith("TYPE_DEFINITION ")) {
      // TYPE_DEFINITION & GES A_P_D BCC_A2 MAGNETIC -1 0.4
      const m = /^TYPE_DEFINITION\s+(\S)\s+GES\s+A(?:MEND)?_P(?:HASE)?_D(?:ESCRIPTION)?\s+(\S+)\s+MAGNETIC\s+(-?[\d.]+)\s+([\d.]+)/i.exec(st);
      if (m) {
        magneticTypedefs.set(m[1]!, {
          antiferromagneticFactor: Number(m[3]),
          structureFactor: Number(m[4]),
        });
        magneticPhases.push({ phase: m[2]!.toUpperCase(), afm: Number(m[3]), sf: Number(m[4]) });
      }
      continue;
    }
    if (upper.startsWith("PHASE ")) {
      // PHASE NAME %&  2  1  3
      const parts = st.split(/\s+/);
      const name = parts[1]!.toUpperCase();
      const typeChars = parts[2] ?? "";
      const nSub = Number(parts[3]);
      const sites = parts.slice(4, 4 + nSub).map(Number);
      phases.set(name, { name, typeChars, sites, constituents: [] });
      continue;
    }
    if (upper.startsWith("CONSTITUENT ") || upper.startsWith("CONST ")) {
      // CONSTITUENT NAME :AL,ZN : VA : (auxiliary suffixes like ":AL,NI:AL,NI:")
      const m =
        /^CONST(?:ITUENT)?\s+(\S+)\s+:(.*):\s*$/i.exec(st) ??
        /^CONST(?:ITUENT)?\s+(\S+)\s+:(.*):/i.exec(st);
      if (!m) {
        skipped.push(st.slice(0, 60));
        continue;
      }
      const name = m[1]!.toUpperCase().replace(/:.*$/, "");
      const phase = phases.get(name);
      if (!phase) {
        skipped.push(st.slice(0, 60));
        continue;
      }
      phase.constituents = m[2]!
        .split(":")
        .map((sub) =>
          sub
            .split(",")
            .map((sp) => sp.trim().toUpperCase().replace(/%$/, ""))
            .filter((sp) => sp.length > 0),
        )
        .filter((arr) => arr.length > 0);
      continue;
    }
    if (upper.startsWith("PARAMETER ") || upper.startsWith("PARAM ")) {
      // PARAMETER G(FCC_A1,AL,ZN;1) 298.15 +6612.9-4.5911*T; 6000 N
      const m = /^PARAM(?:ETER)?\s+([A-Z]+)\s*\(\s*([^,]+)\s*,\s*([^;)]+)(?:;\s*(\d+))?\s*\)\s+(.*)$/i.exec(st);
      if (!m) {
        skipped.push(st.slice(0, 60));
        continue;
      }
      const kindRaw = m[1]!.toUpperCase();
      if (kindRaw !== "G" && kindRaw !== "L" && kindRaw !== "TC" && kindRaw !== "BMAGN") {
        skipped.push(st.slice(0, 80));
        continue;
      }
      const phase = m[2]!.trim().toUpperCase();
      const constituents = m[3]!
        .split(":")
        .map((sub) =>
          sub
            .split(",")
            .map((sp) => sp.trim().toUpperCase().replace(/%$/, ""))
            .filter((sp) => sp.length > 0),
        );
      parameters.push({
        kind: kindRaw,
        phase,
        constituents,
        order: m[4] !== undefined ? Number(m[4]) : 0,
        segments: parsePiecewise(m[5]!, resolve),
      });
      continue;
    }
    if (
      upper.startsWith("DEFINE_SYSTEM_DEFAULT") ||
      upper.startsWith("DEFAULT_COMMAND") ||
      upper.startsWith("DATABASE_INFO") ||
      upper.startsWith("SPECIES ") ||
      upper.startsWith("LIST_OF_REFERENCES") ||
      upper.startsWith("REFERENCE_FILE") ||
      upper.startsWith("ADD_REFERENCES") ||
      upper.startsWith("ASSESSED_SYSTEMS") ||
      upper.startsWith("VERSION_DATE") ||
      upper.startsWith("TEMP")
    ) {
      continue; // recognized, intentionally unmodeled
    }
    skipped.push(st.slice(0, 60));
  }

  for (const mp of magneticPhases) {
    const phase = phases.get(mp.phase);
    if (phase) {
      phase.magnetic = { antiferromagneticFactor: mp.afm, structureFactor: mp.sf };
    }
  }
  // Magnetic typedef chars attached via the PHASE type-character column.
  for (const phase of phases.values()) {
    if (phase.magnetic) continue;
    for (const ch of phase.typeChars) {
      const mag = magneticTypedefs.get(ch);
      if (mag) {
        phase.magnetic = mag;
        break;
      }
    }
  }

  return {
    elements,
    phases,
    parameters,
    skipped,
    evalFunction: (name, t) => resolve(name.toUpperCase())(t),
  };
}
