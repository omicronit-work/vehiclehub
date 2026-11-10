import { computeFuelEfficiency, fuelBadge } from '../src/util/fuelEfficiency';

const log = (id, date, odometer, liters, totalCost, fullTank = false, extra = {}) => ({
  id, date: new Date(date), odometer, liters, totalCost, fullTank, ...extra,
});

const byId = logs => Object.fromEntries(logs.map(l => [l.id, l]));

test('economy is measured from one fill-up to the next', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 45000, 40, 4000),
    log('b', '2026-01-10', 45500, 40, 4000),
  ]));

  expect(result.a.status).toBe('first');
  expect(result.a.efficiency).toBeNull();
  expect(fuelBadge(result.a)).toBe('First fill-up');
  expect(result.b.distance).toBe(500);
  expect(result.b.efficiency).toBeCloseTo(12.5); // 500 km / 40 L
  expect(result.b.costPerKm).toBeCloseTo(8); // 4000 / 500 km
});

test('every fill-up is measured; no "partial fill" status', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 10000, 40, 4000, true),
    log('b', '2026-01-05', 10200, 10, 1000, false),
    log('c', '2026-01-10', 10600, 30, 3000, true),
  ]));

  expect(result.b.status).toBe('measured');
  expect(result.b.efficiency).toBeCloseTo(200 / 10);
  expect(fuelBadge(result.b)).not.toMatch(/partial/i);
  expect(result.c.efficiency).toBeCloseTo(400 / 30);
});

test('old "missed fill-up" flags are ignored', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-01-01', 10000, 40, 4000, true),
    log('b', '2026-01-10', 10600, 30, 3000, true, { missedPrevious: true }),
  ]));

  expect(result.b.status).toBe('measured');
  expect(result.b.efficiency).toBeCloseTo(20); // 600 km / 30 L
});

test('a first fill-up at 0 km is a starting point', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-11-01', 0, 12, 1980, true),
    log('b', '2026-11-04', 350, 12, 1980, true),
  ]));

  expect(result.a.status).toBe('first');
  expect(result.a.efficiency).toBeNull();
  expect(result.b.efficiency).toBeCloseTo(350 / 12);
});

test('a fill-up without an odometer reading is never a starting point', () => {
  const result = byId(computeFuelEfficiency([
    log('a', '2026-10-01', '', 12, 1980),
    log('b', '2026-10-27', 750, 3.03, 500),
    log('c', '2026-11-03', 900, 5, 800),
  ]));

  expect(result.a.status).toBe('noOdometer');
  expect(fuelBadge(result.a)).toBe('No odometer');
  expect(result.b.status).toBe('first'); // the first reading starts measuring
  expect(result.c.efficiency).toBeCloseTo(150 / 5);
});

test('a log without a reading keeps its place by date and its fuel still counts', () => {
  const result = byId(computeFuelEfficiency([
    log('x', '2026-10-01', 1000, 10, 100, true),
    log('y', '2026-10-20', 0, 10, 100, true),
    log('z', '2026-11-01', 1300, 10, 100, true),
  ]));

  // Previously y sorted first, so x reported 1000 km / 10 L.
  expect(result.x.status).toBe('first');
  expect(result.x.efficiency).toBeNull();
  expect(result.y.status).toBe('noOdometer');
  expect(result.y.distance).toBeNull();
  expect(result.z.efficiency).toBeCloseTo(15); // 300 km / (10 + 10) L
});

test('returns logs newest first', () => {
  const result = computeFuelEfficiency([
    log('old', '2026-01-01', 1000, 10, 100),
    log('new', '2026-02-01', 1200, 10, 100),
  ]);
  expect(result.map(l => l.id)).toEqual(['new', 'old']);
});
