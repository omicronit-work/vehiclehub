import { getLanguage } from './index';

/*
 * Vehicle model names in the app language. Display only: the model is saved
 * as typed / as the catalog spells it ("Corolla Cross", "X5"), and shown here
 * in the local script ("করোলা ক্রস", "এক্স৫").
 *
 * A model is split into runs:
 *   - words (3+ letters, not all capitals): looked up in models/<lang>.js
 *     ("Corolla" → "করোলা"); a word not listed stays as typed
 *   - codes (short or all-capital letter runs: X, RS, TLX, e): spelled out
 *     letter by letter in languages that do that (Bangla, Hindi, Thai…);
 *     Chinese, Japanese, Korean, Russian and Ukrainian keep Latin codes
 *   - digits and punctuation: kept (AppText puts digits in the local script)
 *
 * Languages written in Latin letters (Malay, French…) show the model as is.
 */

const WORDS = {
  bn: () => require('./models/bn').default,
  th: () => require('./models/th').default,
};

// English letter names, A–Z, for spelling codes ("CR-V" → "সিআর-ভি").
const LETTERS = {
  bn: 'এ বি সি ডি ই এফ জি এইচ আই জে কে এল এম এন ও পি কিউ আর এস টি ইউ ভি ডব্লিউ এক্স ওয়াই জেড',
  th: 'เอ บี ซี ดี อี เอฟ จี เอช ไอ เจ เค แอล เอ็ม เอ็น โอ พี คิว อาร์ เอส ที ยู วี ดับเบิลยู เอ็กซ์ วาย แซด',
};

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => strip(s).trim().toLowerCase().replace(/\s+/g, ' ');
const ROMAN = /^[IVX]+$/;

const cache = {};
const tables = lang => {
  if (!cache[lang]) {
    const words = new Map();
    try {
      WORDS[lang]().trim().split('\n').forEach(row => {
        const [en, local] = row.split('|');
        if (en && local) words.set(norm(en), local);
      });
    } catch {}
    const letters = LETTERS[lang] ? LETTERS[lang].split(' ') : null;
    cache[lang] = { words, letters, display: new Map() };
  }
  return cache[lang];
};

const spell = (run, { letters }, lang) =>
  letters
    ? [...strip(run).toUpperCase()].map(ch => letters[ch.charCodeAt(0) - 65] || ch).join('')
    : run;

/** Letters spelled by name in `lang` ('RS' → 'আরএস'); as is where codes stay Latin. */
export const spellLetters = (run, lang = getLanguage()) => (WORDS[lang] ? spell(run, tables(lang), lang) : run);

/** 'Corolla Cross' → 'করোলা ক্রস' in Bengali; as typed in Latin-script languages. */
export const modelName = (model, lang = getLanguage()) => {
  if (!model || !WORDS[lang]) return model;
  const t = tables(lang);
  const key = String(model);
  if (t.display.has(key)) return t.display.get(key);
  const out = key.replace(/[A-Za-zÀ-ÿ]+/g, run => {
    const word = t.words.get(norm(run));
    if (word) return word;
    if (ROMAN.test(run) && run.length > 1) return run;
    // An unlisted word written like one ('Supra', 'Fe') stays as typed; codes
    // ('TLX', 'iX', 'FZv', 'Fzsv', 'Ff': no vowel to read) are spelled out.
    const plain = strip(run);
    const isWord = plain.length >= 2 && /^[A-Z]?[a-z]+$/.test(plain) && /[aeiouy]/i.test(plain);
    return isWord ? run : spell(run, t, lang);
  });
  t.display.set(key, out);
  return out;
};

/**
 * The model to save for what was typed or picked: the catalog spelling when
 * the text is a model's English or local name ('করোলা' → 'Corolla'), else
 * the text as typed (trimmed).
 */
export const matchModel = (text, list = []) => {
  const typed = String(text ?? '').trim();
  if (!typed) return '';
  const key = norm(typed);
  return list.find(m => norm(m) === key || norm(modelName(m)) === key) || typed;
};

/** Models whose English or local name starts with what's typed. */
export const filterModels = (list, query) => {
  const q = norm(query);
  if (!q) return list;
  return list.filter(m => norm(m).startsWith(q) || norm(modelName(m)).startsWith(q));
};
