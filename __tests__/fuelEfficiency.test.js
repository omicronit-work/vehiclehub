import { computeFuelEfficiency } from '../src/util/fuelEfficiency';

const log = (id, date, odometer, liters, totalCost, fullTank = false) => ({
  id, date: new Date(date), odometer, liters, totalCost, fullTank,
});

const byId = logs => Object.fromEntries(logs.map(l => [l.id, l]));

test('mileage is the distance since the previous log over this log\'s fuel', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 45000, 40, 4000),
    log('b', '2026-01-10', 45500, 40, 4000),
  ]));

  expect(result.a.measuredFrom).toBe('zero'); // no earlier reading: measured from 0 km
  expect(result.a.efficiency).toBeCloseTo(1125); // 45,000 km / 40 L
  expect(result.b.distance).toBe(500);
  expect(result.b.efficiency).toBeCloseTo(12.5); // 500 km / 40 L
  expect(result.b.costPerKm).toBeCloseTo(8); // 4000 / 500 km
});

test('partial and full fills both get mileage', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 10000, 40, 4000, true),
    log('b', '2026-01-05', 10200, 10, 1000, false),
    log('c', '2026-01-10', 10600, 30, 3000, true),
  ]));

  expect(result.b.efficiency).toBeCloseTo(20); // 200 km / 10 L
  expect(result.c.efficiency).toBeCloseTo(400 / 30);
});

test('logs sharing a reading are measured from the closest lower one', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 10000, 40, 4000),
    log('b', '2026-01-05', 10300, 10, 1000),
    log('c', '2026-01-06', 10300, 20, 2000),
  ]));
  expect(result.b.efficiency).toBeCloseTo(30); // 300 km / 10 L
  expect(result.c.efficiency).toBeCloseTo(15); // 300 km / 20 L, not 0 km
});

test('the first fill-up is measured from the closest lower service mileage', () => {
  const services = [{ currentMileage: 9000 }, { currentMileage: 9600 }, { currentMileage: 12000 }];
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 10000, 40, 4000),
    log('b', '2026-01-10', 10500, 25, 2500),
  ], services));

  expect(result.a.measuredFrom).toBe('service');
  expect(result.a.distance).toBe(400); // from the 9,600 km service
  expect(result.a.efficiency).toBeCloseTo(10);
  expect(result.b.measuredFrom).toBe('fuel'); // fuel logs still win when available
  expect(result.b.efficiency).toBeCloseTo(20);
});

test('zero odometer or zero fuel shows 0, never blank', () => {
  const result = byId(computeFuelEfficiency([
    log('noOdo', '2026-01-01', 0, 10, 100),
    log('noFuel', '2026-01-02', 500, 0, 0),
  ]));
  expect(result.noOdo.efficiency).toBe(0);
  expect(result.noFuel.efficiency).toBe(0);
});

test('returns logs newest first', () => {
  const result = computeFuelEfficiency([
    log('old', '2026-01-01', 1000, 10, 100),
    log('new', '2026-02-01', 1200, 10, 100),
  ]);
  expect(result.map(l => l.id)).toEqual(['new', 'old']);
});
