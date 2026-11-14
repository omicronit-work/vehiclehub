import { useEffect, useState } from 'react';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_CODES } from './languages';
import en from './locales/en';

/*
 * App translations.
 *
 *   t('set.title')                      -> "Settings" / "সেটিংস" / ...
 *   t('dlg.currencyTitle', { code })    -> fills {code}
 *
 * The language is the one picked in Settings → Language, else the phone's
 * language when it is one of the 30, else English. A key missing from a
 * language falls back to English, so screens not translated yet still work.
 *
 * Changing the language remounts the navigator (App.jsx keys it on the
 * language), so plain t() calls in render pick up the new language without
 * every component subscribing.
 */

// UI phrases are keyed by their English text (t('Save changes')); the
// locale files hold the older dotted keys (t('set.title')). Both live in one
// lookup table per language.
const withPhrases = (phrases, keyed) => ({ ...phrases, ...keyed });

const LOCALES = {
  en: () => en,
  bn: () => withPhrases(require('./phrases/bn').default, require('./locales/bn').default),
  hi: () => withPhrases(require('./phrases/hi').default, require('./locales/hi').default),
  ur: () => withPhrases(require('./phrases/ur').default, require('./locales/ur').default),
  ne: () => withPhrases(require('./phrases/ne').default, require('./locales/ne').default),
  si: () => withPhrases(require('./phrases/si').default, require('./locales/si').default),
  ta: () => withPhrases(require('./phrases/ta').default, require('./locales/ta').default),
  th: () => withPhrases(require('./phrases/th').default, require('./locales/th').default),
  ms: () => withPhrases(require('./phrases/ms').default, require('./locales/ms').default),
  id: () => withPhrases(require('./phrases/id').default, require('./locales/id').default),
  fil: () => withPhrases(require('./phrases/fil').default, require('./locales/fil').default),
  vi: () => withPhrases(require('./phrases/vi').default, require('./locales/vi').default),
  zh: () => withPhrases(require('./phrases/zh').default, require('./locales/zh').default),
  ja: () => withPhrases(require('./phrases/ja').default, require('./locales/ja').default),
  ko: () => withPhrases(require('./phrases/ko').default, require('./locales/ko').default),
  ar: () => withPhrases(require('./phrases/ar').default, require('./locales/ar').default),
  fa: () => withPhrases(require('./phrases/fa').default, require('./locales/fa').default),
  tr: () => withPhrases(require('./phrases/tr').default, require('./locales/tr').default),
  ru: () => withPhrases(require('./phrases/ru').default, require('./locales/ru').default),
  uk: () => withPhrases(require('./phrases/uk').default, require('./locales/uk').default),
  de: () => withPhrases(require('./phrases/de').default, require('./locales/de').default),
  fr: () => withPhrases(require('./phrases/fr').default, require('./locales/fr').default),
  es: () => withPhrases(require('./phrases/es').default, require('./locales/es').default),
  pt: () => withPhrases(require('./phrases/pt').default, require('./locales/pt').default),
  it: () => withPhrases(require('./phrases/it').default, require('./locales/it').default),
  nl: () => withPhrases(require('./phrases/nl').default, require('./locales/nl').default),
  pl: () => withPhrases(require('./phrases/pl').default, require('./locales/pl').default),
  sv: () => withPhrases(require('./phrases/sv').default, require('./locales/sv').default),
  ro: () => withPhrases(require('./phrases/ro').default, require('./locales/ro').default),
  sw: () => withPhrases(require('./phrases/sw').default, require('./locales/sw').default),
};

const STORAGE_KEY = 'appLanguage';

// Android/old codes and regional variants -> one of our codes.
const ALIASES = { tl: 'fil', in: 'id' };

export const normalizeLanguage = tag => {
  if (!tag) return null;
  const base = String(tag).replace('_', '-').split('-')[0].toLowerCase();
  const code = ALIASES[base] || base;
  return LANGUAGE_CODES.includes(code) ? code : null;
};

