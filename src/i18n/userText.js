import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeTextTranslator from '../../specs/NativeTextTranslator';
import { getLanguage, subscribeLanguage } from './index';
import { spellLetters } from './models';
import { getCurrencies, onCurrenciesChange } from '../util/currencies';

/*
 * Text the user typed (a service called "Front bumper repair", notes, shop
 * and station names…) shown in the app language, translated on the phone by
 * ML Kit (specs/NativeTextTranslator). Display only: records keep what was
 * typed, so changing the language later translates from the original again.
 *
 * AppText runs every string it draws through translateText(): the app's own
 * text is already in the app language and is left alone (ML Kit says so),
 * anything in another language is translated. Results arrive a moment later;
 * AppText re-renders then. Translations are kept on the phone per language.
 *
 * In languages with their own script (Bangla, Thai…) only the Latin-letter
 * parts are translated, so "মুছুন Front bumper repair?" becomes all Bangla;
 * whatever is still in Latin letters after that (codes, names, made-up words:
 * "Reg1", "Rego") is written by sound in the script ("রেগ১", "রেগো").
 */

// App languages, as ML Kit's tags.
const MLKIT = { en: 'en', bn: 'bn', th: 'th', ms: 'ms', de: 'de', es: 'es' };
// Languages written in Latin letters: there, a whole string is checked.
const LATIN = new Set(['en', 'ms', 'de', 'es']);
// Close enough that ML Kit mixes them up: treat as the same language.
const SAME = { ms: ['id'] };
// Languages in another script, with the ICU transform that writes Latin text
// in it by sound.
const SCRIPT = { bn: 'Latin-Bengali', th: 'Latin-Thai' };
// Units are left to AppText, which writes them in the language (km → কিমি).
const UNITS = /^(km|mi|kg|kWh|L|ml|cc|AM|PM|am|pm)$/;
// Names kept exactly as written, whatever the language.
const KEEP = /^(VehicleHub)$/;

// Models (~30 MB a language) download on any connection, once.
const WIFI_ONLY = false;
const MAX_CACHED = 4000;
const CONCURRENT = 2;

const SKIP_RE = /@|:\/\/|www\./;

// Currency symbols written with Latin letters (A$, HK$, E£, RM, Rs, Fr, kr…)
// stay exactly as written everywhere: never translated or written by sound.
// One with a sign in it (A$) is always a symbol; one of letters only (RM, R)
// counts as a symbol when it stands alone or next to a figure ("RM 25").
const LETTER_ONLY = /^[A-Za-zÀ-ÿłŁ]+$/;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Rebuilt when the currency list arrives from the database.
let CURRENCY_RE;
const buildCurrencyRe = () => {
  const symbols = [...new Set(getCurrencies().map(c => c.symbol))]
    .filter(s => /[A-Za-zÀ-ÿłŁ]/.test(s))
    .sort((a, b) => b.length - a.length);
  CURRENCY_RE = new RegExp(
    `(^|[^A-Za-zÀ-ÿłŁ])(${symbols.map(escapeRe).join('|')})(?![A-Za-zÀ-ÿłŁ])`,
    'g',
  );
};
buildCurrencyRe();
onCurrenciesChange(buildCurrencyRe);
const FIGURE = /[0-9০-৯๐-๙]/;

const isCurrencyAt = (text, symbol, start) => {
  if (!LETTER_ONLY.test(symbol)) return true;
  if (text.trim() === symbol) return true;
  // The character next to it, past at most one space: "RM25", "RM 25", "25 RM".
  const before = text.slice(0, start).replace(/ $/, '').slice(-1);
  const after = text.slice(start + symbol.length).replace(/^ /, '').charAt(0);
  return FIGURE.test(before) || FIGURE.test(after);
};

// `fn` applied to the text around any currency symbols, the symbols kept.
const aroundCurrency = (text, fn) => {
  let out = '';
  let last = 0;
  CURRENCY_RE.lastIndex = 0;
  let m;
  while ((m = CURRENCY_RE.exec(text))) {
    const start = m.index + m[1].length;
    if (!isCurrencyAt(text, m[2], start)) continue;
    out += fn(text.slice(last, start)) + m[2];
    last = start + m[2].length;
  }
  return out + fn(text.slice(last));
};
// A run of Latin words: "Front bumper repair", "Shell, Main Road".
const LATIN_RUN = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’&.,\- ]*[A-Za-zÀ-ÿ0-9]|[A-Za-zÀ-ÿ]/g;

