import { evaluateDocument, spanText } from '../src/components/schedule/DocumentCard';

const DAY = 24 * 60 * 60 * 1000;
const at = days => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return new Date(d.getTime() + days * DAY);
};

describe('document card', () => {
  it('describes how long a document is valid', () => {
    expect(spanText(16)).toBe('16 days');
    expect(spanText(365)).toBe('1 year');
    expect(spanText(730)).toBe('2 years');
    expect(spanText(183)).toBe('6 months');
    expect(spanText(45)).toBe('45 days');
  });

  it('marks expired documents and fills the bar', () => {
    const e = evaluateDocument({ issueDate: at(-60), expiryDate: at(-10) });
    expect(e.chip).toBe('Expired');
    expect(e.time).toEqual({ left: -10, status: 'overdue', fill: 1 });
    expect(e.footer.label).toBe('EXPIRED');
    expect(e.pill).toBe('Renew now');
  });

  it('warns within 30 days and fills by elapsed validity', () => {
    const e = evaluateDocument({ issueDate: at(-75), expiryDate: at(25) });
    expect(e.chip).toBe('Expires soon');
    expect(e.time.status).toBe('soon');
    expect(e.time.fill).toBeCloseTo(0.75, 2);
    expect(e.pill).toBe('Renew soon');
  });

  it('is valid with no pill when far from expiry', () => {
    const e = evaluateDocument({ issueDate: at(-10), expiryDate: at(355) });
    expect(e.chip).toBe('Valid');
    expect(e.sub).toMatch(/valid 1 year$/);
    expect(e.pill).toBeNull();
  });

  it('handles documents without an expiry', () => {
    expect(evaluateDocument({ issueDate: at(-5) })).toMatchObject({ chip: 'No expiry', time: null });
    expect(evaluateDocument({})).toMatchObject({ sub: 'No dates added', footer: null });
  });
});
