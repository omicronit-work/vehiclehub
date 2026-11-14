export const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
];
// ISO country -> currency code, for the currencies in the list above.
const EUROZONE = ['DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'IE', 'FI', 'GR',
  'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR', 'MC', 'SM', 'VA', 'AD', 'ME', 'XK'];
const COUNTRY_TO_CURRENCY = {
  US: 'USD', GB: 'GBP', BD: 'BDT', IN: 'INR', JP: 'JPY', CN: 'CNY', AU: 'AUD', CA: 'CAD',
  NP: 'NPR', LK: 'LKR', CH: 'CHF', LI: 'CHF', AE: 'AED', SA: 'SAR', PK: 'PKR', MY: 'MYR', SG: 'SGD', TH: 'THB',
  ID: 'IDR', KR: 'KRW', PH: 'PHP', VN: 'VND', HK: 'HKD', NZ: 'NZD', ZA: 'ZAR', TR: 'TRY',
  RU: 'RUB', BR: 'BRL', EG: 'EGP', NG: 'NGN', SE: 'SEK', PL: 'PLN', QA: 'QAR', KW: 'KWD',
  ...Object.fromEntries(EUROZONE.map(c => [c, 'EUR'])),
};

export const DEFAULT_CURRENCY = currencies.find(c => c.code === 'USD');

// The currency for a country; US Dollar when the country is unknown or its
// currency isn't in the list.
export const currencyForCountry = country =>
  currencies.find(c => c.code === COUNTRY_TO_CURRENCY[country]) || DEFAULT_CURRENCY;
