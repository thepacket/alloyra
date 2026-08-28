"use client";

import { propertyDef, type CurveRecord, type TestConditions } from "@alloyra/data";
import { LineChart } from "./charts/Line";
import { ProvenanceChip } from "./ProvenanceChip";

/**
 * Curve viewer (B-204): renders one curve-valued property record with its
 * test-condition metadata and provenance — a curve is never shown without
 * saying where it came from and how it was measured or fitted.
 */

const X_LABEL: Record<CurveRecord["x"]["quantity"], string> = {
  temperature: "T",
  cycles: "N (cycles)",
  strain: "ε",
  time_h: "t",
  lmp: "LMP",
};

function conditionsLine(c: TestConditions | undefined): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.tempC !== undefined) parts.push(`${c.tempC} °C`);
  if (c.rRatio !== undefined) parts.push(`R = ${c.rRatio}`);
  if (c.cycles !== undefined) parts.push(`${c.cycles.toExponential(0)} cycles`);
  if (c.strainRatePerS !== undefined) parts.push(`ε̇ = ${c.strainRatePerS} /s`);
  if (c.hours !== undefined) parts.push(`${c.hours} h`);
  if (c.orientation) parts.push(c.orientation);
  if (c.note) parts.push(c.note);
  return parts.join(" · ");
}

export function CurveViewer({ curve, color }: { curve: CurveRecord; color?: string }) {
  const def = propertyDef(curve.property);
  const cond = conditionsLine(curve.conditions);
  return (
    <div className="curve-viewer">
      <div className="curve-head">
        <span className="calc-label">
          {def.label} vs {X_LABEL[curve.x.quantity]}{" "}
          <ProvenanceChip p={curve.provenance} title={curve.source} />
        </span>
        {cond && <span className="curve-cond mono">{cond}</span>}
      </div>
      <LineChart
        series={[
          {
            name: def.label,
            color: color ?? "var(--accent)",
            points: curve.points.map(([x, y]) => ({ x, y })),
          },
        ]}
        xLabel={`${X_LABEL[curve.x.quantity]} (${curve.x.unit})`}
        yLabel={`${def.label} (${curve.unit})`}
        height={220}
        {...(curve.x.log ? { xLog: true } : {})}
        yFmt={(y) => `${Math.abs(y) >= 100 ? y.toFixed(0) : y.toFixed(2)} ${curve.unit}`}
        hoverHint={`hover to read ${def.label} at ${X_LABEL[curve.x.quantity]}`}
        footnote={`${curve.source}${curve.note ? ` — ${curve.note}` : ""}`}
      />
    </div>
  );
}
