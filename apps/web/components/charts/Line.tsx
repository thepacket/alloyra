"use client";

import { useMemo, useState } from "react";
import { fmtTick, logTicks, niceTicks } from "./axes";

/**
 * Plot kit — multi-series line chart (B-201/B-502). Theme-native SVG for
 * property diagrams: phase fraction vs temperature and friends. Series
 * render as connected lines with endpoint emphasis; hover reads out the
 * nearest x-slice across all series.
 */

export interface LineSeries {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  xLabel,
  yLabel,
  height = 300,
  yMin,
  yMax,
  xLog = false,
  yFmt,
  hoverHint,
  footnote,
}: {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  /** Logarithmic x axis (B-204 curve viewers — cryo T, cycles, time). */
  xLog?: boolean;
  /** Hover-readout y formatter; default renders phase fractions as %. */
  yFmt?: (y: number) => string;
  /** Hover hint when nothing is hovered. */
  hoverHint?: string;
  footnote?: string;
}) {
  const [hoverX, setHoverX] = useState<number | undefined>();
  const W = 680;
  const H = height;
  const M = { l: 52, r: 14, t: 12, b: 38 };

  const plot = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x)).filter((x) => !xLog || x > 0);
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    if (xs.length === 0) return undefined;
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = yMin ?? Math.min(0, ...ys);
    const y1 = yMax ?? Math.max(...ys) * 1.05;
    const tx = (v: number) => (xLog ? Math.log10(v) : v);
    const sx = (v: number) =>
      M.l + ((tx(v) - tx(x0)) / (tx(x1) - tx(x0) || 1)) * (W - M.l - M.r);
    const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
    return {
      x0,
      x1,
      y0,
      y1,
      sx,
      sy,
      xt: xLog ? logTicks(x0, x1) : niceTicks(x0, x1, 7),
      yt: niceTicks(y0, y1, 5),
    };
  }, [series, yMin, yMax, xLog, H, M.l, M.r, M.t, M.b]);

  if (!plot) return <div className="chart-empty">No points yet.</div>;

  const hovered =
    hoverX === undefined
      ? undefined
      : series
          .map((s) => {
            const nearest = s.points.reduce(
              (best, p) => (Math.abs(p.x - hoverX) < Math.abs(best.x - hoverX) ? p : best),
              s.points[0]!,
            );
            return { name: s.name, ...nearest };
          })
          // Phase-fraction mode hides zero-fraction series; generic curves
          // (custom yFmt) keep every value — contraction curves are negative.
          .filter((p) => (yFmt ? true : p.y > 1e-4))
          .sort((a, b) => b.y - a.y);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label={`${yLabel} vs ${xLabel}`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const frac = (e.clientX - rect.left) / rect.width;
          const xView = frac * W;
          if (xView < M.l || xView > W - M.r) return setHoverX(undefined);
          const frac2 = (xView - M.l) / (W - M.l - M.r);
          setHoverX(
            xLog
              ? 10 ** (Math.log10(plot.x0) + frac2 * (Math.log10(plot.x1) - Math.log10(plot.x0)))
              : plot.x0 + frac2 * (plot.x1 - plot.x0),
          );
        }}
        onMouseLeave={() => setHoverX(undefined)}
      >
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} className="chart-frame" />
        {plot.xt.map((v) => (
          <g key={`x${v}`}>
            <line x1={plot.sx(v)} y1={M.t} x2={plot.sx(v)} y2={H - M.b} className="chart-grid" />
            <text x={plot.sx(v)} y={H - M.b + 14} className="chart-tick" textAnchor="middle">
              {fmtTick(v)}
            </text>
          </g>
        ))}
        {plot.yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.l} y1={plot.sy(v)} x2={W - M.r} y2={plot.sy(v)} className="chart-grid" />
            <text x={M.l - 6} y={plot.sy(v) + 3} className="chart-tick" textAnchor="end">
              {fmtTick(v)}
            </text>
          </g>
        ))}
        <text x={M.l + (W - M.l - M.r) / 2} y={H - 6} className="chart-axis" textAnchor="middle">
          {xLabel}
        </text>
        <text
          x={12}
          y={M.t + (H - M.t - M.b) / 2}
          className="chart-axis"
          textAnchor="middle"
          transform={`rotate(-90 12 ${M.t + (H - M.t - M.b) / 2})`}
        >
          {yLabel}
        </text>
        {hoverX !== undefined && (
          <line
            x1={plot.sx(hoverX)}
            y1={M.t}
            x2={plot.sx(hoverX)}
            y2={H - M.b}
            className="spark-cursor"
          />
        )}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.points.map((p) => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={1.8}
              opacity={0.9}
            />
            {s.points.map((p) => (
              <circle key={p.x} cx={plot.sx(p.x)} cy={plot.sy(p.y)} r={2.2} fill={s.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name} className="legend-item">
            <span className="legend-dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="chart-readout mono">
        {hovered && hovered.length > 0
          ? `${fmtTick(hovered[0]!.x)}: ${hovered
              .map((p) => `${p.name} ${yFmt ? yFmt(p.y) : `${(p.y * 100).toFixed(1)}%`}`)
              .join(" · ")}`
          : (hoverHint ?? "hover to read phase fractions at a temperature")}
      </div>
      {footnote && <div className="chart-foot">{footnote}</div>}
    </div>
  );
}