let lang = getLanguage();
let cache = new Map(); // piece → translation ('' = keep as typed)
// piece → shown while its translation model is missing (not saved; redone
// once the model is downloaded)
let provisional = new Map();
let loaded = null;
const queue = [];
const queued = new Set();
let running = 0;
let version = 0;
const listeners = new Set();

const LETTER = /[A-Za-zÀ-ÿ]/;
const letterCount = piece => (piece.match(/[A-Za-zÀ-ÿ]/g) || []).length;
// Worth translating: three letters or more and some lowercase (codes, units
// and plates like "LPG", "kWh", "WXY 1234" aren't sent to ML Kit).
const translatable = piece => !!MLKIT[lang] && letterCount(piece) >= 3 && /[a-zà-ÿ]/.test(piece);
// Anything to do at all: in another script any Latin letters (but units).
const worthIt = piece =>
  !SKIP_RE.test(piece) && !UNITS.test(piece) && !KEEP.test(piece) && (SCRIPT[lang] ? LETTER.test(piece) : translatable(piece));

// v5: drops v4's guesses for short Malay-screen text.
// v6: drops caches that got another language's translations (a save that
// ran just after a language change wrote the new language under the old).
const storageKey = code => `userText6:${code}`;

const load = code => {
  AsyncStorage.multiRemove([1, 2, 3, 4, 5].map(v => `userText${v === 1 ? '' : v}:${code}`)).catch(() => {}); // older caches
  loaded = AsyncStorage.getItem(storageKey(code))
    .then(raw => {
      if (code !== lang) return;
      const saved = raw ? JSON.parse(raw) : {};
      Object.entries(saved).forEach(([k, v]) => { if (!cache.has(k)) cache.set(k, v); });
      bump();
    })
    .catch(() => {});
  return loaded;
};

// One pending save per language, each writing that language's own cache: a
// language change before the timer fires must not save the new language's
// translations under the old one (English showing "জন" for "John").
const saveTimers = {};
const save = () => {
  const code = lang;
  const forCache = cache;
  clearTimeout(saveTimers[code]);
  saveTimers[code] = setTimeout(() => {
    delete saveTimers[code];
    const entries = [...forCache.entries()].slice(-MAX_CACHED);
    AsyncStorage.setItem(storageKey(code), JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 2000);
};

let bumpTimer = null;
const bump = () => {
  if (bumpTimer) return;
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    version += 1;
    listeners.forEach(fn => fn());
  }, 120);
};

// Latin runs written by sound in the app's script: short capitals are codes
// and spelled letter by letter ("RS" → "আরএস"), the rest read as words.
const toScript = async text => {
  const parts = text.split(/([A-Za-zÀ-ÿ]+)/);
  const out = await Promise.all(parts.map(async (part, i) => {
    if (i % 2 === 0 || UNITS.test(part) || KEEP.test(part)) return part;
    if (part.length <= 5 && part === part.toUpperCase()) return spellLetters(part, lang);
    try {
      return await NativeTextTranslator.transliterate(part.toLowerCase(), SCRIPT[lang]);
    } catch {
      return spellLetters(part, lang); // before Android 10, or no transform
    }
  }));
  return out.join('');
};

/* ── Offline ──────────────────────────────────────────────────────────
 * Translation runs on the phone, so it works offline once the models are
 * here. They're downloaded ahead of time — the app language's and English
 * (what most text is typed in) — as soon as a language is chosen, and again
 * every RETRY_MS and on each return to the app until they're in. Until then
 * text is still written in the app's script (offline too) and translated
 * properly once the models arrive. A model for another language the user
 * types in is fetched the first time such text appears.
 */
const MODEL_MISSING = 'MODEL_MISSING';
const RETRY_MS = 60 * 1000;
const downloading = new Set(); // model sets being downloaded ("en,bn")
const downloaded = new Set(); // language tags known to be on the phone
let retryTimer = null;

// Resolves true once the models are on the phone, false when that failed.
const downloadModels = languages => {
  const tags = [...new Set(languages)].filter(tag => tag && !downloaded.has(tag));
  if (!tags.length) return Promise.resolve(true);
  const key = tags.sort().join(',');
  if (!NativeTextTranslator?.downloadModels || downloading.has(key)) return Promise.resolve(false);
  downloading.add(key);
  return NativeTextTranslator.downloadModels(tags, WIFI_ONLY)
    .then(() => {
      tags.forEach(tag => downloaded.add(tag));
      // Text shown untranslated for want of these models is done again.
      provisional = new Map();
      bump();
      return true;
    })
    .catch(() => false)
    .finally(() => downloading.delete(key));
};

const prepareOffline = () => {
  const target = MLKIT[lang];
  if (!target) return;
  clearTimeout(retryTimer);
  downloadModels(['en', target]).then(ok => {
    if (!ok) retryTimer = setTimeout(prepareOffline, RETRY_MS);
  });
};

