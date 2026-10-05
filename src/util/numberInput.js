// Decimal text-input sanitiser. Many locales' decimal-pad shows ',' as the
// separator, so treat it as '.', then keep only digits and the first '.'.
// '12,5' -> '12.5', '1.2.3' -> '1.23'.
export const sanitizeDecimal = v => {
  const [whole, ...rest] = String(v ?? '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '')
    .split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
};
