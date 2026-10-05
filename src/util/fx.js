import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_API = 'https://api.frankfurter.dev/v2/rates';

// The currency your stored figures (Dashboard data, etc.) are authored in.
export const BASE_CURRENCY = 'BDT';

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h — rates don't move enough intraday to refetch on every focus

/**
 * Rate from base -> quote. 1 unit of base = <rate> units of quote.
 * Cached in AsyncStorage so screen focus doesn't hammer the API.
 */
export async function getRate(base, quote) {
  if (!quote || base === quote) return 1;

  const cacheKey = `fxRate:${base}:${quote}`;
  let staleRate;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { rate, ts } = JSON.parse(cached);
      if (typeof rate === 'number' && rate > 0) {
        if (Date.now() - ts < CACHE_TTL) return rate;
        staleRate = rate;
      }
    }
  } catch (_) {}

  try {
    const res = await fetch(`${RATES_API}?base=${base}&quotes=${quote}`);
    if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);

    const data = await res.json();           // [{ date, base, quote, rate }]
    const rate = Array.isArray(data) ? data[0]?.rate : undefined;
    if (typeof rate !== 'number' || rate <= 0) throw new Error('Rate not found in response');

    AsyncStorage.setItem(cacheKey, JSON.stringify({ rate, ts: Date.now() })).catch(() => {});
    return rate;
  } catch (e) {
    // Offline / API down: an old rate is far better than none — callers that
    // get no rate fall back to the base currency entirely.
    if (staleRate) return staleRate;
    throw e;
  }
}

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