import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from '@react-native-firebase/firestore';

// Cost records keep the currency they were entered in as `selected_currency`
// (its index). Here the selected currency is US Dollar (index 1); taka is 4.
let db;
let idSeq;
const ref = (kind, parent, segments) => {
  const base = parent && parent.path ? [parent.path] : [];
  return { kind, path: [...base, ...segments].join('/') };
};
const makeDoc = path => ({
  id: path.split('/').pop(),
  ref: { path },
  exists: () => path in db,
  data: () => db[path],
});
const flush = () => new Promise(r => setTimeout(r, 0));
const day = (y, m) => ({ toDate: () => new Date(y, m, 15) });

let cur;
let slice;

beforeAll(async () => {
  await AsyncStorage.multiSet([
    ['selectedCurrency', JSON.stringify({ code: 'USD', name: 'US Dollar', symbol: '$', index: 1 })],
    ['currencyMode', 'manual'],
  ]);
  cur = require('../src/util/methods/useCurrency');
  slice = require('../src/store/userSlice');
  await flush();
  await flush();
});

beforeEach(() => {
  db = {};
  idSeq = 0;
  fs.collection.mockImplementation((parent, ...segments) => ref('collection', parent, segments));
  fs.doc.mockImplementation((parent, ...segments) =>
    ref('doc', parent, parent?.kind === 'collection' && !segments.length ? [`id${++idSeq}`] : segments));
  fs.getDoc.mockImplementation(async ({ path }) => makeDoc(path));
  fs.getDocs.mockImplementation(async ({ path }) => {
    const docs = Object.keys(db)
      .filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
      .map(makeDoc);
    return { docs, empty: docs.length === 0, forEach: fn => docs.forEach(fn) };
  });
  fs.setDoc.mockImplementation(async ({ path }, data, opts) => {
    db[path] = opts?.merge ? { ...db[path], ...data } : data;
  });
  fs.updateDoc.mockImplementation(async ({ path }, data) => {
    db[path] = { ...db[path], ...data };
  });
  fs.writeBatch.mockImplementation(() => {
    const ops = [];
    return {
      update: (r, data) => ops.push([r.path, data]),
      commit: async () => ops.forEach(([p, data]) => { db[p] = { ...db[p], ...data }; }),
    };
  });
});

describe('record currency helpers', () => {
  it('compares a record with the selected currency by index', () => {
    expect(cur.currentCurrencyIndex()).toBe(1);
    expect(cur.isInCurrentCurrency({ selected_currency: 1 })).toBe(true);
    expect(cur.isInCurrentCurrency({ selected_currency: 4 })).toBe(false);
    // Not initialised yet: counts as the selected currency.
    expect(cur.isInCurrentCurrency({ currency: 'BDT' })).toBe(true);
  });

  it('shows a record in another currency with its own symbol', () => {
    expect(cur.formatRecordMoney({ selected_currency: 4 }, 1000)).toBe('৳ 1,000.00');
    expect(cur.formatRecordMoney({ selected_currency: 1 }, 1000)).toBe('$ 1,000.00');
    expect(cur.recordCurrency({ selected_currency: 4 })).toBe('BDT');
  });

  it('leaves other-currency costs out of statistics but keeps the fill-up', () => {
    const [same, other] = cur.costsInCurrentCurrency([
      { selected_currency: 1, totalCost: 50, liters: 10 },
      { selected_currency: 4, totalCost: 900, pricePerLiter: 90, liters: 10 },
    ]);
    expect(same.totalCost).toBe(50);
    expect(other).toMatchObject({ totalCost: 0, pricePerLiter: 0, liters: 10, selected_currency: 1 });
    expect(cur.countOtherCurrency([{ selected_currency: 4 }, { selected_currency: 1 }, {}])).toBe(1);
  });

  it('saves the index with the code', () => {
    expect(cur.currencyFields('BDT')).toEqual({ currency: 'BDT', selected_currency: 4 });
  });
});

