/**
 * Staged screening engine (B-203). Granta-style chained stages: each stage
 * sees only the survivors of the previous ones, every elimination carries a
 * stated reason with the actual values involved, and unknowns are handled
 * by an EXPLICIT per-stage policy — a missing value never silently passes
 * or fails a candidate.
 *
 * The engine is generic: it knows nothing about alloys. The caller supplies
 * a property resolver and family accessor, plus display metadata for the
 * reason strings.
 */

export type UnknownPolicy = "eliminate" | "keep";

export interface FamilyStage {
  kind: "family";
  /** Allowed family roots (base metals). Empty = no root constraint. */
  roots: string[];
  /** Optional term matched (case-insensitively) against ANY family segment
   *  (e.g. "stainless", "duplex"). Empty = no term constraint. */
  term?: string;
}

export interface LimitStage {
  kind: "limit";
  property: string;
  min?: number;
  max?: number;
  unknowns: UnknownPolicy;
}

export interface RegionStage {
  kind: "region";
  xProperty: string;
  yProperty: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  unknowns: UnknownPolicy;
}

export type ScreeningStage = (FamilyStage | LimitStage | RegionStage) & {
  id: string;
  enabled: boolean;
};

/** Display metadata for reason strings. */
export interface PropertyMeta {
  label: string;
  unit?: string;
}

export interface StageOutcome {
  stageId: string;
  /** 1-based stage number as shown to the user (enabled stages only). */
  stageNumber: number;
  passed: boolean;
  reason: string;
}

export interface CandidateScreen<T> {
  candidate: T;
  /** 1-based number of the eliminating stage; undefined = survives all. */
  eliminatedAt?: number;
  /** Outcomes for every stage the candidate reached, in order. */
  outcomes: StageOutcome[];
}

export interface ScreenResult<T> {
  candidates: CandidateScreen<T>[];
  /** counts[0] = initial candidate count; counts[k] = survivors after
   *  enabled stage k. Length = enabled stages + 1. */
  funnel: number[];
  /** The enabled stages actually run, in order. */
  ran: ScreeningStage[];
}

const fmtVal = (v: number): string =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(3);

function withUnit(v: number, meta: PropertyMeta): string {
  return `${fmtVal(v)}${meta.unit ? ` ${meta.unit}` : ""}`;
}

export function describeStage(
  stage: ScreeningStage,
  properties: Record<string, PropertyMeta>,
): string {
  if (stage.kind === "family") {
    const parts: string[] = [];
    if (stage.roots.length > 0) parts.push(`base metal in {${stage.roots.join(", ")}}`);
    if (stage.term?.trim()) parts.push(`family contains "${stage.term.trim()}"`);
    return parts.length > 0 ? `Family: ${parts.join(" and ")}` : "Family: no constraint";
  }
  if (stage.kind === "limit") {
    const m = properties[stage.property] ?? { label: stage.property };
    const parts: string[] = [];
    if (stage.min !== undefined) parts.push(`≥ ${withUnit(stage.min, m)}`);
    if (stage.max !== undefined) parts.push(`≤ ${withUnit(stage.max, m)}`);
    return `Limit: ${m.label} ${parts.join(" and ") || "(no bounds set)"} · unknowns ${stage.unknowns === "eliminate" ? "eliminated" : "kept"}`;
  }
  const mx = properties[stage.xProperty] ?? { label: stage.xProperty };
  const my = properties[stage.yProperty] ?? { label: stage.yProperty };
  return `Chart region: ${mx.label} ${withUnit(stage.x0, mx)} – ${withUnit(stage.x1, mx)} and ${my.label} ${withUnit(stage.y0, my)} – ${withUnit(stage.y1, my)} · unknowns ${stage.unknowns === "eliminate" ? "eliminated" : "kept"}`;
}

function checkAxis(
  v: number | undefined,
  lo: number,
  hi: number,
  meta: PropertyMeta,
): string | undefined {
  if (v === undefined) return undefined;
  if (v < lo) return `${meta.label} ${withUnit(v, meta)} < ${withUnit(lo, meta)}`;
  if (v > hi) return `${meta.label} ${withUnit(v, meta)} > ${withUnit(hi, meta)}`;
  return undefined;
}

