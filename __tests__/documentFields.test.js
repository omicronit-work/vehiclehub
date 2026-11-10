import {
  suggestExpiry,
  getDocumentFields,
  resolveDocumentType,
  documentSummary,
  getDocumentIconKey,
} from '../src/util/documentFields';

const issue = new Date(2026, 0, 15);
const ym = d => [d.getFullYear(), d.getMonth(), d.getDate()];

describe('documentFields', () => {
  it('matches typed names to built-in types', () => {
    expect(resolveDocumentType('Car insurance 2026')?.name).toBe('Insurance');
    expect(resolveDocumentType('DL')?.name).toBe('Driving licence');
    expect(resolveDocumentType('Tax token')?.name).toBe('Tax token');
    expect(resolveDocumentType('Parking pass')).toBeNull();
    expect(getDocumentIconKey('Parking pass')).toBe('document');
  });

  it('gives custom names a generic form', () => {
    expect(getDocumentFields('Parking pass').map(f => f.key)).toEqual(['documentNumber', 'issuingOffice']);
    expect(getDocumentFields('')).toEqual([]);
  });

  it('suggests expiry from the validity rule', () => {
    expect(ym(suggestExpiry({ name: 'Insurance', issueDate: issue, details: {} }).expiryDate)).toEqual([2027, 0, 15]);
    // Licence type decides the term; without it the 10-year fallback applies.
    expect(ym(suggestExpiry({ name: 'Driving licence', issueDate: issue, details: { licenceType: 'Professional' } }).expiryDate)).toEqual([2031, 0, 15]);
    expect(ym(suggestExpiry({ name: 'Driving licence', issueDate: issue, details: {} }).expiryDate)).toEqual([2036, 0, 15]);
    expect(ym(suggestExpiry({ name: 'Tax token', issueDate: issue, details: { validityYears: '2 years' } }).expiryDate)).toEqual([2028, 0, 15]);
    // Warranty needs its months first.
    expect(suggestExpiry({ name: 'Warranty', issueDate: issue, details: {} })).toBeNull();
    expect(suggestExpiry({ name: 'Parking pass', issueDate: issue, details: {} })).toBeNull();
  });

  it('summarises key text details for list cards', () => {
    expect(documentSummary({ documentName: 'Insurance', insurer: 'Green Delta', policyNumber: 'P-1', coverType: 'Comprehensive' }))
      .toBe('Green Delta · P-1');
    expect(documentSummary({ documentName: 'Insurance' })).toBe('');
  });
});

describe('document types per country', () => {
  const { documentTypesFor, getDocumentFields, resolveDocumentType } = require('../src/util/documentFields');
  const names = c => documentTypesFor(c).map(t => t.name);

  it('Thailand gets Por Ror Bor and road tax, not Bangladeshi papers', () => {
    expect(names('TH')).toEqual(expect.arrayContaining(['Compulsory insurance (Por Ror Bor)', 'Road tax', 'Vehicle inspection']));
    expect(names('TH')).not.toContain('Tax token');
    expect(names('TH')).not.toContain('Fitness certificate');
    expect(getDocumentFields('Insurance', 'TH').find(f => f.key === 'insurer').placeholder).not.toMatch(/Green Delta/);
    expect(getDocumentFields('Driving licence', 'TH').find(f => f.key === 'licenceType').options).toContain('Private (5 years)');
  });

  it('Bangladesh keeps tax token and fitness with local examples', () => {
    expect(names('BD')).toEqual(expect.arrayContaining(['Tax token', 'Fitness certificate']));
    expect(getDocumentFields('Insurance', 'BD').find(f => f.key === 'insurer').placeholder).toMatch(/Green Delta/);
  });

  it('other countries get a neutral list', () => {
    expect(names('US')).not.toContain('Tax token');
    expect(getDocumentFields('Insurance', 'US').find(f => f.key === 'insurer').placeholder).not.toMatch(/Green Delta/);
  });

  it("a record's own type stays selectable when edited elsewhere", () => {
    expect(documentTypesFor('TH', 'Tax token').map(t => t.name)).toContain('Tax token');
  });

  it('typed Thai names find their type', () => {
    expect(resolveDocumentType('พ.ร.บ 2026')?.name).toBe('Compulsory insurance (Por Ror Bor)');
    expect(resolveDocumentType('Road tax 2027')?.name).toBe('Road tax');
  });
});
