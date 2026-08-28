"use client";

/**
 * Sweep sparkline (backlog B-206): a calculator's value swept over one
 * element's content, with the current composition marked and out-of-window
 * stretches dashed — the inline answer to "values from we don't know where":
 * every number shows where it lives and how it moves.
 */

export interface SweepPoint {
  x: number;
  value: number | undefined;
  inWindow: boolean;
}

export function SweepSpark({
  points,
  currentX,
  element,
  unit = "wt%",
}: {
  points: SweepPoint[];
  currentX: number;
  element: string;
  unit?: string;
}) {
  const W = 280;
  const H = 56;
  const M = { l: 34, r: 8, t: 6, b: 14 };

  const defined = points.filter((p) => p.value !== undefined);
  if (defined.length < 2) {
    return (
      <div className="spark-empty">
        sweep vs {element}: no defined values across the range
      </div>
    );
  }
  const xs = points.map((p) => p.x);
  const vs = defined.map((p) => p.value!);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let v0 = Math.min(...vs);
  let v1 = Math.max(...vs);
  if (v1 - v0 < 1e-9) {
    v0 -= 1;
    v1 += 1;
  }
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v: number) =>
    H - M.b - ((v - v0) / (v1 - v0)) * (H - M.t - M.b);

  // Split the trace into runs of same in-window status; gaps at undefined.
  // Runs share their edge point so the line stays continuous at the boundary.
  const runs: { inWindow: boolean; pts: string[] }[] = [];
  let cur: { inWindow: boolean; pts: string[] } | undefined;
  for (const p of points) {
    if (p.value === undefined) {
      cur = undefined;
      continue;
    }
    const coord = `${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`;
    if (!cur || cur.inWindow !== p.inWindow) {
      const bridge = cur?.pts[cur.pts.length - 1];
      cur = { inWindow: p.inWindow, pts: bridge ? [bridge] : [] };
      runs.push(cur);
    }
    cur.pts.push(coord);
  }

  const current = points.reduce((best, p) =>
    Math.abs(p.x - currentX) < Math.abs(best.x - currentX) ? p : best,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="spark"
      role="img"
      aria-label={`value swept over ${element} content`}
    >
      <line x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} className="spark-axis" />
      <text x={M.l - 4} y={sy(v1) + 4} className="spark-tick" textAnchor="end">
        {Number(v1.toPrecision(3))}
      </text>
      <text x={M.l - 4} y={sy(v0) + 3} className="spark-tick" textAnchor="end">
        {Number(v0.toPrecision(3))}
      </text>
      <text x={M.l} y={H - 3} className="spark-tick" textAnchor="start">
        {Number(x0.toPrecision(2))}
      </text>
      <text x={W - M.r} y={H - 3} className="spark-tick" textAnchor="end">
        {element} {Number(x1.toPrecision(2))} {unit}
      </text>
      {runs.map((r, i) => (
        <polyline
          key={i}
          points={r.pts.join(" ")}
          className={`spark-line ${r.inWindow ? "" : "out"}`}
        />
      ))}
      <line
        x1={sx(current.x)}
        y1={M.t}
        x2={sx(current.x)}
        y2={H - M.b}
        className="spark-cursor"
      />
      {current.value !== undefined && (
        <circle cx={sx(current.x)} cy={sy(current.value)} r={3.2} className="spark-dot" />
      )}
    </svg>
  );
}
