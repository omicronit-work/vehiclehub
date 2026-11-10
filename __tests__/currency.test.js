import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  amountText,
  parseAmount,
  formatMoney,
  formatRecordMoney,
  recordCurrency,
  symbolFor,
  convertRecords,
} from '../src/util/methods/useCurrency';
import { computeFuelEfficiency, summarizeFuel } from '../src/util/fuelEfficiency';

beforeEach(() => AsyncStorage.clear());

test('amounts are saved exactly as typed and shown back unchanged', () => {
  expect(parseAmount('1500')).toBe(1500);
  expect(parseAmount('41.54')).toBe(41.54);
  expect(amountText(1500)).toBe('1500');
  expect(amountText(41.54)).toBe('41.54');
  // Round trip: open an edit form and save without touching it.
  expect(parseAmount(amountText(41.54))).toBe(41.54);
});

test('empty input stays empty and zero stays zero', () => {
  expect(parseAmount('')).toBeNull();
  expect(amountText(null)).toBe('');
  expect(parseAmount('0')).toBe(0);
  expect(amountText(0)).toBe('0');
});

test('a record is always shown in the currency it was saved in', () => {
  const fill = { totalCost: 1500, pricePerLiter: 41.54, currency: 'INR' };
  expect(formatRecordMoney(fill, fill.totalCost)).toBe('₹ 1,500.00');
  expect(formatRecordMoney(fill, fill.pricePerLiter)).toBe('₹ 41.54');
  // Older records have no currency field: they were stored in the base currency.
  expect(recordCurrency({ totalCost: 10 })).toBe('BDT');
  expect(formatRecordMoney({ totalCost: 10 }, 10)).toBe('৳ 10.00');
  expect(symbolFor('USD')).toBe('$');
});

test('money is formatted the same way everywhere and never converted', () => {
  expect(formatMoney(5062.5, '৳')).toBe('৳ 5,062.50');
  expect(formatMoney(3500, '৳')).toBe('৳ 3,500.00');
  expect(formatMoney(undefined, '৳')).toBe('৳ 0.00');
  expect(formatMoney(1234.5)).toBe('1,234.50');
});

test('totals convert only other-currency records, into copies', async () => {
  // A cached INR→USD rate, so no network is needed.
  await AsyncStorage.setItem('fxRate:INR:USD', JSON.stringify({ rate: 0.012, date: '2026-11-01', ts: Date.now() }));
  const records = [
    { totalCost: 20, currency: 'USD' },
    { totalCost: 1500, pricePerLiter: 100, currency: 'INR' },
  ];
  const res = await convertRecords(records, 'USD');
  expect(res.records[0]).toBe(records[0]); // same currency: untouched
  expect(res.records[1].totalCost).toBeCloseTo(18);
  expect(res.records[1].pricePerLiter).toBeCloseTo(1.2);
  expect(res.converted).toBe(1);
  // The saved record itself is never changed.
  expect(records[1]).toEqual({ totalCost: 1500, pricePerLiter: 100, currency: 'INR' });
});

test('totals leave out records whose rate cannot be loaded', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const res = await convertRecords([{ totalCost: 5, currency: 'EUR' }, { totalCost: 7, currency: 'GBP' }], 'GBP');
  expect(res.records).toEqual([{ totalCost: 7, currency: 'GBP' }]);
  expect(res.skipped).toBe(1);
  warn.mockRestore();
});

test('fuel cost per km and totals are not mixed across currencies', () => {
  const day = d => new Date(`2026-10-${d}T12:00:00`);
  const logs = computeFuelEfficiency([
    { date: day(1), odometer: 1000, liters: 30, totalCost: 3000, fullTank: true, fuelType: 'Petrol', currency: 'INR' },
    { date: day(10), odometer: 1300, liters: 20, totalCost: 25, fullTank: true, fuelType: 'Petrol', currency: 'USD' },
  ]);
  const second = logs.find(l => l.currency === 'USD');
  expect(second.efficiency).toBe(15); // economy still measured
  expect(second.costPerKm).toBeCloseTo(25 / 300); // only this fill's own cost, in USD
  const sum = summarizeFuel(logs);
  expect(sum.currency).toBeNull();
  expect(sum.totalCost).toBeNull();
  expect(sum.avgPrice).toBeNull();
});
