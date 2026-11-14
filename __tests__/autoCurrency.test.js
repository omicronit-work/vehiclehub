import AsyncStorage from '@react-native-async-storage/async-storage';
import { currencyForCountry } from '../src/util/currencies';

const flush = () => new Promise(r => setTimeout(r, 0));
const saved = async () => JSON.parse(await AsyncStorage.getItem('selectedCurrency'))?.code;

// Fresh module state (detected country, listeners) for each test.
const load = () => {
  let mods;
  jest.isolateModules(() => {
    mods = {
      currency: require('../src/util/methods/useCurrency'),
      country: require('../src/util/userCountry'),
    };
  });
  return mods;
};

beforeEach(() => AsyncStorage.clear());

describe('currencyForCountry', () => {
  it('maps countries to their currency', () => {
    expect(currencyForCountry('TH').code).toBe('THB');
    expect(currencyForCountry('BD').code).toBe('BDT');
    expect(currencyForCountry('FR').code).toBe('EUR');
  });

  it('defaults to US Dollar when unknown', () => {
    expect(currencyForCountry(null).code).toBe('USD');
    expect(currencyForCountry('KE').code).toBe('USD');
  });
});

// The country comes only from the phone's time zone; each test fakes one.
const withZone = code => {
  jest.doMock('../src/util/timezoneCountry', () => ({
    timezoneCountry: () => (code ? { code, name: code } : null),
  }));
  return load();
};
afterEach(() => jest.dontMock('../src/util/timezoneCountry'));

describe('automatic currency', () => {
  it('goes by the time zone (US Dollar only with none)', async () => {
    const { currency } = load();
    const tz = require('../src/util/timezoneCountry').timezoneCountry();
    const expected = tz ? currencyForCountry(tz.code).code : 'USD';
    expect((await currency.savedOrDefaultCurrency()).code).toBe(expected);
  });

  it('follows the time-zone country', async () => {
    const { country } = withZone('TH');
    await country.whenCountryKnown();
    await flush();
    expect(country.getCountry()).toBe('TH');
    expect(await saved()).toBe('THB');
  });

  it('Dhaka -> BDT, not USD', async () => {
    const { country } = withZone('BD');
    await country.whenCountryKnown();
    await flush();
    expect(await saved()).toBe('BDT');
  });

  it('keeps a currency the user picked by hand', async () => {
    await AsyncStorage.multiSet([
      ['selectedCurrency', JSON.stringify({ code: 'BDT', symbol: '৳' })],
      ['currencyMode', 'manual'],
    ]);
    const { country } = withZone('TH');
    await country.whenCountryKnown();
    await flush();
    expect(await saved()).toBe('BDT');
  });

  it('treats a currency saved before modes existed as manual', async () => {
    await AsyncStorage.setItem('selectedCurrency', JSON.stringify({ code: 'GBP', symbol: '£' }));
    const { currency } = load();
    expect(await currency.isManualCurrency()).toBe(true);
  });

  it('switching back to Automatic uses the time zone again', async () => {
    const { currency } = withZone('TH');
    await currency.setManualCurrency({ code: 'BDT', symbol: '৳' });
    await currency.setAutoCurrency();
    expect(await saved()).toBe('THB');
    expect(await currency.isManualCurrency()).toBe(false);
  });

  it('clears the old GPS cache', async () => {
    await AsyncStorage.setItem('userCountry', JSON.stringify({ code: 'TH' }));
    const { country } = withZone('BD');
    await country.whenCountryKnown();
    await flush();
    expect(await AsyncStorage.getItem('userCountry')).toBeNull();
    expect(country.getCountry()).toBe('BD');
  });
});

describe('time zone lookup', () => {
  const { countryForTimezone } = require('../src/util/timezoneCountry');

  it('maps a phone in Dhaka to Bangladesh', () => {
    expect(countryForTimezone('Asia/Dhaka')).toEqual({ code: 'BD', name: 'Bangladesh' });
    expect(currencyForCountry(countryForTimezone('Asia/Dhaka').code).code).toBe('BDT');
  });

  it('returns nothing for unknown zones (-> US Dollar)', () => {
    expect(countryForTimezone('Africa/Nairobi')).toBeNull();
    expect(currencyForCountry(null).code).toBe('USD');
  });
});
