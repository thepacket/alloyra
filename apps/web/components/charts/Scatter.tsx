"use client";

import { useMemo, useState } from "react";

/**
 * Plot kit — scatter (backlog B-201/B-202, design-v2 § 3).
 * In-house SVG, theme-native, no chart dependency. Grammar borrowed from
 * the Ashby-chart tradition: family-colored points, rejected candidates
 * grey out in place instead of vanishing, provenance stated under the axes.
 */

export interface ScatterPoint {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  /** CSS color (family identity). */
  color: string;
  /** Screened-out but kept visible for context (Granta grey-out grammar). */
  muted?: boolean;
  selected?: boolean;
}

interface Axis {
  label: string;
  log?: boolean;
}

function niceTicks(min: number, max: number, target = 6): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / target;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  for (let e = lo; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min * 0.999 && v <= max * 1.001) ticks.push(v);
    }
  }
  return ticks;
}

function fmtTick(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (a < 1) return v.toFixed(2);
  return `${Number(v.toPrecision(4))}`;
}

export function ScatterChart({
  points,
  xAxis,
  yAxis,
  onPick,
  height = 420,
  compact = false,
  footnote,
}: {
  points: ScatterPoint[];
  xAxis: Axis;
  yAxis: Axis;
  onPick?: (id: string) => void;
  height?: number;
  compact?: boolean;
  footnote?: string;
}) {
  const [hover, setHover] = useState<string | undefined>();

  const W = compact ? 480 : 680;
  const H = height;
  const M = compact
    ? { l: 46, r: 14, t: 12, b: 34 }
    : { l: 56, r: 18, t: 14, b: 40 };

  const plot = useMemo(() => {
    const xs = points.map((p) => p.x).filter(Number.isFinite);
    const ys = points.map((p) => p.y).filter(Number.isFinite);
    if (xs.length === 0 || ys.length === 0) return undefined;
    const pad = (lo: number, hi: number, log?: boolean) => {
      if (log) return [lo * 0.8, hi * 1.25] as const;
      const s = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
      return [lo - s, hi + s] as const;
    };
    const [x0, x1] = pad(Math.min(...xs), Math.max(...xs), xAxis.log);
    const [y0, y1] = pad(Math.min(...ys), Math.max(...ys), yAxis.log);
    const tx = (v: number) => (xAxis.log ? Math.log10(v) : v);
    const ty = (v: number) => (yAxis.log ? Math.log10(v) : v);
    const sx = (v: number) =>
      M.l + ((tx(v) - tx(x0)) / (tx(x1) - tx(x0) || 1)) * (W - M.l - M.r);
    const sy = (v: number) =>
      H - M.b - ((ty(v) - ty(y0)) / (ty(y1) - ty(y0) || 1)) * (H - M.t - M.b);
    return {
      sx,
      sy,
      xt: xAxis.log ? logTicks(x0, x1) : niceTicks(x0, x1, compact ? 5 : 7),
      yt: yAxis.log ? logTicks(y0, y1) : niceTicks(y0, y1, compact ? 4 : 6),
    };
  }, [points, xAxis.log, yAxis.log, W, H, M.l, M.r, M.t, M.b, compact]);

  if (!plot) {
    return <div className="chart-empty">No plottable values for these axes.</div>;
  }

  const hovered = points.find((p) => p.id === hover);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label={`${yAxis.label} vs ${xAxis.label}`}
      >
        <rect
          x={M.l}
          y={M.t}
          width={W - M.l - M.r}
          height={H - M.t - M.b}
          className="chart-frame"
        />
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
          {xAxis.label}
        </text>
        <text
          x={12}
          y={M.t + (H - M.t - M.b) / 2}
          className="chart-axis"
          textAnchor="middle"
          transform={`rotate(-90 12 ${M.t + (H - M.t - M.b) / 2})`}
        >
          {yAxis.label}
        </text>

        {/* muted sort first so live points draw on top */}
        {points
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => Number(b.muted ?? false) - Number(a.muted ?? false))
          .map((p) => {
            const r = p.selected ? (compact ? 6 : 8) : hover === p.id ? (compact ? 5.5 : 7) : compact ? 4 : 5.5;
            return (
              <g
                key={p.id}
                className={`chart-pt ${p.muted ? "muted" : ""} ${p.selected ? "sel" : ""}`}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover((h) => (h === p.id ? undefined : h))}
                onClick={() => onPick?.(p.id)}
                style={{ cursor: onPick ? "pointer" : "default" }}
              >
                {(p.selected || hover === p.id) && !p.muted && (
                  <circle cx={plot.sx(p.x)} cy={plot.sy(p.y)} r={r + 5} fill="none" stroke={p.color} opacity={0.4} />
                )}
                <circle
                  cx={plot.sx(p.x)}
                  cy={plot.sy(p.y)}
                  r={r}
                  fill={p.muted ? "transparent" : p.color}
                  stroke={p.color}
                  strokeWidth={p.muted ? 1 : 0}
                  opacity={p.muted ? 0.3 : 0.92}
                />
                {!compact && !p.muted && (
                  <text x={plot.sx(p.x) + r + 4} y={plot.sy(p.y) + 3} className="chart-label" fill={p.color}>
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
      <div className="chart-readout mono">
        {hovered
          ? `${hovered.label}${hovered.sub ? ` · ${hovered.sub}` : ""} — ${xAxis.label}: ${fmtTick(hovered.x)} · ${yAxis.label}: ${fmtTick(hovered.y)}`
          : "hover a point to inspect · click to open"}
      </div>
      {footnote && <div className="chart-foot">{footnote}</div>}
    </div>
  );
}
