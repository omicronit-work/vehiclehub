import {
  computeRunningCost,
  perKmParts,
  periodRange,
  daysInRange,
  monthsInRange,
  roundHalfUp,
} from '../src/util/runningCost';

// Spec §5 worked example: Honda Accord RS, THB, 1 Jan – 31 Mar 2027.
const d = (y, m, day) => new Date(y, m - 1, day, 12);
const TODAY = d(2027, 3, 31).getTime();

const fuel = (date, odometer, liters, totalCost, fuelType = 'Gasohol 95') =>
  ({ date, odometer, liters, totalCost, fuelType });

const exampleLogs = () => [
  fuel(d(2027, 1, 5), 2000, 40, 1660, 'Gasohol 95'),
  fuel(d(2027, 1, 25), 2520, 38, 1577, 'Gasohol 95'),
  fuel(d(2027, 2, 12), 2900, 20, 830, 'E20'),
  fuel(d(2027, 2, 28), 3320, 29, 1203.5, 'E20'),
  fuel(d(2027, 3, 15), 3880, 36, 1494, 'Gasohol 95'),
  fuel(d(2027, 3, 31), 4410, 33, 1369.5, 'Gasohol 95'),
];
const exampleServices = () => [
  { serviceDate: d(2027, 2, 20), name: 'Engine oil refill', totalCost: 3200 },
  { serviceDate: d(2027, 3, 10), name: 'Air filter', totalCost: 450 },
];

const run = (overrides = {}) =>
  computeRunningCost({
    fuelLogs: exampleLogs(),
    services: exampleServices(),
    period: 'year',
    today: TODAY,
    ...overrides,
  });

test('T1: worked example', () => {
  const r = run();
  expect(r.kmDriven).toBe(2410);
  expect(r.litresUsed).toBeCloseTo(156);
  expect(r.economy.toFixed(1)).toBe('15.4');
  expect(r.fuelCost).toBeCloseTo(6474);
  expect(r.serviceCost).toBeCloseTo(3650);
  expect(perKmParts(r.fuelCost, r.serviceCost, r.kmDriven)).toEqual({ fuel: 2.69, service: 1.51, total: 4.2 });
  expect(r.fuelShare).toBe(64);
  expect(100 - r.fuelShare).toBe(36);
  expect(r.totalSpent).toBeCloseTo(11784);
  expect(r.monthly.map(m => roundHalfUp(m.fuel + m.service))).toEqual([3237, 5233.5, 3313.5]);
  expect(r.days).toBe(90);
  expect(r.months).toBe(3);
  expect(roundHalfUp(r.perMonth, 0)).toBe(3928);
});

test('T2: fuel type does not change any figure', () => {
  const logs = exampleLogs();
  logs[2].fuelType = 'Gasohol 95';
  // Only the per-type split (spending chart) may differ; every figure stays.
  const figures = ({ fuelBreakdown, monthly, ...rest }) => ({
    ...rest,
    monthly: monthly.map(({ byFuel, ...m }) => m),
  });
  expect(figures(run({ fuelLogs: logs }))).toEqual(figures(run()));
});

test('spending splits fuel by type and the parts add up', () => {
  const logs = exampleLogs();
  logs[2].fuelType = 'Gasohol 95';
  const r = run({ fuelLogs: logs });
  const byType = r.fuelBreakdown.reduce((s, t) => s + t.spent, 0);
  expect(byType).toBeCloseTo(r.fuelSpent);
  expect(r.fuelBreakdown.reduce((s, t) => s + t.count, 0)).toBe(r.fuelLogCount);
  const logged = logs.reduce((s, f) => s + (Number(f.liters) || 0), 0);
  expect(r.fuelBreakdown.reduce((s, t) => s + t.quantity, 0)).toBeCloseTo(logged);
  r.fuelBreakdown.forEach(t => expect(t.unit).toBe('L'));
  r.monthly.forEach(m => {
    const parts = Object.values(m.byFuel).reduce((s, v) => s + v, 0);
    expect(parts).toBeCloseTo(m.fuel);
  });
});

test('T3: deleting the 12 Feb log', () => {
  const logs = exampleLogs().filter((_, i) => i !== 2);
  const r = run({ fuelLogs: logs });
  expect(r.kmDriven).toBe(2410);
  expect(r.litresUsed).toBeCloseTo(136);
  expect(r.economy.toFixed(1)).toBe('17.7');
  expect(r.fuelCost).toBeCloseTo(5644);
});

test('T4: 30 days uses only its own logs, nothing borrowed', () => {
  const r = run({ period: '30d' });
  // 2 Mar – 31 Mar: logs of 15 and 31 Mar only.
  expect(new Date(r.range.start).getDate()).toBe(2);
  expect(r.fuelLogCount).toBe(2);
  expect(r.kmDriven).toBe(530);
  expect(r.litresUsed).toBeCloseTo(33);
  expect(r.fuelCost).toBeCloseTo(1369.5);
  expect(r.serviceCost).toBe(0); // air filter on 10 Mar is not between 15 and 31 Mar
});

test('T5: an odometer lower than the previous one shows a note, no crash', () => {
  const logs = [...exampleLogs(), fuel(d(2027, 3, 30), 3000, 10, 400)];
  const r = run({ fuelLogs: logs });
  expect(r.odometerWarning).toBe(true);
  expect(r.enoughData).toBe(true);
  expect(r.kmDriven).toBe(2410); // first and last by odometer order
});

test('T6: a service with no cost counts as 0 and is counted', () => {
  const r = run({ services: [...exampleServices(), { serviceDate: d(2027, 3, 1), name: 'Check-up', totalCost: '' }] });
  expect(r.totalSpent).toBeCloseTo(11784);
  expect(r.serviceCost).toBeCloseTo(3650);
  expect(r.servicesWithoutCost).toBe(1);
});

test('T7: one fuel log has no running cost but total spent works', () => {
  const r = run({ fuelLogs: exampleLogs().slice(0, 1) });
  expect(r.enoughData).toBe(false);
  expect(r.economy).toBeNull();
  expect(r.totalSpent).toBeCloseTo(1660 + 3650);
});

test('T10: monthly bars add up to total spent', () => {
  const r = run({ period: 'all' });
  const sum = r.monthly.reduce((s, m) => s + m.fuel + m.service, 0);
  expect(sum).toBeCloseTo(r.totalSpent);
});

test('future-dated records are ignored', () => {
  const r = run({ fuelLogs: [...exampleLogs(), fuel(d(2027, 4, 5), 5000, 30, 1200)] });
  expect(r.kmDriven).toBe(2410);
  expect(r.totalSpent).toBeCloseTo(11784);
});

test('periods', () => {
  const range = periodRange('3m', TODAY);
  expect(new Date(range.start).toDateString()).toBe(new Date(2027, 0, 1).toDateString());
  // 31 May has no 31 Feb: from 28 Feb plus a day.
  const may = periodRange('3m', d(2027, 5, 31).getTime());
  expect(new Date(may.start).toDateString()).toBe(new Date(2027, 2, 1).toDateString());
  expect(daysInRange(periodRange('30d', TODAY))).toBe(30);
  expect(monthsInRange(periodRange('30d', TODAY))).toBe(1);
  expect(periodRange('all', TODAY, null)).toBeNull();
});

test('miles show cost per mile', () => {
  const parts = perKmParts(6474, 3650, 2410, 1, 'mi');
  expect(parts.fuel).toBeCloseTo(4.32, 2);
});
