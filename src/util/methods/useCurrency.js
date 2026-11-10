import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRate, BASE_CURRENCY } from '../fx.js';
import { currencies, currencyForCountry, DEFAULT_CURRENCY } from '../currencies.js';
import { getCountry, subscribeCountry, whenCountryKnown } from '../userCountry.js';
import { timezoneCountry } from '../timezoneCountry.js';

const BASE_SYMBOL = '৳';

// ─── Automatic vs. manual currency ──────────────────────────────
// Automatic (default): the currency follows the user's country (GPS, else the
// phone's time zone); US Dollar only when that country's currency isn't in
// the list, or no country is known at all. Picking a currency in Settings makes it
// manual, and location no longer changes it until "Automatic" is chosen again.
const MODE_KEY = 'currencyMode'; // 'auto' | 'manual'
const changeListeners = new Set();

// fn() runs whenever the saved currency or its mode changes.
export const onCurrencyChange = fn => {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
};
const emitChange = () => changeListeners.forEach(fn => fn());

// Before modes existed, a saved currency could only come from the user's own pick.
export const isManualCurrency = async () => {
  const mode = await AsyncStorage.getItem(MODE_KEY);
  if (mode) return mode === 'manual';
  return !!(await AsyncStorage.getItem('selectedCurrency'));
};

export const setManualCurrency = async item => {
  await AsyncStorage.multiSet([['selectedCurrency', JSON.stringify(item)], [MODE_KEY, 'manual']]);
  emitChange();
};

// Follow the country again (or USD if it isn't known yet).
export const setAutoCurrency = async () => {
  await AsyncStorage.setItem(MODE_KEY, 'auto');
  await whenCountryKnown();
  await applyAutoCurrency(getCountry(), true);
};

const applyAutoCurrency = async (country, force = false) => {
  try {
    if (await isManualCurrency()) return;
    // No country yet: go by the phone's time zone rather than saving USD and
    // switching a moment later (the "$ then ฿" flash).
    const where = country || timezoneCountry()?.code;
    if (!where) return;
    const item = currencyForCountry(where);
    const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
    if (saved?.code === item.code && !force) return;
    await AsyncStorage.multiSet([['selectedCurrency', JSON.stringify(item)], [MODE_KEY, 'auto']]);
    emitChange();
  } catch (e) {
    console.warn('Automatic currency update failed', e);
  }
};

subscribeCountry(country => { applyAutoCurrency(country); });

// The currency to use when nothing is saved yet: the one for the country
// already known (else the phone's time zone), so a Thai phone starts in baht
// rather than showing dollars until location answers. USD only when no
// country can be told at all.
export const savedOrDefaultCurrency = async () => {
  const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
  if (saved) return saved;
  const country = getCountry() || timezoneCountry()?.code;
  return country ? currencyForCountry(country) : DEFAULT_CURRENCY;
};

// The app currency as last read, shared by every form: a form opened later
// starts with the right symbol instead of a placeholder that then changes.
let known = null; // { code, symbol }
const readKnown = async () => {
  try {
    const saved = await savedOrDefaultCurrency();
    const code = saved.code || BASE_CURRENCY;
    known = { code, symbol: saved.symbol || symbolFor(code) };
  } catch (e) {
    console.warn('Saved currency unavailable', e);
  }
  return known;
};
// Read once at start-up and after every change, before any form opens.
readKnown();
changeListeners.add(() => { readKnown(); });

// ─── Money on records ───────────────────────────────────────────
// Every fuel log and service stores the amount exactly as it was typed plus
// the code of the currency it was typed in (`currency`). Saved amounts are
// NEVER converted: a record entered as ₹ 1,500 shows ₹ 1,500.00 forever,
// whatever the app currency is later switched to. Records saved before this
// field existed hold amounts in BASE_CURRENCY, so that is their currency.
//
// Only totals across records (Dashboard) may mix currencies; those convert the
// foreign records at today's rate for that view alone (see convertRecords).