export function screenCandidates<T>(
  candidates: readonly T[],
  stages: readonly ScreeningStage[],
  opts: {
    resolve: (candidate: T, propertyId: string) => number | undefined;
    familyOf: (candidate: T) => readonly string[];
    properties: Record<string, PropertyMeta>;
  },
): ScreenResult<T> {
  const ran = stages.filter((s) => s.enabled);
  const results: CandidateScreen<T>[] = candidates.map((candidate) => ({
    candidate,
    outcomes: [],
  }));
  const funnel: number[] = [candidates.length];

  for (let k = 0; k < ran.length; k++) {
    const stage = ran[k]!;
    const stageNumber = k + 1;
    let survivors = 0;

    for (const r of results) {
      if (r.eliminatedAt !== undefined) continue;

      let passed = true;
      let reason = "";

      if (stage.kind === "family") {
        const fam = opts.familyOf(r.candidate);
        const root = fam[0] ?? "";
        if (stage.roots.length > 0 && !stage.roots.includes(root)) {
          passed = false;
          reason = `base metal ${root || "(none)"} not in {${stage.roots.join(", ")}}`;
        } else if (stage.term?.trim()) {
          const t = stage.term.trim().toLowerCase();
          if (!fam.some((f) => f.toLowerCase().includes(t))) {
            passed = false;
            reason = `family "${fam.join(" → ")}" does not contain "${stage.term.trim()}"`;
          }
        }
        if (passed) reason = `family "${fam.join(" → ")}" allowed`;
      } else if (stage.kind === "limit") {
        const meta = opts.properties[stage.property] ?? { label: stage.property };
        const v = opts.resolve(r.candidate, stage.property);
        if (v === undefined) {
          if (stage.unknowns === "eliminate") {
            passed = false;
            reason = `${meta.label} unknown — no value on record; eliminated by this stage's unknown policy (a missing value is never assumed to pass)`;
          } else {
            reason = `${meta.label} unknown — KEPT by this stage's unknown policy; the limit was not verified`;
          }
        } else {
          const below =
            stage.min !== undefined && v < stage.min
              ? `${meta.label} ${withUnit(v, meta)} < ${withUnit(stage.min, meta)} limit`
              : undefined;
          const above =
            stage.max !== undefined && v > stage.max
              ? `${meta.label} ${withUnit(v, meta)} > ${withUnit(stage.max, meta)} limit`
              : undefined;
          const fail = below ?? above;
          if (fail) {
            passed = false;
            reason = fail;
          } else {
            reason = `${meta.label} ${withUnit(v, meta)} within limits`;
          }
        }
      } else {
        const mx = opts.properties[stage.xProperty] ?? { label: stage.xProperty };
        const my = opts.properties[stage.yProperty] ?? { label: stage.yProperty };
        const vx = opts.resolve(r.candidate, stage.xProperty);
        const vy = opts.resolve(r.candidate, stage.yProperty);
        if (vx === undefined || vy === undefined) {
          const missing = [
            ...(vx === undefined ? [mx.label] : []),
            ...(vy === undefined ? [my.label] : []),
          ].join(" and ");
          if (stage.unknowns === "eliminate") {
            passed = false;
            reason = `${missing} unknown — no value on record; eliminated by this stage's unknown policy`;
          } else {
            reason = `${missing} unknown — KEPT by this stage's unknown policy; the region test was not verified`;
          }
        } else {
          const fail =
            checkAxis(vx, stage.x0, stage.x1, mx) ?? checkAxis(vy, stage.y0, stage.y1, my);
          if (fail) {
            passed = false;
            reason = `outside region: ${fail}`;
          } else {
            reason = `inside region (${mx.label} ${withUnit(vx, mx)}, ${my.label} ${withUnit(vy, my)})`;
          }
        }
      }

      r.outcomes.push({ stageId: stage.id, stageNumber, passed, reason });
      if (!passed) {
        r.eliminatedAt = stageNumber;
      } else {
        survivors++;
      }
    }
    funnel.push(survivors);
  }

  return { candidates: results, funnel, ran };
}
