import type { Alloy } from "@alloyra/data";
import {
  describeStage,
  type ScreenResult,
  type ScreeningStage,
} from "@alloyra/core";
import { SCREEN_PROPERTIES, SCREEN_PROPERTY_META, screenProperty } from "./screeningProps";

/**
 * Rationale report (B-203): a Markdown document a reviewer can file —
 * every stage's parameters, the funnel, and WHY each candidate was
 * eliminated, with the actual values and the unknown-policy disclosures.
 */

/** Property ids referenced by the enabled stages, in first-use order. */
export function referencedProperties(stages: readonly ScreeningStage[]): string[] {
  const ids: string[] = [];
  for (const s of stages) {
    if (!s.enabled) continue;
    const add = (id: string) => {
      if (!ids.includes(id) && screenProperty(id)) ids.push(id);
    };
    if (s.kind === "limit") add(s.property);
    if (s.kind === "region") {
      add(s.xProperty);
      add(s.yProperty);
    }
  }
  return ids;
}

const fmtCell = (v: number | undefined, unit?: string): string =>
  v === undefined
    ? "unknown"
    : `${Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(3)}${unit ? ` ${unit}` : ""}`;

export function buildScreeningReport(
  result: ScreenResult<Alloy>,
  datasetVersion: string,
): string {
  const stages = result.ran;
  const propIds = referencedProperties(stages);
  const lines: string[] = [];

  lines.push("# Alloyra staged-screening report");
  lines.push("");
  lines.push(
    `Generated ${new Date().toISOString()} · dataset ${datasetVersion} · Alloyra research preview`,
  );
  lines.push("");

  lines.push("## Stages (applied in order — each stage sees only the survivors of the previous ones)");
  lines.push("");
  stages.forEach((s, i) => {
    lines.push(`${i + 1}. ${describeStage(s, SCREEN_PROPERTY_META)}`);
  });
  if (stages.length === 0) lines.push("_No enabled stages — nothing was screened._");
  lines.push("");

  lines.push("## Funnel");
  lines.push("");
  lines.push(
    result.funnel
      .map((n, i) => (i === 0 ? `${n} candidates` : `after stage ${i}: ${n}`))
      .join(" → "),
  );
  lines.push("");

  for (let k = 1; k <= stages.length; k++) {
    const out = result.candidates.filter((c) => c.eliminatedAt === k);
    if (out.length === 0) continue;
    lines.push(
      `## Eliminated at stage ${k} — ${describeStage(stages[k - 1]!, SCREEN_PROPERTY_META)} (${out.length})`,
    );
    lines.push("");
    for (const c of out) {
      const last = c.outcomes[c.outcomes.length - 1]!;
      lines.push(`- **${c.candidate.names[0]}** (${c.candidate.uns}): ${last.reason}`);
    }
    lines.push("");
  }

  const survivors = result.candidates.filter((c) => c.eliminatedAt === undefined);
  lines.push(`## Survivors (${survivors.length})`);
  lines.push("");
  if (survivors.length > 0) {
    const propDefs = propIds.map((id) => screenProperty(id)!);
    lines.push(
      `| UNS | Name | Family |${propDefs.map((p) => ` ${p.label}${p.unit ? ` (${p.unit})` : ""} |`).join("")}`,
    );
    lines.push(`|---|---|---|${propDefs.map(() => "---|").join("")}`);
    for (const c of survivors) {
      const a = c.candidate;
      lines.push(
        `| ${a.uns} | ${a.names[0]} | ${a.family.join(" → ")} |${propDefs
          .map((p) => ` ${fmtCell(p.get(a))} |`)
          .join("")}`,
      );
    }
    // Unknown-but-kept disclosures: survivors that passed a stage only
    // because its unknown policy kept them.
    const keptUnknown = survivors.filter((c) =>
      c.outcomes.some((o) => o.passed && o.reason.includes("KEPT")),
    );
    if (keptUnknown.length > 0) {
      lines.push("");
      lines.push("### Survivors with unverified stages (kept by an unknown policy)");
      lines.push("");
      for (const c of keptUnknown) {
        for (const o of c.outcomes.filter((o) => o.passed && o.reason.includes("KEPT"))) {
          lines.push(`- **${c.candidate.names[0]}** (${c.candidate.uns}), stage ${o.stageNumber}: ${o.reason}`);
        }
      }
    }
  } else {
    lines.push("_No candidate survives all stages. Relax a limit or review the eliminations above._");
  }
  lines.push("");

  lines.push("## Method & provenance");
  lines.push("");
  for (const id of propIds) {
    const p = SCREEN_PROPERTIES.find((x) => x.id === id)!;
    lines.push(`- ${p.provenance}`);
  }
  lines.push(
    "- Unknown values are handled by each stage's explicit policy and reported above — a missing value never silently passes or fails a candidate.",
  );
  lines.push(
    "- Screening narrows a candidate list against stated criteria; it is not a fitness-for-service judgment. Alloyra never claims a part is safe or will fail — flags and eliminations inform expert judgment.",
  );
  lines.push("");
  return lines.join("\n");
}
