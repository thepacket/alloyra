import type { Clause, FailureRule } from "./types.ts";

/**
 * Structural validation for expert-authored rules (R-5.3: rules are
 * editable data — so bad data must fail loudly at authoring time, not
 * silently at audit time). Returns a list of problems; empty = valid.
 */

const CLAUSE_KINDS = new Set([
  "family", "notFamily", "specMaxAbove", "contentAtLeast", "yieldAtLeast",
  "conditionIncludes", "conditionExcludes", "prenBelow",
  "homologousTempAbove", "duty", "dutyFlag", "mediumIn", "loadIn",
  "tensileStress", "galvanicCouplePresent", "lmeContact",
]);

const DUTY_FIELDS = new Set(["chloridePpm", "tempMaxC", "h2sKpa", "pH", "cycles"]);
const FLAG_FIELDS = new Set(["crevices", "welded", "cathodicProtection", "ammonia"]);
const MEDIA = new Set(["atmospheric", "immersion", "soil", "process-fluid"]);
const LOADS = new Set(["static", "cyclic", "impact", "sustained"]);
const SEVERITIES = new Set(["caution", "serious", "disqualifying"]);

function validateClause(c: unknown, i: number): string[] {
  const errs: string[] = [];
  const at = `when[${i}]`;
  if (typeof c !== "object" || c === null) return [`${at}: not an object`];
  const cl = c as Record<string, unknown>;
  const kind = cl.kind as string;
  if (!CLAUSE_KINDS.has(kind)) {
    return [`${at}: unknown clause kind "${String(kind)}" (valid: ${[...CLAUSE_KINDS].join(", ")})`];
  }
  const needNum = (field: string) => {
    if (typeof cl[field] !== "number" || !Number.isFinite(cl[field])) {
      errs.push(`${at} (${kind}): "${field}" must be a finite number`);
    }
  };
  const optionalBand = () => {
    if (cl.nearBand !== undefined) {
      if (typeof cl.nearBand !== "number" || cl.nearBand < 0 || cl.nearBand > 1) {
        errs.push(`${at} (${kind}): nearBand must be a number in [0, 1]`);
      }
    }
  };
  switch (kind) {
    case "family":
    case "notFamily":
      if (!Array.isArray(cl.path) || cl.path.length === 0 || !cl.path.every((s) => typeof s === "string")) {
        errs.push(`${at} (${kind}): "path" must be a non-empty string array`);
      }
      break;
    case "specMaxAbove":
      if (typeof cl.element !== "string") errs.push(`${at}: "element" required`);
      needNum("above");
      break;
    case "contentAtLeast":
      if (typeof cl.element !== "string") errs.push(`${at}: "element" required`);
      needNum("wtPct");
      break;
    case "yieldAtLeast":
      needNum("mpa");
      optionalBand();
      break;
    case "conditionIncludes":
    case "conditionExcludes":
      if (typeof cl.text !== "string" || cl.text.length === 0) errs.push(`${at} (${kind}): "text" required`);
      break;
    case "prenBelow":
      needNum("value");
      break;
    case "homologousTempAbove":
      needNum("fraction");
      optionalBand();
      break;
    case "duty":
      if (!DUTY_FIELDS.has(cl.field as string)) errs.push(`${at} (duty): field must be one of ${[...DUTY_FIELDS].join(", ")}`);
      if (cl.op !== ">=" && cl.op !== "<=") errs.push(`${at} (duty): op must be ">=" or "<="`);
      needNum("value");
      optionalBand();
      break;
    case "dutyFlag":
      if (!FLAG_FIELDS.has(cl.field as string)) errs.push(`${at} (dutyFlag): field must be one of ${[...FLAG_FIELDS].join(", ")}`);
      if (typeof cl.value !== "boolean") errs.push(`${at} (dutyFlag): "value" must be boolean`);
      break;
    case "mediumIn":
      if (!Array.isArray(cl.anyOf) || cl.anyOf.length === 0 || !cl.anyOf.every((m) => MEDIA.has(m as string))) {
        errs.push(`${at} (mediumIn): anyOf must be a non-empty subset of ${[...MEDIA].join(", ")}`);
      }
      break;
    case "loadIn":
      if (!Array.isArray(cl.anyOf) || cl.anyOf.length === 0 || !cl.anyOf.every((m) => LOADS.has(m as string))) {
        errs.push(`${at} (loadIn): anyOf must be a non-empty subset of ${[...LOADS].join(", ")}`);
      }
      break;
    case "lmeContact":
      if (!Array.isArray(cl.anyOf) || cl.anyOf.length === 0 || !cl.anyOf.every((m) => m === "zinc" || m === "copper")) {
        errs.push(`${at} (lmeContact): anyOf must contain "zinc" and/or "copper"`);
      }
      break;
    // tensileStress, galvanicCouplePresent: no fields.
  }
  return errs;
}

export function validateRule(rule: unknown): string[] {
  const errs: string[] = [];
  if (typeof rule !== "object" || rule === null) return ["rule is not an object"];
  const r = rule as Record<string, unknown>;
  if (typeof r.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) {
    errs.push('id: required, kebab-case (a-z, 0-9, "-")');
  }
  if (typeof r.name !== "string" || r.name.length === 0) errs.push("name: required");
  if (!SEVERITIES.has(r.severity as string)) errs.push(`severity: must be one of ${[...SEVERITIES].join(", ")}`);
  if (typeof r.mechanism !== "string" || r.mechanism.length === 0) errs.push("mechanism: required");
  if (typeof r.citation !== "string" || r.citation.length === 0) errs.push("citation: required — uncited rules are not admissible");
  if (!Array.isArray(r.mitigations) || !r.mitigations.every((m) => typeof m === "string")) {
    errs.push("mitigations: must be a string array (may be empty)");
  }
  if (typeof r.reviewedBy !== "string" || r.reviewedBy.length === 0) errs.push("reviewedBy: required");
  if (!Array.isArray(r.when) || r.when.length === 0) {
    errs.push("when: at least one clause required");
  } else {
    r.when.forEach((c, i) => errs.push(...validateClause(c, i)));
  }
  return errs;
}

/** Type guard built on validateRule. */
export function isValidRule(rule: unknown): rule is FailureRule {
  return validateRule(rule).length === 0;
}

export type { Clause };
