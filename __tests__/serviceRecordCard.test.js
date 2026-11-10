import { evaluateServiceRecord } from '../src/components/schedule/ServiceRecordCard';

const DAY = 24 * 60 * 60 * 1000;
const at = days => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return new Date(d.getTime() + days * DAY);
};
const money = v => `৳ ${Number(v).toFixed(2)}`;

describe('service record card', () => {
  it('shows a completed service with cost, odometer and when it was done', () => {
    const e = evaluateServiceRecord(
      { name: 'Engine oil refill', serviceDate: at(-1), totalCost: 750, currentMileage: 25000, oilBrand: 'BMW Genuine', oilGrade: '10W-40', oilFilterChanged: 'Yes' },
      { money },
    );
    expect(e.chip).toBe('Completed');
    expect(e.status).toBe('ok');
    expect(e.cost).toBe('৳ 750.00');
    expect(e.odometer).toBe('25,000 km');
    expect(e.footer.label).toBe('SERVICED');
    expect(e.pill).toBe('Yesterday');
    expect(e.sub).not.toMatch(/Yes/);
  });

  it('shows dashes when cost and odometer are missing', () => {
    const e = evaluateServiceRecord({ name: 'Car wash', serviceDate: at(-90) }, { money });
    expect(e.cost).toBe('—');
    expect(e.odometer).toBe('—');
    expect(e.pill).toBeNull();
  });

  it('uses the next due date and distance when set', () => {
    const e = evaluateServiceRecord(
      { name: 'Engine oil refill', serviceDate: at(-10), nextServiceDate: at(10), nextServiceMileage: 30000 },
      { money, unit: 'km', currentOdometer: 25000 },
    );
    expect(e.chip).toBe('Due soon');
    expect(e.footer.label).toBe('NEXT DUE');
    expect(e.footer.value).toMatch(/or 30,000 km$/);
    expect(e.pill).toBe('Due in 10 days');
  });

  it('lets an overdue distance outrank a later date', () => {
    const e = evaluateServiceRecord(
      { name: 'Engine oil refill', serviceDate: at(-10), nextServiceDate: at(120), nextServiceMileage: 24000 },
      { money, currentOdometer: 25000 },
    );
    expect(e.status).toBe('overdue');
    expect(e.chip).toBe('Overdue');
    expect(e.pill).toBe('Overdue by 1,000 km');
  });

  it('treats a superseded service as history', () => {
    const e = evaluateServiceRecord(
      { name: 'Engine oil refill', serviceDate: at(-200), nextServiceDate: at(-20), superseded: true },
      { money },
    );
    expect(e.chip).toBe('Completed');
    expect(e.footer.label).toBe('SERVICED');
  });
});
