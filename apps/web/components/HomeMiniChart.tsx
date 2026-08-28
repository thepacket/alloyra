"use client";

import { useRouter } from "next/navigation";
import { alloys } from "@alloyra/data";
import { familyColor } from "../lib/familyColors";
import { ScatterChart, type ScatterPoint } from "./charts/Scatter";

/**
 * Home dashboard thumbnail (B-702): the dataset's property space at a
 * glance — strength vs density, family-colored, click-through to the
 * database. Plots on the landing surface, not just prose.
 */
export function HomeMiniChart() {
  const router = useRouter();
  const points: ScatterPoint[] = alloys
    .map((a) => {
      let y: number | undefined;
      let x: number | undefined;
      for (const c of a.conditions) {
        for (const p of c.properties) {
          if (p.property === "yield_strength" && p.provenance === "spec-min" && y === undefined) y = p.value;
          if (p.property === "density" && x === undefined) x = p.value;
        }
      }
      if (x === undefined || y === undefined) return undefined;
      return {
        id: a.uns,
        label: a.names[0] ?? a.uns,
        x,
        y,
        color: familyColor(a.family[0]),
      };
    })
    .filter((p): p is ScatterPoint => p !== undefined);

  return (
    <div className="home-mini">
      <h2 className="studio-h">Dataset property space — click a point to open it</h2>
      <ScatterChart
        points={points}
        xAxis={{ label: "ρ, typical (g/cm³)" }}
        yAxis={{ label: "σy min (MPa)" }}
        onPick={(uns) => router.push(`/database?sel=${uns}`)}
        compact
        height={300}
        footnote="σy = spec minimum; ρ = literature-typical (ESTIMATED). Full chart with axis choices, mechanism filters, and microstructure search lives in the database view."
      />
    </div>
  );
}
