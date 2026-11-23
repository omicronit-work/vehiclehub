import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES } from '../src/i18n/languages';
import en from '../src/i18n/locales/en';
import { normalizeLanguage, setLanguage, t, getLanguage, loadSavedLanguage } from '../src/i18n';
import { fuelLabel, fuelTypesFor, gradeOf } from '../src/util/fuelTypes';

const placeholders = s => [...new Set(s.match(/\{\w+\}/g) || [])].sort();

afterEach(() => setLanguage('en'));

describe('languages', () => {
  it('has English, Bangla, Thai, Malay, German and Spanish, each with every key and the same placeholders', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['en', 'bn', 'th', 'ms', 'de', 'es']);
    for (const { code } of LANGUAGES) {
      const dict = require(`../src/i18n/locales/${code}`).default;
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        expect(dict[key].trim()).not.toBe('');
        expect(placeholders(dict[key])).toEqual(placeholders(en[key]));
      }
    }
  });

  it('maps phone locales to app languages', () => {
    expect(normalizeLanguage('bn_BD')).toBe('bn');
    expect(normalizeLanguage('th-TH')).toBe('th');
    expect(normalizeLanguage('ms_MY')).toBe('ms');
    expect(normalizeLanguage('de-DE')).toBe('de');
    expect(normalizeLanguage('es_ES')).toBe('es');
    // A phone in a language the app doesn't have falls back (to English).
    expect(normalizeLanguage('pt-BR')).toBeNull();
    expect(normalizeLanguage('xx-YY')).toBeNull();
  });
});

describe('t()', () => {
  it('translates and fills placeholders', async () => {
    await setLanguage('bn');
    expect(t('set.title')).toBe('সেটিংস');
    expect(t('dlg.currencyTitle', { code: 'BDT' })).toBe('এখন থেকে BDT ব্যবহার করবেন?');
  });

  it('falls back to English, then to the key', async () => {
    await setLanguage('ms');
    expect(t('no.such.key')).toBe('no.such.key');
    await setLanguage('zz');
    expect(getLanguage()).toBe('en');
  });

  it('remembers the choice', async () => {
    await setLanguage('th');
    await AsyncStorage.setItem('appLanguage', 'ms');
    expect(await loadSavedLanguage()).toBe('ms');
  });
});

