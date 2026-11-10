import { fuelTypesFor, fuelLabel, fuelDisplayName } from '../src/util/fuelTypes';

const labels = country => fuelTypesFor(country).map(t => t.label);

describe('fuel types by country', () => {
  it('keeps the Bangladesh names', () => {
    expect(labels('BD')).toEqual(['Petrol', 'Octane', 'Diesel', 'Autogas (LPG)', 'CNG', 'EV Charge']);
  });

  it('shows Thai pump names in Thailand, stored under the same keys', () => {
    expect(labels('TH')).toContain('Gasohol 91');
    expect(labels('TH')).toContain('NGV');
    expect(fuelLabel('Octane', 'TH')).toBe('Gasohol 95');
    expect(fuelTypesFor('TH').find(t => t.label === 'Gasohol 95').key).toBe('Octane');
  });

  it('maps countries that share a table', () => {
    expect(fuelLabel('Petrol', 'IE')).toBe('Unleaded (E10)');
    expect(fuelLabel('Octane', 'AT')).toBe('Petrol 98');
    expect(fuelLabel('Petrol', 'BE')).toBe('Euro 95 (E10)');
  });

  it('falls back to generic names for unknown countries', () => {
    expect(fuelLabel('Octane', 'ZZ')).toBe('Premium');
  });

  it("keeps an edited record's fuel selectable in another country", () => {
    expect(fuelTypesFor('BD', 'Gasohol E20').map(t => t.key)).toContain('Gasohol E20');
  });

  it('shows the name a log was bought under, else its type', () => {
    expect(fuelDisplayName({ fuelType: 'Octane', fuelName: 'Gasohol 95' })).toBe('Gasohol 95');
    expect(fuelDisplayName({ fuelType: 'Octane' })).toBe('Octane');
  });
});

describe('India', () => {
  it('lists the petrol grades and premium diesel', () => {
    expect(fuelTypesFor('IN').map(t => t.label)).toEqual([
      'Normal Petrol (E20)', 'Premium 95', 'Premium 100', 'Diesel', 'Premium Diesel', 'CNG', 'Auto LPG', 'EV Charge',
    ]);
  });
});

describe('grades per country', () => {
  it.each([
    ['US', ['Regular (87)', 'Mid-grade (89)', 'Premium (91–93)']],
    ['DE', ['Super E10', 'Super E5', 'Super Plus 98']],
    ['FR', ['SP95-E10', 'SP95', 'SP98', 'Superéthanol E85']],
    ['MY', ['RON95', 'RON97', 'RON100']],
    ['ID', ['Pertalite', 'Pertamax', 'Pertamax Green 95', 'Pertamax Turbo']],
    ['PK', ['Super Petrol (RON 92)', 'Hi-Octane (HOBC 97)']],
    ['AE', ['E-Plus 91', 'Special 95', 'Super 98']],
    ['CN', ['92#', '95#', '98#']],
    ['RU', ['AI-92', 'AI-95', 'AI-98/100']],
    ['BR', ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Premium', 'Etanol']],
  ])('%s has its petrol grades', (country, grades) => {
    expect(labels(country)).toEqual(expect.arrayContaining(grades));
  });

  it('every country table has no duplicate fuel keys', () => {
    ['BD', 'IN', 'PK', 'NP', 'LK', 'TH', 'MY', 'ID', 'PH', 'VN', 'SG', 'CN', 'HK', 'KR', 'JP', 'AE',
      'SA', 'QA', 'KW', 'OM', 'BH', 'TR', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'RU', 'US', 'CA',
      'BR', 'EG', 'NG', 'ZA', 'AU', 'NZ', 'ZZ'].forEach(c => {
      const keys = fuelTypesFor(c).map(t => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
