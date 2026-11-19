import { useEffect, useState } from 'react';
import { getFirestore, collection } from '@react-native-firebase/firestore';
import { readDocs } from './fastRead';
import CURRENCY_DATA from './currencyData.json';

// ─── Currency list ──────────────────────────────────────────────
// Comes from the shared Firestore `currencies` collection (console-edited,
// see firestore.rules and scripts/seedCurrencies.js). One doc per currency,
// the doc id is the ISO code:
//
//   currencies/BDT  { name: 'Bangladeshi Taka', symbol: '৳', order: 4,
//                     countries: ['BD'], hidden: false }
//
//   name, symbol   required; a doc missing either is skipped
//   order          list position (ascending); docs without it go last, by name
//   countries      ISO country codes whose automatic currency this is
//   hidden         true leaves it out of the list
//
// The built-in copy (currencyData.json) is used until the database answers
// (first launch offline, rules not deployed, an empty collection) and is what
// scripts/seedCurrencies.js uploads. Firestore keeps its own copy on the
// phone, so after the first load the database list is there at once on
// every start.

export const BUILT_IN_CURRENCIES = CURRENCY_DATA.map(({ code, name, symbol }) => ({ code, name, symbol }));

// ISO country -> currency code, for the built-in list.
export const BUILT_IN_COUNTRY_TO_CURRENCY = Object.fromEntries(
  CURRENCY_DATA.flatMap(c => (c.countries || []).map(country => [country, c.code])));

let list = BUILT_IN_CURRENCIES;
let countryMap = BUILT_IN_COUNTRY_TO_CURRENCY;
let fromDatabase = false;
let inflight = null;
const listeners = new Set();

/** The currency list in use right now (the database's once it has loaded). */
export const getCurrencies = () => list;

/** The listed currency with this ISO code, or null. */
export const findCurrency = code => list.find(c => c.code === code) || null;

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
    if (!code || !name || !symbol || data.hidden === true) return;
    const order = hasValue(data.order) && Number.isFinite(Number(data.order))
      ? Number(data.order) : Infinity;
    const countries = Array.isArray(data.countries)
      ? data.countries.map(c => String(c).trim().toUpperCase()).filter(Boolean) : [];
    rows.push({ code, name, symbol, order, countries });
  });
  if (!rows.length) return null;

  rows.sort((a, b) => (a.order === b.order ? 0 : a.order < b.order ? -1 : 1)
    || a.name.localeCompare(b.name));
  const seen = new Set();
  const unique = rows.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  // Countries named on the docs win; the built-in mapping fills the rest,
  // as long as that currency is in the database list.
  const codes = new Set(unique.map(r => r.code));
  const map = Object.fromEntries(
    Object.entries(BUILT_IN_COUNTRY_TO_CURRENCY).filter(([, cur]) => codes.has(cur)));
  unique.forEach(r => r.countries.forEach(c => { map[c] = r.code; }));

  return {
    list: unique.map(({ code, name, symbol }) => ({ code, name, symbol })),
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
