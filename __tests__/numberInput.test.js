import { sanitizeDecimal } from '../src/util/numberInput';

test('comma decimal separator is kept as a decimal point', () => {
  expect(sanitizeDecimal('12,5')).toBe('12.5');
});

test('only one decimal separator survives', () => {
  expect(sanitizeDecimal('1.2.3')).toBe('1.23');
  expect(sanitizeDecimal('1,2.3,4')).toBe('1.234');
  expect(sanitizeDecimal('1.2.3.4.5')).toBe('1.2345');
});

test('non-numeric characters are stripped', () => {
  expect(sanitizeDecimal(' 1a0 ')).toBe('10');
  expect(sanitizeDecimal('')).toBe('');
});
