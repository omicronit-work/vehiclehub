import * as firestore from '@react-native-firebase/firestore';

const snap = docs => ({
  empty: !docs.length,
  docs: Object.entries(docs).map(([, [id, data]]) => ({ id, data: () => data })),
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
  it('starts with the built-in list', () => {
    const cur = load();
    expect(cur.findCurrency('BDT')).toEqual({ code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' });
    expect(cur.currencyForCountry('FR').code).toBe('EUR');
    expect(cur.currencyForCountry('ZZ').code).toBe('USD');
  });

  it('uses the database list once it loads, in its order', async () => {
    firestore.getDocs.mockResolvedValue(snap([
      ['THB', { name: 'Thai Baht', symbol: '฿', order: 2, countries: ['TH'] }],
      ['USD', { name: 'US Dollar', symbol: 'US$', order: 1 }],
      ['XAF', { name: 'CFA Franc', symbol: 'FCFA', countries: ['CM'] }],
      ['GBP', { name: 'British Pound', symbol: '£', hidden: true }],
      ['BAD', { name: 'No symbol' }],
    ]));
    const cur = load();
    const seen = [];
    cur.onCurrenciesChange(l => seen.push(l.length));
    await cur.loadCurrencies();

    expect(cur.getCurrencies().map(c => c.code)).toEqual(['USD', 'THB', 'XAF']);
    expect(cur.findCurrency('USD').symbol).toBe('US$');
    expect(cur.findCurrency('GBP')).toBeNull();
    expect(cur.currencyForCountry('CM').code).toBe('XAF');
    expect(cur.currencyForCountry('TH').code).toBe('THB');
    // Built-in mapping still applies when its currency is listed…
    expect(cur.currencyForCountry('US').code).toBe('USD');
    // …and falls back to US Dollar when it isn't.
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
