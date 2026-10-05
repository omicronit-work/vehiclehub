import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRate, BASE_CURRENCY } from '../fx.js';

const BASE_SYMBOL = '৳';

// The user's display currency plus the BASE_CURRENCY -> display rate.
// Amounts are stored in BASE_CURRENCY: divide typed input by fxRate before
// saving, multiply stored values by fxRate before showing them. If the rate
// can't be fetched, falls back to the base currency for BOTH symbol and rate,
// so what's shown and what's saved never disagree. `ready` turns true once the
// first lookup has settled — forms prefilled from stored amounts wait for it.
export const useCurrency = (reloadKey) => {
  const [currency, setCurrency] = useState({ symbol: BASE_SYMBOL, fxRate: 1, ready: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = { symbol: BASE_SYMBOL, fxRate: 1, ready: true };
      try {
        const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
        const code = saved?.code || BASE_CURRENCY;
        if (code !== BASE_CURRENCY) {
          const rate = await getRate(BASE_CURRENCY, code);
          if (typeof rate === 'number' && rate > 0) {
            next = { symbol: saved?.symbol || code, fxRate: rate, ready: true };
          }
        }
      } catch (e) {
        console.warn('FX rate unavailable, using base currency', e);
      }
      if (cancelled) return;
      // Keep the same object when nothing changed so dependents don't re-run.
      setCurrency(prev =>
        prev.ready && prev.symbol === next.symbol && prev.fxRate === next.fxRate ? prev : next,
      );
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return currency;
};

// Round-trip helpers so the conversion direction lives in one place.
export const toBaseAmount = (displayValue, fxRate) => {
  const n = parseFloat(displayValue);
  return Number.isFinite(n) ? n / (fxRate || 1) : null;
};

export const toDisplayAmount = (baseValue, fxRate) => {
  const n = Number(baseValue);
  if (baseValue === null || baseValue === undefined || baseValue === '' || !Number.isFinite(n)) return '';
  return String(Math.round(n * (fxRate || 1) * 100) / 100);
};
