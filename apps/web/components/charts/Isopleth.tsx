"use client";

import { useMemo, useState } from "react";
import { fmtTick, niceTicks } from "./axes";

/**
 * Isopleth region map (B-503): phase-set cells on a composition-vs-T grid,
 * with bisection-refined boundary marks. Each distinct phase SET gets a
 * stable color; hovering reads the set at a cell. Cell size IS the map's
 * resolution — this is a sampled map, not a computed phase-boundary
 * diagram, and the footnote says so.
 */

export interface IsoplethBoundary {
  xWt: number;
  tC: number;
  below: string[];
  above: string[];
}

export function IsoplethChart({
  xs,
  tCs,
  columns,
  boundaries,
  xLabel,
  footnote,
}: {
  xs: number[];
  tCs: number[];
  /** columns[ix][iT] = sorted phase names; undefined column = not yet computed. */
  columns: (string[][] | undefined)[];
  boundaries: IsoplethBoundary[];
  xLabel: string;
  footnote?: string;
}) {
  const [hover, setHover] = useState<{ ix: number; iT: number } | null>(null);
  const W = 680;
  const H = 400;
  const M = { l: 56, r: 14, t: 12, b: 40 };

  const sets = useMemo(() => {
    const order: string[] = [];
    for (const col of columns) {
      if (!col) continue;
      for (const cell of col) {
        const sig = cell.join(" + ");
        if (sig && !order.includes(sig)) order.push(sig);
      }
    }
    return order;
  }, [columns]);

  const colorOf = (sig: string): string => {
    const i = sets.indexOf(sig);
    if (i < 0) return "transparent";
    // Distinct stable hues; explicit colors so both themes read the same map.
    return `hsl(${(i * 67 + 210) % 360} 60% 46% / 0.60)`;
  };

  if (xs.length < 2 || tCs.length < 2) return <div className="chart-empty">No map yet.</div>;

  const x0 = xs[0]!;
  const x1 = xs[xs.length - 1]!;
  const t0 = tCs[0]!;
  const t1 = tCs[tCs.length - 1]!;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - t0) / (t1 - t0 || 1)) * (H - M.t - M.b);
  const cw = (W - M.l - M.r) / xs.length;
  const ch = (H - M.t - M.b) / tCs.length;

  const hoverCell =
    hover && columns[hover.ix] ? columns[hover.ix]![hover.iT] : undefined;

  // Region labels: connected components (4-neighbor) of same-set cells.
  // Components big enough get labeled in place — the full set text when it
  // fits, else a compact [n] marker keyed in the legend.
  const regions = useMemo(() => {
    const sig = (ix: number, iT: number): string | undefined => {
      const col = columns[ix];
      if (!col) return undefined;
      const s = col[iT]?.join(" + ");
      return s || undefined;
    };
    const seen = new Set<string>();
    const out: { sig: string; cells: [number, number][] }[] = [];
    for (let ix = 0; ix < xs.length; ix++) {
      for (let iT = 0; iT < tCs.length; iT++) {
        const key = `${ix},${iT}`;
        if (seen.has(key)) continue;
        const s = sig(ix, iT);
        if (!s) continue;
        const cells: [number, number][] = [];
        const stack: [number, number][] = [[ix, iT]];
        seen.add(key);
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          cells.push([cx, cy]);
          for (const [nx, ny] of [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ] as const) {
            const nkey = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= xs.length || ny >= tCs.length || seen.has(nkey)) continue;
            if (sig(nx, ny) === s) {
              seen.add(nkey);
              stack.push([nx, ny]);
            }
          }
        }
        out.push({ sig: s, cells });
      }
    }
    return out.filter((r) => r.cells.length >= 3);
  }, [columns, xs, tCs]);

  // Boundary polylines: chain refined points that share the same set pair
  // across neighboring columns; isolated points stay dots.
  const boundaryChains = useMemo(() => {
    const groups = new Map<string, IsoplethBoundary[]>();
    for (const b of boundaries) {
      const key = `${b.below.join("+")}|${b.above.join("+")}`;
      const arr = groups.get(key) ?? [];
      arr.push(b);
      groups.set(key, arr);
    }
    const dx = xs.length > 1 ? Math.abs(xs[1]! - xs[0]!) : 1;
    const dT = tCs.length > 1 ? Math.abs(tCs[1]! - tCs[0]!) : 1;
    const chains: IsoplethBoundary[][] = [];
    for (const pts of groups.values()) {
      const sorted = [...pts].sort((a, b) => a.xWt - b.xWt);
      let chain: IsoplethBoundary[] = [];
      for (const p of sorted) {
        const prev = chain[chain.length - 1];
        if (prev && (p.xWt - prev.xWt > 1.5 * dx || Math.abs(p.tC - prev.tC) > 2.5 * dT)) {
          chains.push(chain);
          chain = [];
        }
        chain.push(p);
      }
      if (chain.length > 0) chains.push(chain);
    }
    return chains;
  }, [boundaries, xs, tCs]);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Phase-set map: T vs ${xLabel}`}>
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} className="chart-frame" />
        {columns.map((col, ix) =>
          col
            ? col.map((cell, iT) => {
                const sig = cell.join(" + ");
                return (
                  <rect
                    key={`${ix}-${iT}`}
                    x={sx(xs[ix]!) - cw / 2}
                    y={sy(tCs[iT]!) - ch / 2}
                    width={cw + 0.5}
                    height={ch + 0.5}
                    fill={sig ? colorOf(sig) : "transparent"}
                    stroke={hover?.ix === ix && hover?.iT === iT ? "var(--ink)" : "none"}
                    strokeWidth={1}
                    onMouseEnter={() => setHover({ ix, iT })}
                    onMouseLeave={() => setHover((h) => (h?.ix === ix && h?.iT === iT ? null : h))}
                  >
                    {!sig && <title>infeasible / not bracketed</title>}
                  </rect>
                );
              })
            : null,
        )}
        {boundaryChains.map((chain, i) =>
          chain.length >= 2 ? (
            <polyline
              key={`bl${i}`}
              className="iso-boundary-line"
              points={chain.map((b) => `${sx(b.xWt).toFixed(1)},${sy(b.tC).toFixed(1)}`).join(" ")}
            />
          ) : (
            <circle key={`bd${i}`} cx={sx(chain[0]!.xWt)} cy={sy(chain[0]!.tC)} r={1.6} className="iso-boundary" />
          ),
        )}
        {regions.map((r, i) => {
          const cxs = r.cells.map(([ix]) => sx(xs[ix]!));
          const cys = r.cells.map(([, iT]) => sy(tCs[iT]!));
          const cx = cxs.reduce((s, v) => s + v, 0) / cxs.length;
          const cy = cys.reduce((s, v) => s + v, 0) / cys.length;
          const widthPx = Math.max(...cxs) - Math.min(...cxs) + cw;
          const idx = sets.indexOf(r.sig) + 1;
          const fits = r.sig.length * 5.2 <= widthPx && Math.max(...cys) - Math.min(...cys) + ch >= 11;
          return (
            <text key={`rl${i}`} x={cx} y={cy + 3} className="iso-region-label" textAnchor="middle">
              {fits ? r.sig : `[${idx}]`}
            </text>
          );
        })}
        {niceTicks(x0, x1, 7).map((v) => (
          <g key={`x${v}`}>
            <text x={sx(v)} y={H - M.b + 14} className="chart-tick" textAnchor="middle">
              {fmtTick(v)}
            </text>
          </g>
        ))}
        {niceTicks(t0, t1, 6).map((v) => (
          <text key={`y${v}`} x={M.l - 6} y={sy(v) + 3} className="chart-tick" textAnchor="end">
            {fmtTick(v)}
          </text>
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
          T (°C)
        </text>
      </svg>
      <div className="chart-legend">
        {sets.map((sig, i) => (
          <span key={sig} className="legend-item">
            <span className="legend-dot" style={{ background: colorOf(sig) }} />
            <span className="mono dim2">[{i + 1}]</span> {sig}
          </span>
        ))}
      </div>
      <div className="chart-readout mono">
        {hover && hoverCell
          ? `${fmtTick(xs[hover.ix]!)} wt% · ${tCs[hover.iT]!.toFixed(0)} °C — ${hoverCell.join(" + ") || "infeasible"}`
          : "hover a cell to read its phase set · dots are bisection-refined boundaries"}
      </div>
      {footnote && <div className="chart-foot">{footnote}</div>}
    </div>
  );
}
