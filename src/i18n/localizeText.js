import { getLanguage } from './index';

/*
 * Display-only localisation of figures: digits in the language's own script
 * and the short units that follow a number (8 L → ৮ লি, 40.6 km/L →
 * ৪০.৬ কিমি/লি). Applied when text is drawn (AppText, chart labels), never
 * to stored values or text inputs, so parsing and saving still see 0-9.
 *
 * Emails and links are left as they are.
 */

// Zero of each language that writes its own digits in everyday use.
const ZERO = {
  bn: 0x09e6, // ০
  hi: 0x0966, // ०
  ne: 0x0966, // ०
  ar: 0x0660, // ٠
  fa: 0x06f0, // ۰
};

// Arabic-script decimal / thousands marks.
const SEPARATORS = {
  ar: { decimal: '٫', group: '٬' },
  fa: { decimal: '٫', group: '٬' },
};

// Short units after a number. Latin-script languages keep km, L, kg, kWh.
const UNITS = {
  bn: { km: 'কিমি', mi: 'মাইল', L: 'লি', kg: 'কেজি', kWh: 'কি.ও.ঘ' },
  hi: { km: 'किमी', mi: 'मील', L: 'ली', kg: 'किग्रा', kWh: 'kWh' },
  ne: { km: 'कि.मी.', mi: 'माइल', L: 'लि.', kg: 'के.जी.', kWh: 'kWh' },
  ur: { km: 'کلومیٹر', mi: 'میل', L: 'لیٹر', kg: 'کلو', kWh: 'kWh' },
  ar: { km: 'كم', mi: 'ميل', L: 'لتر', kg: 'كغ', kWh: 'ك.و.س' },
  fa: { km: 'کیلومتر', mi: 'مایل', L: 'لیتر', kg: 'کیلوگرم', kWh: 'کیلووات‌ساعت' },
  si: { km: 'කි.මී.', mi: 'සැතපුම්', L: 'ලී.', kg: 'කි.ග්‍රෑ.', kWh: 'kWh' },
  ta: { km: 'கி.மீ', mi: 'மைல்', L: 'லி', kg: 'கி.கி', kWh: 'kWh' },
  th: { km: 'กม.', mi: 'ไมล์', L: 'ลิตร', kg: 'กก.', kWh: 'kWh' },
  zh: { km: '公里', mi: '英里', L: '升', kg: '公斤', kWh: '千瓦时' },
  ru: { km: 'км', mi: 'миль', L: 'л', kg: 'кг', kWh: 'кВт·ч' },
  uk: { km: 'км', mi: 'миль', L: 'л', kg: 'кг', kWh: 'кВт·год' },
};

// A unit after a digit ("8 L"), a slash ("/L", "/ L"), an opening bracket
// ("(L)") or on its own (an input's "km" suffix). Not inside a word.
const UNIT_RE = /(^|\d\s?|\/\s?|\()(kWh|km|mi|kg|L)(?![A-Za-z])/g;
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
  if (typeof text !== 'string' || !text || SKIP_RE.test(text)) return text;
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