// The phone's language, if the app has it.
export const deviceLanguage = () => {
  const tags = [];
  try {
    tags.push(NativeModules.I18nManager?.localeIdentifier);
  } catch {}
  try {
    tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {}
  for (const tag of tags) {
    const code = normalizeLanguage(tag);
    if (code) return code;
  }
  return 'en';
};

let lang = 'en';
let dict = en;
const listeners = new Set();

const apply = code => {
  const next = LANGUAGE_CODES.includes(code) ? code : 'en';
  try {
    dict = LOCALES[next]();
  } catch (e) {
    console.warn('Language unavailable:', next, e?.message || e);
    dict = en;
  }
  if (next === lang) return;
  lang = next;
  listeners.forEach(fn => fn(lang));
};
apply(deviceLanguage());

export const getLanguage = () => lang;

const translationsCache = {};
/**
 * `key` in every app language (English included), e.g. all the names one
 * built-in service type has had. Lets text saved in one language be
 * recognised after the language changes. Cached per key.
 */
export const translationsOf = key => {
  if (!translationsCache[key]) {
    const all = new Set();
    LANGUAGE_CODES.forEach(code => {
      try {
        const text = LOCALES[code]()[key];
        if (text) all.add(text);
      } catch {}
    });
    translationsCache[key] = [...all];
  }
  return translationsCache[key];
};

/** Translated text for `key`, with {placeholders} filled from `params`. */
export const t = (key, params) => {
  const text = dict[key] ?? en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (params[name] != null ? String(params[name]) : m));
};

// Intl locale per app language. English keeps the app's day-month-year form.
const LOCALE_TAGS = { en: 'en-GB', fil: 'fil-PH', zh: 'zh-CN', pt: 'pt-BR', sw: 'sw-KE' };

// Intl tag for the app language: Latin digits (AppText localises them where
// they're drawn) and the Gregorian calendar (Thai would otherwise show 2569).
const intlTag = () => `${LOCALE_TAGS[lang] || lang}-u-nu-latn-ca-gregory`;
const toDate = value => (value instanceof Date ? value : new Date(value));

/**
 * A date in the app language: month names and order follow the language
 * ("13 নভে, 2026", "13 พ.ย. 2026"). `opts` are Intl date options; default
 * "2 Nov 2026". Falls back to English if the device lacks the locale.
 */
export const localDate = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const date = toDate(value);
  if (value == null || Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(intlTag(), opts).format(date);
  } catch {
    return date.toLocaleDateString('en-GB', opts);
  }
};

/** A time of day in the app language ("09:00"). */
export const localTime = (value, opts = { hour: '2-digit', minute: '2-digit' }) => {
  const date = toDate(value);
  if (value == null || Number.isNaN(date.getTime())) return '';
  try {
    // English keeps the 12-hour clock ("1:57 PM") the app has always shown.
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : intlTag(), opts).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', opts);
  }
};

/** "2 Nov 2026" in the app language. */
export const formatDay = value => localDate(value);

const EN_MONTHS = {
  short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const monthCache = {};
const monthList = style => {
  const key = `${lang}:${style}`;
  if (!monthCache[key]) {
    let names = EN_MONTHS[style];
    if (lang !== 'en') {
      try {
        const fmt = new Intl.DateTimeFormat(`${LOCALE_TAGS[lang] || lang}-u-ca-gregory`, { month: style });
        names = names.map((_, i) => fmt.format(new Date(2021, i, 15)));
      } catch {}
    }
    monthCache[key] = names;
  }
  return monthCache[key];
};

/**
 * Month names in the app language as an array-like that always reads the
 * current language, so module-level `const MONTHS = monthNames('short')`
 * stays right after a language change. style: 'short' | 'long'.
 */
export const monthNames = style => new Proxy([], { get: (_, prop) => Reflect.get(monthList(style), prop) });

/** Applies the saved choice (call once at start-up, before the UI shows). */
export const loadSavedLanguage = async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) apply(saved);
  } catch {}
  return lang;
};

/** Picks a language and remembers it. */
export const setLanguage = async code => {
  apply(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {}
};

export const subscribeLanguage = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The current language code; re-renders when it changes. */
export const useLanguage = () => {
  const [code, setCode] = useState(lang);
  useEffect(() => {
    setCode(lang);
    return subscribeLanguage(setCode);
  }, []);
  return code;
};
