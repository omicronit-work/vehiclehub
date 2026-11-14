import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  amountText,
  parseAmount,
  formatMoney,
  formatRecordMoney,
  recordCurrency,
  symbolFor,
  setManualCurrency,
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

test('saved amounts are shown in the selected currency, numbers unchanged', async () => {
  await setManualCurrency({ code: 'INR', name: 'Indian Rupee', symbol: '₹' });
  for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 0)); // let the change apply
  const fill = { totalCost: 1000, pricePerLiter: 125, currency: 'BDT' };
  expect(formatRecordMoney(fill, fill.totalCost)).toBe('₹ 1,000.00');
  expect(formatRecordMoney(fill, fill.pricePerLiter)).toBe('₹ 125.00');
  expect(recordCurrency(fill)).toBe('INR');
  expect(symbolFor('USD')).toBe('$');
});

test('money is formatted the same way everywhere and never converted', () => {
  expect(formatMoney(5062.5, '৳')).toBe('৳ 5,062.50');
  expect(formatMoney(3500, '৳')).toBe('৳ 3,500.00');
  expect(formatMoney(undefined, '৳')).toBe('৳ 0.00');
  expect(formatMoney(1234.5)).toBe('1,234.50');
});

test('every record is shown in the app currency, never converted', () => {
  expect(recordCurrency({ totalCost: 1500, currency: 'BDT' })).toBe(recordCurrency({ currency: 'INR' }));
  expect(recordCurrency({})).toBe(recordCurrency(undefined));
});

test('fuel totals add up every log', () => {
  const day = d => new Date(`2026-10-${d}T12:00:00`);
  const logs = computeFuelEfficiency([
    { date: day(1), odometer: 1000, liters: 30, totalCost: 3000, fullTank: true, fuelType: 'Petrol', currency: 'INR' },
    { date: day(10), odometer: 1300, liters: 20, totalCost: 2500, fullTank: true, fuelType: 'Petrol', currency: 'USD' },
  ]);
  const second = logs.find(l => l.currency === 'USD');
  expect(second.efficiency).toBe(15);
  expect(second.costPerKm).toBeCloseTo(2500 / 300);
  const sum = summarizeFuel(logs);
  expect(sum.totalCost).toBe(5500);
});
