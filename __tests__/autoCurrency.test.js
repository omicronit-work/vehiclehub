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
const cacheCountry = code =>
  AsyncStorage.setItem('userCountry', JSON.stringify({ code, at: Date.now() }));

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

describe('automatic currency', () => {
  it('before GPS answers, goes by the time zone (US Dollar only with none)', async () => {
    const { currency } = load();
    const tz = require('../src/util/timezoneCountry').timezoneCountry();
    const expected = tz ? currencyForCountry(tz.code).code : 'USD';
    expect((await currency.savedOrDefaultCurrency()).code).toBe(expected);
  });

  it('follows the detected country', async () => {
    const { country } = load();
    await cacheCountry('TH');
    await country.refreshCountry();
    await flush();
    expect(await saved()).toBe('THB');
  });

  it('keeps a currency the user picked by hand', async () => {
    const { currency, country } = load();
    await currency.setManualCurrency({ code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' });
    await cacheCountry('TH');
    await country.refreshCountry();
    await flush();
    expect(await saved()).toBe('BDT');
  });

  it('treats a currency saved before modes existed as manual', async () => {
    await AsyncStorage.setItem('selectedCurrency', JSON.stringify({ code: 'GBP', symbol: '£' }));
    const { currency } = load();
    expect(await currency.isManualCurrency()).toBe(true);
  });

  it('switching back to Automatic uses the location again', async () => {
    const { currency, country } = load();
    await currency.setManualCurrency({ code: 'BDT', symbol: '৳' });
    await cacheCountry('TH');
    await country.refreshCountry();
    await currency.setAutoCurrency();
    expect(await saved()).toBe('THB');
    expect(await currency.isManualCurrency()).toBe(false);
  });
});

describe('time zone fallback', () => {
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

describe('no GPS result', () => {
  afterEach(() => jest.dontMock('../src/util/timezoneCountry'));

  it('uses the time zone country: Dhaka -> BDT, not USD', async () => {
    jest.doMock('../src/util/timezoneCountry', () => ({
      timezoneCountry: () => ({ code: 'BD', name: 'Bangladesh' }),
    }));
    const { country } = load();
    await country.refreshCountry();
    await flush();
    expect(country.getCountry()).toBe('BD');
    expect(await saved()).toBe('BDT');
  });

  it('a later GPS fix in the cache wins over the time zone', async () => {
    jest.doMock('../src/util/timezoneCountry', () => ({
      timezoneCountry: () => ({ code: 'BD', name: 'Bangladesh' }),
    }));
    await cacheCountry('TH');
    const { country } = load();
    await country.refreshCountry();
    await flush();
    expect(await saved()).toBe('THB');
  });
});
