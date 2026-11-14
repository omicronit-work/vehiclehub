import AsyncStorage from '@react-native-async-storage/async-storage';

describe('country list', () => {
  const { COUNTRIES } = require('../src/util/countries');
  const { fuelTypesFor } = require('../src/util/fuelTypes');
  const { documentTypesFor, suggestExpiry } = require('../src/util/documentFields');
  const { currencies } = require('../src/util/currencies');

  it('has 20 unique countries', () => {
    expect(COUNTRIES).toHaveLength(20);
    expect(new Set(COUNTRIES.map(c => c.code)).size).toBe(20);
  });

  it('every country has its currency, its own fuel list and its own document list', () => {
    const defaultFuel = fuelTypesFor('ZZ').map(f => f.label).join();
    const defaultDocs = documentTypesFor('ZZ').map(d => d.label).join();
    COUNTRIES.forEach(c => {
      expect(currencies.some(cur => cur.code === c.currency)).toBe(true);
      expect(fuelTypesFor(c.code).map(f => f.label).join()).not.toBe(defaultFuel);
      expect(documentTypesFor(c.code).map(d => d.label).join()).not.toBe(defaultDocs);
    });
  });

  it('uses the local document names and terms', () => {
    expect(documentTypesFor('GB').map(d => d.label)).toContain('MOT');
    expect(documentTypesFor('JP').map(d => d.name)).toContain('Compulsory insurance');
    const shaken = suggestExpiry({ name: 'Vehicle inspection', issueDate: new Date(2026, 0, 1), country: 'JP' });
    expect(shaken.expiryDate.getFullYear()).toBe(2028);
    expect(shaken.hint).toBe('2 years for the Shaken (vehicle inspection)');
    const plain = suggestExpiry({ name: 'Vehicle inspection', issueDate: new Date(2026, 0, 1) });
    expect(plain.expiryDate.getFullYear()).toBe(2027);
    expect(plain.hint).toBe('1 year for the yearly inspection');
    // A country term never comes with the type's "yearly" reason.
    const usInsurance = suggestExpiry({ name: 'Insurance', issueDate: new Date(2026, 0, 1), details: {}, country: 'US' });
    expect(usInsurance.hint).toBe('6 months for the Insurance');
  });
});

describe('picked country', () => {
  beforeEach(() => AsyncStorage.clear());
  // Fresh module state (picked country, listeners) for each test.
  const load = () => {
    let mod;
    jest.isolateModules(() => { mod = require('../src/util/countries'); });
    return mod;
  };

  it('is saved on the phone and only accepts listed countries', async () => {
    const countries = load();
    const seen = [];
    countries.onCountryChange(c => seen.push(c));
    expect(await countries.setSelectedCountry('XX')).toBe(false);
    expect(await countries.setSelectedCountry('TH')).toBe(true);
    expect(await countries.getSelectedCountry()).toBe('TH');
    expect(await AsyncStorage.getItem('selectedCountry')).toBe('TH');
    expect(seen).toEqual(['TH']);
  });

  it('is read back after a restart', async () => {
    await AsyncStorage.setItem('selectedCountry', 'DE');
    const countries = load();
    expect(await countries.getSelectedCountry()).toBe('DE');
  });
});
