import { useEffect, useState } from 'react';
import { getFirestore, collection } from '@react-native-firebase/firestore';
import { readDocs } from './fastRead';
import CURRENCY_DATA from './currencyData.json';

// ─── Currency list ──────────────────────────────────────────────
// Comes from the shared Firestore `currencies` collection (console-edited,
// see firestore.rules and scripts/seedCurrencies.js). One doc per currency,
// the doc id is the ISO code:
//
//   currencies/BDT  { index: 4, name: 'Bangladeshi Taka', symbol: '৳',
//                     countries: ['BD'], hidden: false }
//
//   index          required, a whole number ≥ 1, unique. It is what the app
//                  saves: the selected currency and every cost record's
//                  `selected_currency` hold it. Never change or reuse one.
//                  Also the list position.
//   name, symbol   required; a doc missing any of the three is skipped
//   countries      ISO country codes whose automatic currency this is
//   hidden         true leaves it out of the picker; records already saved
//                  in it still show its symbol
//
// The built-in copy (currencyData.json) is used until the database answers
// (first launch offline, rules not deployed, an empty collection) and is what
// scripts/seedCurrencies.js uploads. Firestore keeps its own copy on the
// phone, so after the first load the database list is there at once on
// every start.

export const BUILT_IN_CURRENCIES = CURRENCY_DATA.map(({ index, code, name, symbol }) => ({ index, code, name, symbol }));

// ISO country -> currency code, for the built-in list.
export const BUILT_IN_COUNTRY_TO_CURRENCY = Object.fromEntries(
  CURRENCY_DATA.flatMap(c => (c.countries || []).map(country => [country, c.code])));

let list = BUILT_IN_CURRENCIES;
let hiddenList = []; // hidden in the database: not offered, still looked up
let countryMap = BUILT_IN_COUNTRY_TO_CURRENCY;
let fromDatabase = false;
let inflight = null;
const listeners = new Set();

/** The currency list in use right now (the database's once it has loaded). */
export const getCurrencies = () => list;

/** The listed currency with this ISO code, or null. */
export const findCurrency = code => list.find(c => c.code === code) || null;

/** The currency with this index (hidden ones too), or null. */
export const findCurrencyByIndex = index => {
  const n = Number(index);
  if (!Number.isInteger(n)) return null;
  return list.find(c => c.index === n) || hiddenList.find(c => c.index === n)
    || BUILT_IN_CURRENCIES.find(c => c.index === n) || null;
};

/** A currency's index from its code (a saved choice from before indexes). */
export const indexForCode = code =>
  findCurrency(code)?.index ?? hiddenList.find(c => c.code === code)?.index
    ?? BUILT_IN_CURRENCIES.find(c => c.code === code)?.index ?? null;

const USD = BUILT_IN_CURRENCIES.find(c => c.code === 'USD');
/** US Dollar: from the list when it has it, so an edited symbol is used. */
export const defaultCurrency = () => findCurrency('USD') || USD;
// A fixed fallback value, for an initial state before anything is read.
export const DEFAULT_CURRENCY = USD;

// The currency for a country; US Dollar when the country is unknown or its
// currency isn't in the list.
export const currencyForCountry = country =>
  findCurrency(countryMap[country]) || defaultCurrency();

/** fn(list) runs whenever the list changes (the database answered). */
export const onCurrenciesChange = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const hasValue = v => v !== null && v !== undefined && v !== '';

// Firestore docs → { list, countryMap }, or null when nothing usable came back.
export const parseCurrencyDocs = docs => {
  const rows = [];
  docs.forEach(d => {
    const data = d.data() || {};
    const code = String(data.code || d.id || '').trim().toUpperCase();
    const name = String(data.name ?? '').trim();
    const symbol = String(data.symbol ?? '').trim();
    const index = hasValue(data.index) ? Number(data.index) : NaN;
    if (!code || !name || !symbol || !Number.isInteger(index) || index < 1) return;
    const countries = Array.isArray(data.countries)
      ? data.countries.map(c => String(c).trim().toUpperCase()).filter(Boolean) : [];
    rows.push({ index, code, name, symbol, countries, hidden: data.hidden === true });
  });

  rows.sort((a, b) => a.index - b.index);
  // One currency per index and per code: the first (lowest index) wins.
  const seenIndex = new Set();
  const seenCode = new Set();
  const all = rows.filter(r => {
    if (seenIndex.has(r.index) || seenCode.has(r.code)) return false;
    seenIndex.add(r.index);
    seenCode.add(r.code);
    return true;
  });
  const unique = all.filter(r => !r.hidden);
  if (!unique.length) return null;

  // Countries named on the docs win; the built-in mapping fills the rest,
  // as long as that currency is in the database list.
  const codes = new Set(unique.map(r => r.code));
  const map = Object.fromEntries(
    Object.entries(BUILT_IN_COUNTRY_TO_CURRENCY).filter(([, cur]) => codes.has(cur)));
  unique.forEach(r => r.countries.forEach(c => { map[c] = r.code; }));

  const plain = ({ index, code, name, symbol }) => ({ index, code, name, symbol });
  return {
    list: unique.map(plain),
    hidden: all.filter(r => r.hidden).map(plain),
    countryMap: map,
  };
};

/**
 * Loads the list from the database (the phone's copy first when there is
 * one). An empty or failed read keeps the current list and is tried again on
 * the next call.
 */
export const loadCurrencies = () => {
  if (fromDatabase) return Promise.resolve(list);
  if (!inflight) {
    inflight = Promise.resolve()
      .then(() => readDocs(collection(getFirestore(), 'currencies')))
      .then(snapshot => {
        const parsed = parseCurrencyDocs(snapshot?.docs || []);
        if (!parsed) return;
        fromDatabase = true;
        list = parsed.list;
        hiddenList = parsed.hidden;
        countryMap = parsed.countryMap;
        listeners.forEach(fn => fn(list));
      })
      .catch(err => console.log('Error fetching currencies:', err))
      .then(() => list)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/**
 * The currency list for a picker. `active` (pass the picker's open flag)
 * triggers the load, so an earlier failed read is retried when it opens.
 */
export const useCurrencies = (active = true) => {
  const [current, setCurrent] = useState(getCurrencies);

  useEffect(() => onCurrenciesChange(setCurrent), []);

  useEffect(() => {
    if (!active) return;
    setCurrent(getCurrencies());
    loadCurrencies();
  }, [active]);

  return current;
};