const translate = async piece => {
  const target = MLKIT[lang];
  let source = await NativeTextTranslator.identifyLanguage(piece).catch(() => 'und');
  source = String(source || 'und').split('-')[0];
  // Short Latin text often isn't recognised; in a non-Latin app language it
  // is almost always English.
  if (source === 'und' && !LATIN.has(lang)) source = 'en';
  if (source === 'und' || source === target || (SAME[lang] || []).includes(source)) return '';
  if (!Object.values(MLKIT).includes(source)) return '';
  let out;
  try {
    out = await NativeTextTranslator.translate(piece, source, target, WIFI_ONLY);
  } catch (e) {
    // Text in a language whose model isn't here yet (Thai typed in a Bangla
    // app): fetch it for next time, online or later.
    if (e?.code === MODEL_MISSING) downloadModels([source, target]);
    throw e;
  }
  // Only the case changed ("FZv2" → "FZV2"): not a translation.
  return out && out.toLowerCase() !== piece.toLowerCase() ? out : '';
};

// { out, final }: `final` false when the translation had to be skipped (its
// model isn't on the phone yet) — `out` is then only written in the app's
// script, shown for now and done again once the model is here.
const resolve = async piece => {
  let out = piece;
  let final = true;
  if (translatable(piece)) {
    try {
      out = (await translate(piece)) || piece;
    } catch (e) {
      if (e?.code !== MODEL_MISSING) throw e;
      final = false;
    }
  }
  if (SCRIPT[lang] && LETTER.test(out)) out = await toScript(out);
  return { out: out !== piece ? out : '', final };
};

const pump = () => {
  while (running < CONCURRENT && queue.length) {
    const piece = queue.shift();
    const forLang = lang;
    running += 1;
    resolve(piece)
      .then(({ out, final }) => {
        if (forLang !== lang) return;
        if (final) { cache.set(piece, out); save(); } else provisional.set(piece, out);
        bump();
      })
      // Anything else failed: try again next time it's drawn.
      .catch(() => {})
      .finally(() => { queued.delete(piece); running -= 1; pump(); });
  }
};

const request = piece => {
  if (queued.has(piece)) return;
  queued.add(piece);
  (loaded || Promise.resolve()).then(() => {
    if (cache.has(piece) || provisional.has(piece)) { queued.delete(piece); return; }
    queue.push(piece);
    pump();
  });
};

const lookup = piece => {
  if (!worthIt(piece)) return piece;
  if (cache.has(piece)) return cache.get(piece) || piece;
  if (provisional.has(piece)) return provisional.get(piece) || piece;
  request(piece);
  return piece;
};

/** `text` in the app language when it's known, else as typed (and asked for). */
export const translateText = text => {
  if (typeof text !== 'string' || !text.trim() || !NativeTextTranslator || SKIP_RE.test(text)) return text;
  if (!MLKIT[lang] && !SCRIPT[lang]) return text;
  if (LATIN.has(lang)) {
    const piece = text.trim();
    const out = lookup(piece);
    return out === piece ? text : out;
  }
  return aroundCurrency(text, part => part.replace(LATIN_RUN, run => lookup(run)));
};

/**
 * True while `text` is still waiting for its translation (translateText
 * shows it as typed until then): for text that should appear once, already
 * in the app language, rather than change in front of the user.
 */
export const isTextPending = text => {
  if (typeof text !== 'string' || !text.trim() || !NativeTextTranslator || SKIP_RE.test(text)) return false;
  if (!MLKIT[lang] && !SCRIPT[lang]) return false;
  const pieces = LATIN.has(lang) ? [text.trim()] : text.match(LATIN_RUN) || [];
  return pieces.some(piece => worthIt(piece) && !cache.has(piece) && !provisional.has(piece));
};

/** Same, through React children (strings and arrays of them). */
export const translateChildren = children => {
  if (typeof children === 'string') return translateText(children);
  if (Array.isArray(children)) return children.map(translateChildren);
  return children;
};

const subscribe = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getVersion = () => version;

/** Re-renders when new translations arrive. */
export const useTranslatedText = () => useSyncExternalStore(subscribe, getVersion);

subscribeLanguage(code => {
  lang = code;
  cache = new Map();
  provisional = new Map();
  queue.length = 0;
  queued.clear();
  load(code);
  prepareOffline();
});
load(lang);
prepareOffline();
// Back in the app: a download that failed (offline) is tried again.
AppState.addEventListener('change', state => { if (state === 'active') prepareOffline(); });
