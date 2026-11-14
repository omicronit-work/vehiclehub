// The currency records saved before the `currency` field existed are in.
export const BASE_CURRENCY = 'BDT';

/** "Nice" axis (max + step) for a peak value and target tick count. */
export function niceAxis(peak, ticks = 13) {
  if (!peak || peak <= 0) return { max: ticks, step: 1 };
  const rough = peak / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= mag;
  let max = Math.ceil(peak / step) * step;
  if (max <= peak) max += step; // headroom so the tallest bar doesn't touch the top
  return { max, step };
}

/** 70000 -> "70k", 1200 -> "1.2k", 950 -> "950" */
export function shortNumber(value) {
  if (value >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${Math.round(value)}`;
}