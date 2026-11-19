import * as firestore from '@react-native-firebase/firestore';

const snap = rows => ({
  empty: !rows.length,
  docs: rows.map(([id, data]) => ({ id, data: () => data })),
});

// Fresh module state (loaded list, listeners) for each test.
const load = () => {
  let mod;
  jest.isolateModules(() => { mod = require('../src/util/currencies'); });
  return mod;
};

beforeEach(() => {
  firestore.collection.mockReturnValue({ path: 'currencies' });
  firestore.getDocsFromCache.mockRejectedValue(new Error('no cache'));
});

describe('currency list', () => {
  it('starts with the built-in list, each currency with its index', () => {
    const cur = load();
    expect(cur.findCurrency('BDT')).toEqual({ index: 4, code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' });
    expect(cur.findCurrencyByIndex(1).code).toBe('USD');
    expect(cur.indexForCode('THB')).toBe(18);
    expect(cur.currencyForCountry('FR').code).toBe('EUR');
    expect(cur.currencyForCountry('ZZ').code).toBe('USD');
    const indexes = cur.getCurrencies().map(c => c.index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('uses the database list once it loads, ordered by index', async () => {
    firestore.getDocs.mockResolvedValue(snap([
      ['THB', { index: 18, name: 'Thai Baht', symbol: '฿', countries: ['TH'] }],
      ['USD', { index: 1, name: 'US Dollar', symbol: 'US$' }],
      ['XAF', { index: 35, name: 'CFA Franc', symbol: 'FCFA', countries: ['CM'] }],
      ['GBP', { index: 3, name: 'British Pound', symbol: '£', hidden: true }],
      ['NOI', { name: 'No index', symbol: 'N' }],
      ['DUP', { index: 18, name: 'Same index', symbol: 'D' }],
    ]));
    const cur = load();
    const seen = [];
    cur.onCurrenciesChange(l => seen.push(l.length));
    await cur.loadCurrencies();

    expect(cur.getCurrencies().map(c => c.code)).toEqual(['USD', 'THB', 'XAF']);
    expect(cur.findCurrency('USD').symbol).toBe('US$');
    // Hidden: not offered, but a record saved in it still finds it.
    expect(cur.findCurrency('GBP')).toBeNull();
    expect(cur.findCurrencyByIndex(3).symbol).toBe('£');
    expect(cur.findCurrencyByIndex(35).code).toBe('XAF');
    expect(cur.currencyForCountry('CM').code).toBe('XAF');
    expect(cur.currencyForCountry('TH').code).toBe('THB');
    expect(cur.currencyForCountry('US').code).toBe('USD');
    expect(cur.currencyForCountry('GB').code).toBe('USD');
    expect(seen).toEqual([3]);
  });

  it('keeps the built-in list when the database is empty or unreachable', async () => {
    firestore.getDocs.mockResolvedValue(snap([]));
    let cur = load();
    await cur.loadCurrencies();
    expect(cur.getCurrencies()).toBe(cur.BUILT_IN_CURRENCIES);

    firestore.getDocs.mockRejectedValue(new Error('offline'));
    cur = load();
    await cur.loadCurrencies();
    expect(cur.getCurrencies()).toBe(cur.BUILT_IN_CURRENCIES);
  });
});