describe('saving and totals', () => {
  it('an edited record is saved in the selected currency', async () => {
    const path = 'users/a@b.com/vehicles/car1/services/s1';
    db[path] = { name: 'Oil', totalCost: 900, currency: 'BDT', selected_currency: 4 };
    await slice.updateUserService('a@b.com', { name: 'Oil', totalCost: 20, currency: 'USD' }, 'car1', 's1');
    await flush();
    expect(db[path]).toMatchObject({ totalCost: 20, currency: 'USD', selected_currency: 1 });
  });

  it('the expense summary only adds up records in the selected currency', async () => {
    const v = 'users/a@b.com/vehicles/car1';
    db[v] = { brand: 'Toyota' };
    db[`${v}/services/s1`] = { name: 'Oil', totalCost: 30, selected_currency: 1, serviceDate: day(2026, 2) };
    db[`${v}/services/s2`] = { name: 'Oil', totalCost: 900, selected_currency: 4, serviceDate: day(2026, 2) };
    db[`${v}/fuelLogs/f1`] = { totalCost: 40, liters: 10, selected_currency: 1, date: day(2026, 2) };
    db[`${v}/fuelLogs/f2`] = { totalCost: 800, liters: 10, selected_currency: 4, date: day(2026, 2) };
    const res = await slice.getExpenseSummary('a@b.com', { vehicleId: 'car1', year: 2026, currency: 'USD' });
    expect(res.monthlyTotals[2]).toBe(70);

    // What was left out, per currency and month.
    expect(res.otherCurrencyMonthly).toHaveLength(1);
    expect(res.otherCurrencyMonthly[0]).toMatchObject({ code: 'BDT', symbol: '৳' });
    expect(res.otherCurrencyMonthly[0].monthly[2]).toBe(1700);

    const costs = await slice.getVehicleCostRecords('a@b.com', 'car1', { currency: 'USD' });
    expect(costs.services.map(s => s.totalCost)).toEqual([30]);
    expect(costs.fuelLogs.map(f => f.totalCost).sort()).toEqual([0, 40]);
    expect(costs.otherCurrency.map(r => `${r.kind}:${r.totalCost}`).sort()).toEqual(['fuel:800', 'service:900']);

    const { otherCurrencySpent } = require('../src/util/runningCost');
    const range = { start: new Date(2026, 0, 1).getTime(), end: new Date(2026, 11, 31).getTime() };
    expect(otherCurrencySpent(costs.otherCurrency, range, cur.recordCurrencyInfo, new Date(2026, 11, 31).getTime()))
      .toEqual([{ code: 'BDT', symbol: '৳', fuel: 800, service: 900, total: 1700, count: 2 }]);
    // Records by currency: the selected one first, counted.
    const { currencyBreakdown } = require('../src/util/runningCost');
    const b = currencyBreakdown({
      current: costs.currentCurrency,
      others: costs.otherCurrency,
      range,
      selected: { code: 'USD', symbol: '$' },
      currencyOf: cur.recordCurrencyInfo,
      today: new Date(2026, 11, 31).getTime(),
    });
    expect(b).toMatchObject({ total: 4, matched: 2 });
    expect(b.rows).toEqual([
      { code: 'USD', symbol: '$', counted: true, count: 2, fuelCount: 1, serviceCount: 1, total: 70 },
      { code: 'BDT', symbol: '৳', counted: false, count: 2, fuelCount: 1, serviceCount: 1, total: 1700 },
    ]);
    // Outside the period: nothing.
    const april = { start: new Date(2026, 3, 1).getTime(), end: new Date(2026, 3, 30).getTime() };
    expect(otherCurrencySpent(costs.otherCurrency, april, cur.recordCurrencyInfo, new Date(2026, 11, 31).getTime())).toEqual([]);
  });
});

describe('one-time initialisation', () => {
  it('gives every record without an index the selected one, once', async () => {
    const v = 'users/a@b.com/vehicles/car1';
    db['users/a@b.com'] = { name: 'A' };
    db[v] = { brand: 'Toyota' };
    db[`${v}/services/s1`] = { name: 'Oil', totalCost: 30, currency: 'BDT' };
    db[`${v}/fuelLogs/f1`] = { totalCost: 40 };
    db[`${v}/fuelLogs/f2`] = { totalCost: 800, currency: 'BDT', selected_currency: 4 };
    db[`${v}/documents/d1`] = { documentName: 'Insurance' };

    expect(await slice.initRecordCurrencies('a@b.com')).toBe(2);
    await flush();
    expect(db[`${v}/services/s1`]).toMatchObject({ selected_currency: 1, currency: 'USD' });
    expect(db[`${v}/fuelLogs/f1`]).toMatchObject({ selected_currency: 1, currency: 'USD' });
    expect(db[`${v}/fuelLogs/f2`].selected_currency).toBe(4);
    expect(db[`${v}/documents/d1`].selected_currency).toBeUndefined();
    expect(db['users/a@b.com']).toMatchObject({ recordCurrencyInitialized: true, currencyIndex: 1 });

    db[`${v}/services/s3`] = { name: 'Later, old app version' };
    expect(await slice.initRecordCurrencies('a@b.com')).toBe(0);
    expect(db[`${v}/services/s3`].selected_currency).toBeUndefined();
  });

  it('skips an account another phone already initialised', async () => {
    db['users/b@c.com'] = { recordCurrencyInitialized: true };
    db['users/b@c.com/vehicles/car1/services/s1'] = { name: 'Oil' };
    expect(await slice.initRecordCurrencies('b@c.com')).toBe(0);
    expect(db['users/b@c.com/vehicles/car1/services/s1'].selected_currency).toBeUndefined();
  });
});
