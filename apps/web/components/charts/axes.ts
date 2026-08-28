/** Shared axis helpers for the plot kit (B-201). */

export function niceTicks(min: number, max: number, target = 6): number[] {
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

export function fmtTick(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  // k-abbreviate only from 10 000 up: temperatures live in 1 000–2 000 °C,
  // where one-decimal "1.4k" collapses neighboring ticks into duplicates.
  if (a >= 10000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (a < 1) return v.toFixed(2);
  return `${Number(v.toPrecision(4))}`;
}
