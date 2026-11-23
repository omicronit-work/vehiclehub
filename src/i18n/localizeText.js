import { getLanguage } from './index';

/*
 * Display-only localisation of figures: digits in the language's own script
 * and the short units that follow a number (8 L → ৮ লি, 40.6 km/L →
 * ৪০.৬ কিমি/লি). Applied when text is drawn (AppText, chart labels), never
 * to stored values or text inputs, so parsing and saving still see 0-9.
 *
 * Emails, links and hex colour codes (#0E7C7B) are left as they are.
 */

// Zero of each language that writes its own digits in everyday use.
// Thai is deliberately absent: Thai apps (banks, wallets, fuel) show money,
// litres and distances in 0-9, which read faster at a glance, so Thai keeps
// 0-9 everywhere (its units are still written in Thai: กม., ลิตร).
const ZERO = {
  bn: 0x09e6, // ০
};

// Decimal / thousands marks where a language differs from "." and ",".
const SEPARATORS = {};

// Short units after a number. Latin-script languages keep km, L, kg, kWh.
const UNITS = {
  bn: { km: 'কিমি', mi: 'মাইল', L: 'লি', kg: 'কেজি', kWh: 'কি.ও.ঘ' },
  th: { km: 'กม.', mi: 'ไมล์', L: 'ลิตร', kg: 'กก.', kWh: 'kWh' },
};

// A unit after a digit ("8 L"), a slash ("/L", "/ L"), an opening bracket
// ("(L)") or on its own (an input's "km" suffix). Not inside a word.
const UNIT_RE = /(^|\d\s?|\/\s?|\()(kWh|km|mi|kg|L)(?![A-Za-z])/g;
// A hex colour code (#0E7C7B, #0E7C7BFF) is a code, not a number: never localised.
export const HEX_COLOR_RE = /(^|[^0-9A-Za-z])#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Za-z])/;
const SKIP_RE = /@|:\/\/|www\./;

/** True when text in the current language needs any rewriting. */
export const localizesFigures = (lang = getLanguage()) => !!(ZERO[lang] || UNITS[lang]);

/** Digits only: '2023' → '২০২৩'. Separators follow the language. */
export const localizeDigits = (text, lang = getLanguage()) => {
  const zero = ZERO[lang];
  if (!zero || text == null) return text;
  let out = String(text);
  const sep = SEPARATORS[lang];
  if (sep) out = out.replace(/(\d)\.(?=\d)/g, `$1${sep.decimal}`).replace(/(\d),(?=\d)/g, `$1${sep.group}`);
  return out.replace(/[0-9]/g, d => String.fromCharCode(zero + Number(d)));
};

/** Units then digits, for a piece of text about to be shown. */
export const localizeText = (text, lang = getLanguage()) => {
  if (typeof text !== 'string' || !text || SKIP_RE.test(text) || HEX_COLOR_RE.test(text)) return text;
  const units = UNITS[lang];
  let out = text;
  if (units) out = out.replace(UNIT_RE, (m, before, unit) => before + (units[unit] || unit));
  return localizeDigits(out, lang);
};

/** Same, through React children (strings, numbers and arrays of them). */
export const localizeChildren = children => {
  if (typeof children === 'string') return localizeText(children);
  if (typeof children === 'number') return localizeText(String(children));
  if (Array.isArray(children)) return children.map(localizeChildren);
  return children;
};