describe('fuel names by language', () => {
  it('English keeps the pump names', () => {
    expect(fuelLabel('Octane', 'TH', 'en')).toBe('Gasohol 95');
    expect(fuelLabel('LPG', 'BD', 'en')).toBe('Autogas (LPG)');
  });

  it('another language uses its own names, keeping the grade', async () => {
    await setLanguage('bn');
    expect(fuelTypesFor('BD').map(f => f.label)).toEqual([
      'পেট্রোল', 'অকটেন', 'ডিজেল', 'অটোগ্যাস (এলপিজি)', 'সিএনজি', 'ইভি চার্জ',
    ]);
    expect(fuelLabel('Petrol', 'TH')).toBe('পেট্রোল 91');
    expect(fuelLabel('Premium 98', 'SG')).toBe('অকটেন 98');
    // A brand-only grade keeps its pump name.
    expect(fuelLabel('Gasohol E20', 'TH')).toBe('Gasohol E20');
  });

  it("a country's own language shows its real pump names", async () => {
    await setLanguage('th');
    expect(fuelLabel('Octane', 'TH')).toBe('แก๊สโซฮอล์ 95');
  });

  it('labels stay distinct in every language', async () => {
    for (const { code } of LANGUAGES) {
      await setLanguage(code);
      for (const country of ['BD', 'IN', 'TH', 'US', 'DE', 'AU', 'ZZ']) {
        const labels = fuelTypesFor(country).map(f => f.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });

  it('reads grades out of pump names', () => {
    expect(gradeOf('Super Petrol (RON 92)')).toBe('RON 92');
    expect(gradeOf('Unleaded (E10)')).toBe('E10');
    expect(gradeOf('92#')).toBe('92#');
    expect(gradeOf('Diesel 500ppm')).toBeNull();
  });
});

describe('saved data in the app language', () => {
  const { fuelDisplayName } = require('../src/util/fuelTypes');
  const { serviceLabel } = require('../src/util/serviceFields');
  const { documentLabel } = require('../src/util/documentFields');
  const { formatDay } = require('../src/i18n');
  const { getServiceStatus } = require('../src/util/dateStatus');

  it('renames saved fuel logs, keeping the grade', async () => {
    const octane = { fuelType: 'Octane', fuelName: 'Octane' };
    const thai95 = { fuelType: 'Octane', fuelName: 'Gasohol 95' };
    expect(fuelDisplayName(octane)).toBe('Octane');
    expect(fuelDisplayName(thai95)).toBe('Gasohol 95');
    await setLanguage('bn');
    expect(fuelDisplayName(octane)).toBe('অকটেন');
    expect(fuelDisplayName(thai95)).toBe('অকটেন 95');
    expect(fuelDisplayName({ fuelType: 'Petrol' })).toBe('পেট্রোল');
    await setLanguage('th');
    expect(fuelDisplayName(thai95)).toBe('แก๊สโซฮอล์ 95');
    // Saved while the app was in Bengali, shown in Thai.
    expect(fuelDisplayName({ fuelType: 'Petrol', fuelName: 'পেট্রোল 91' })).toBe('เบนซิน 91');
  });

  it('translates built-in service and document names, not typed ones', async () => {
    expect(serviceLabel('Engine Oil Refill')).toBe('Engine oil refill');
    await setLanguage('bn');
    expect(serviceLabel('Engine Oil Refill')).toBe('ইঞ্জিন অয়েল পরিবর্তন');
    expect(serviceLabel('My custom job')).toBe('My custom job');
    expect(documentLabel('Insurance')).toBe('বিমা');
    expect(documentLabel('Parking pass')).toBe('Parking pass');
  });

  it('formats dates and statuses in the app language, with 0-9 digits', async () => {
    const day = new Date(2026, 10, 2, 12);
    expect(formatDay(day)).toBe('2 Nov 2026');
    await setLanguage('bn');
    expect(formatDay(day)).toMatch(/2026/);
    expect(formatDay(day)).not.toMatch(/[০-৯]/);
    const soon = new Date(Date.now() + 5 * 86400000);
    expect(getServiceStatus({ nextServiceDate: soon }).label).toBe('5 দিন পরে');
  });
});

describe('figures on screen (language pack bug report, Nov 2026)', () => {
  const { localizeText } = require('../src/i18n/localizeText');

  it('keeps 0-9 for money, litres and distance in Thai, units in Thai', () => {
    expect(localizeText('฿ 400.00 · 22.66 L', 'th')).toBe('฿ 400.00 · 22.66 ลิตร');
    expect(localizeText('21,928.24', 'th')).toBe('21,928.24');
    expect(localizeText('16.3 km/L', 'th')).toBe('16.3 กม./ลิตร');
  });

  it('keeps 0-9 and Latin units in Malay', () => {
    expect(localizeText('RM 1,234.50 · 22.66 L', 'ms')).toBe('RM 1,234.50 · 22.66 L');
    expect(localizeText('16.3 km/L', 'ms')).toBe('16.3 km/L');
    expect(localizeText('2026', 'ms')).toBe('2026');
  });

  it('never localises a hex colour code', () => {
    for (const lang of ['th', 'bn', 'ms', 'de', 'es']) {
      expect(localizeText('#0E7C7B', lang)).toBe('#0E7C7B');
    }
  });

  it('still writes Bangla digits', () => {
    expect(localizeText('2024', 'bn')).toBe('২০২৪');
  });

  it('has the records-by-currency phrases in every language', () => {
    const key = 'All {0} records match {1} {2}.';
    for (const { code } of LANGUAGES.filter(l => l.code !== 'en')) {
      const phrase = require(`../src/i18n/phrases/${code}`).default[key];
      expect(phrase).toBeTruthy();
      expect(placeholders(phrase)).toEqual(placeholders(key));
    }
  });
});

describe('localNumber', () => {
  const { localNumber } = require('../src/i18n');
  const { formatInputNumber, formatNumber } = require('../src/util/schedule/scheduleMath');

  it("writes numbers the app language's way, digits left as 0-9 for AppText", async () => {
    const cases = { en: '1,234,567.5', th: '1,234,567.5', ms: '1,234,567.5', de: '1.234.567,5', es: '1.234.567,5', bn: '12,34,567.5' };
    for (const [code, expected] of Object.entries(cases)) {
      await setLanguage(code);
      expect(localNumber(1234567.5, { maximumFractionDigits: 1 })).toBe(expected);
    }
  });

  it('keeps text inputs in 0-9 with "," grouping whatever the language', async () => {
    await setLanguage('de');
    expect(formatNumber(1200)).toBe('1.200');
    expect(formatInputNumber(1200)).toBe('1,200');
  });

  it('returns empty text for no value', () => {
    expect(localNumber(null)).toBe('');
    expect(localNumber('')).toBe('');
    expect(localNumber('abc')).toBe('');
  });
});
