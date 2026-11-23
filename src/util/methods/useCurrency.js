import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_CURRENCY } from '../fx.js';
import { localNumber } from '../../i18n';
import {
  currencyForCountry,
  defaultCurrency,
  findCurrency,
  findCurrencyByIndex,
  indexForCode,
  loadCurrencies,
  onCurrenciesChange,
} from '../currencies.js';
import { getCountry, subscribeCountry, whenCountryKnown } from '../userCountry.js';
import { timezoneCountry } from '../timezoneCountry.js';
import { EVENTS, setUserProps, track } from '../analytics';

const BASE_SYMBOL = '৳';

// ─── Automatic vs. manual currency ──────────────────────────────
// Automatic (default): the currency follows the country of the phone's time
// zone; US Dollar only when that country's currency isn't in the list, or no
// country is known at all. Picking a currency in Settings makes it manual, and
// the time zone no longer changes it until "Automatic" is chosen again.
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
  track(EVENTS.CURRENCY_CHANGED, { mode: 'manual', currency: item?.code });
  setUserProps({ currency: item?.code, currency_mode: 'manual' });
  emitChange();
};

// The account's saved currency (from the database) on this phone. Quiet: no
// analytics event, and nothing happens when it is already the one in use.
export const applyAccountCurrency = async code => {
  // A code only the database list has: wait for it before giving up.
  let item = findCurrency(code);
  if (!item) {
    await loadCurrencies();
    item = findCurrency(code);
  }
  if (!item) return false;
  const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
  if (saved?.code === code && (await isManualCurrency())) return true;
  await AsyncStorage.multiSet([['selectedCurrency', JSON.stringify(item)], [MODE_KEY, 'manual']]);
  emitChange();
  return true;
};

// Follow the country again (or USD if it isn't known yet).
export const setAutoCurrency = async () => {
  await AsyncStorage.setItem(MODE_KEY, 'auto');
  track(EVENTS.CURRENCY_CHANGED, { mode: 'auto' });
  setUserProps({ currency_mode: 'auto' });
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
// The database list can map a country to a different currency than the
// built-in one; follow it once it arrives (automatic mode only).
onCurrenciesChange(() => { applyAutoCurrency(getCountry()); });
loadCurrencies();
// Applies the time-zone country (and so the automatic currency) at start-up.
whenCountryKnown();

// The currency to use when nothing is saved yet: the one for the country
// already known (else the phone's time zone), so a Thai phone starts in baht
// rather than showing dollars first. USD only when no
// country can be told at all.
export const savedOrDefaultCurrency = async () => {
  const saved = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
  if (saved) return saved;
  const country = getCountry() || timezoneCountry()?.code;
  return country ? currencyForCountry(country) : defaultCurrency();
};

// The app currency as last read, shared by every form: a form opened later
// starts with the right symbol instead of a placeholder that then changes.
let known = null; // { code, symbol, index }
const readKnown = async () => {
  try {
    const saved = await savedOrDefaultCurrency();
    const code = saved.code || BASE_CURRENCY;
    // A choice saved before currencies had an index gets it from its code.
    const index = Number.isInteger(saved.index) ? saved.index : indexForCode(code);
    known = { code, symbol: saved.symbol || symbolFor(code), index };
  } catch (e) {
    console.warn('Saved currency unavailable', e);
  }
  return known;
};
// Read once at start-up and after every change, before any form opens.
readKnown();
changeListeners.add(() => { readKnown(); });

// ─── Money on records ───────────────────────────────────────────
// Every cost record (service, fuel log) keeps the currency it was entered in
// as `selected_currency`: the index of that currency (util/currencies.js).
// Adding or editing a record saves the currency selected in Settings.
// Amounts are never converted. A record in another currency than the
// selected one shows its own symbol, is left out of every total, and its
// edit form asks for the amount in the selected currency. A record without
// `selected_currency` (saved before it existed and not yet initialised) is
// in the selected currency.

export const symbolFor = code =>
  findCurrency(code)?.symbol || code || BASE_SYMBOL;

/** The index of the currency selected in Settings, or null before it is read. */
export const currentCurrencyIndex = () =>
  known ? (indexForCode(known.code) ?? known.index ?? null) : null;

/** { code, symbol, index } of the currency selected in Settings. */
export const currentCurrency = () => ({
  code: known?.code || BASE_CURRENCY,
  symbol: known?.symbol || symbolFor(known?.code || BASE_CURRENCY),
  index: currentCurrencyIndex(),
});

/** The fields saved on a cost record entered in currency `code`. */
export const currencyFields = code => ({
  currency: code,
  selected_currency: indexForCode(code),
});

/** The record's `selected_currency`, or null when it has none. */
export const recordCurrencyIndex = record => {
  const n = record?.selected_currency;
  return Number.isInteger(n) ? n : null;
};

/** True when the record's amounts are in the currency selected in Settings. */
export const isInCurrentCurrency = record => {
  const idx = recordCurrencyIndex(record);
  if (idx === null) return true;
  const current = currentCurrencyIndex();
  return current === null || idx === current;
};

/** { code, symbol, index } a stored record's amounts are in. */
export const recordCurrencyInfo = record => {
  if (isInCurrentCurrency(record)) return currentCurrency();
  const idx = recordCurrencyIndex(record);
  const c = findCurrencyByIndex(idx);
  const code = c?.code || record?.currency || '';
  // Unknown currency (index not in the list, no code saved): '?', never the
  // base currency's symbol, which would pass it off as that currency.
  return { code, symbol: c?.symbol || (code ? symbolFor(code) : '?'), index: idx };
};

/** The currency code a stored record's amounts are in. */
export const recordCurrency = record => recordCurrencyInfo(record).code;

/** Formats an amount stored on `record`, with that record's currency symbol. */
export const formatRecordMoney = (record, value) =>
  formatMoney(value, recordCurrencyInfo(record).symbol);

/**
 * An amount on a record's detail view, in the currency selected now: a record
 * saved in another currency counts for nothing, so it shows 0 ("¥ 0.00"); its
 * saved amount is in the warning above it (RecordCurrencyNotice).
 */
export const formatCountedMoney = (record, value) =>
  formatMoney(isInCurrentCurrency(record) ? value : 0, currentCurrency().symbol);

/**
 * Records for cost statistics: those in another currency than the selected
 * one count for nothing (cost 0). Fuel logs are kept, not dropped, so their
 * litres and odometer still count for distance and economy.
 */
export const costsInCurrentCurrency = records => {
  const { code, index } = currentCurrency();
  return (records || []).map(r => (isInCurrentCurrency(r) ? r : {
    ...r,
    totalCost: 0,
    pricePerLiter: 0,
    currency: code,
    selected_currency: index,
    otherCurrency: true,
  }));
};

/** How many records are in another currency than the selected one. */
export const countOtherCurrency = records =>
  (records || []).filter(r => !isInCurrentCurrency(r)).length;

// The app currency for NEW entries and for totals: { code, symbol, ready }.
// It never waits on the network. `ready`
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
    known ? { ...known, ready: true } : { code: BASE_CURRENCY, symbol: '', index: null, ready: false });
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
      const next = read ? { ...read, ready: true } : { code: BASE_CURRENCY, symbol: BASE_SYMBOL, index: indexForCode(BASE_CURRENCY), ready: true };
      if (cancelled) return;
      // Keep the same object when nothing changed so dependents don't re-run.
      setCurrency(prev =>
        prev.ready && prev.code === next.code && prev.symbol === next.symbol && prev.index === next.index ? prev : next,
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
  const text = localNumber(safe, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol} ${text}` : text;
};