export const symbolFor = code =>
  currencies.find(c => c.code === code)?.symbol || code || BASE_SYMBOL;

/** The currency a stored record's amounts are in. */
export const recordCurrency = record => record?.currency || BASE_CURRENCY;

/** Formats an amount stored on `record`, in that record's own currency. */
export const formatRecordMoney = (record, value) =>
  formatMoney(value, symbolFor(recordCurrency(record)));

// The app currency for NEW entries and for totals: { code, symbol, ready }.
// No exchange rate is involved, so it never waits on the network. `ready`
// turns true once the saved choice has been read.
//
// `lock` (pass the form's open flag): once ready, ignore currency changes
// until the form closes. Otherwise an automatic switch (e.g. a location fix
// arriving) mid-entry would stamp a number typed as taka with dollars.
export const useCurrency = (reloadKey, { lock = false } = {}) => {
  // Start from the currency already read at launch, so the label is right on
  // the first frame. Only if it hasn't been read yet is the symbol left blank
  // (never a wrong one) until it is.
  const [currency, setCurrency] = useState(() =>
    known ? { ...known, ready: true } : { code: BASE_CURRENCY, symbol: '', ready: false });
  const [changes, setChanges] = useState(0);
  const lockRef = useRef(lock);
  lockRef.current = lock;
  const readyRef = useRef(false);
  readyRef.current = currency.ready;

  useEffect(
    () => onCurrencyChange(() => {
      if (lockRef.current && readyRef.current) return;
      setChanges(n => n + 1);
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const read = await readKnown();
      const next = read ? { ...read, ready: true } : { code: BASE_CURRENCY, symbol: BASE_SYMBOL, ready: true };
      if (cancelled) return;
      // Keep the same object when nothing changed so dependents don't re-run.
      setCurrency(prev =>
        prev.ready && prev.code === next.code && prev.symbol === next.symbol ? prev : next,
      );
    })();
    return () => { cancelled = true; };
  }, [reloadKey, changes]);

  return currency;
};

// Form text → number to save, or null when empty / not a number.
export const parseAmount = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

// Stored number → form text, unchanged (no rounding, no conversion).
export const amountText = value => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
  return String(n);
};

// The one money format used app-wide: thousands separators and two fixed
// decimals, e.g. "৳ 5,062.50". `value` must already be in the currency of
// `symbol`; this never converts.
export const formatMoney = (value, symbol) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const text = safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol} ${text}` : text;
};

const MONEY_FIELDS = ['totalCost', 'pricePerLiter'];

/**
 * For totals only: `records` with their money fields expressed in `toCode`.
 * Records already in `toCode` are returned untouched (exact). Others are
 * converted at today's rate into a COPY — nothing is ever written back.
 * Records whose rate can't be loaded are left out and counted in `skipped`.
 * Resolves { records, converted, skipped }.
 */
export const convertRecords = async (records, toCode) => {
  const codes = [...new Set(records.map(recordCurrency))].filter(c => c !== toCode);
  const rates = {};
  await Promise.all(codes.map(async from => {
    try {
      const rate = await getRate(from, toCode);
      if (typeof rate === 'number' && rate > 0) rates[from] = rate;
    } catch (e) {
      console.warn(`No ${from}→${toCode} rate; leaving those records out of totals`, e);
    }
  }));
  let converted = 0;
  let skipped = 0;
  const out = [];
  records.forEach(r => {
    const from = recordCurrency(r);
    if (from === toCode) { out.push(r); return; }
    const rate = rates[from];
    if (!rate) { skipped += 1; return; }
    converted += 1;
    const copy = { ...r, currency: toCode };
    MONEY_FIELDS.forEach(k => {
      if (r[k] !== null && r[k] !== undefined && r[k] !== '' && Number.isFinite(Number(r[k]))) {
        copy[k] = Number(r[k]) * rate;
      }
    });
    out.push(copy);
  });
  return { records: out, converted, skipped };
};
