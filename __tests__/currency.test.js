import { toBaseAmount, toDisplayAmount } from '../src/util/methods/useCurrency';

test('display amounts are stored in the base currency and round-trip back', () => {
  const rate = 0.00813; // 1 BDT -> USD
  const stored = toBaseAmount('50', rate);
  expect(stored).toBeCloseTo(6150.06, 1);
  expect(toDisplayAmount(stored, rate)).toBe('50');
});

test('empty input stays empty and zero stays zero', () => {
  expect(toBaseAmount('', 2)).toBeNull();
  expect(toDisplayAmount(null, 2)).toBe('');
  expect(toBaseAmount('0', 2)).toBe(0);
  expect(toDisplayAmount(0, 2)).toBe('0');
});
