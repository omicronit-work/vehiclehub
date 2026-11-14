import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES } from '../src/i18n/languages';
import en from '../src/i18n/locales/en';
import { normalizeLanguage, setLanguage, t, getLanguage, loadSavedLanguage } from '../src/i18n';
import { fuelLabel, fuelTypesFor, gradeOf } from '../src/util/fuelTypes';

const placeholders = s => [...new Set(s.match(/\{\w+\}/g) || [])].sort();

afterEach(() => setLanguage('en'));

describe('languages', () => {
  it('has 30 languages, each with every key and the same placeholders', () => {
    expect(LANGUAGES).toHaveLength(30);
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
    expect(normalizeLanguage('pt-BR')).toBe('pt');
    expect(normalizeLanguage('in-ID')).toBe('id');
    expect(normalizeLanguage('tl')).toBe('fil');
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
    await setLanguage('fr');
    expect(t('no.such.key')).toBe('no.such.key');
    await setLanguage('zz');
    expect(getLanguage()).toBe('en');
  });

  it('remembers the choice', async () => {
    await setLanguage('th');
    await AsyncStorage.setItem('appLanguage', 'ja');
    expect(await loadSavedLanguage()).toBe('ja');
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
    await setLanguage('fr');
    expect(fuelLabel('Octane', 'FR')).toBe('SP98');
    await setLanguage('ru');
    expect(fuelLabel('Petrol', 'RU')).toBe('АИ-92');
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
    // Saved while the app was in Bengali, shown in Hindi.
    await setLanguage('hi');
    expect(fuelDisplayName({ fuelType: 'Petrol', fuelName: 'পেট্রোল 91' })).toBe('पेट्रोल 91');
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
