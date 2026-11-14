import { computeFleetRunningCost } from '../src/util/runningCost';

const today = new Date(2026, 10, 11).getTime();
const d = (m, day) => new Date(2026, m, day);
const fuel = (date, odometer, liters, totalCost) => ({ date, odometer, liters, totalCost, fuelType: 'Petrol' });

test('adds vehicles together, each from its own odometer', () => {
  const a = { fuelLogs: [fuel(d(0, 1), 1000, 10, 100), fuel(d(1, 1), 1200, 10, 100)], services: [{ serviceDate: d(0, 15), totalCost: 50 }] };
  const b = { fuelLogs: [fuel(d(2, 1), 50000, 20, 200), fuel(d(3, 1), 50300, 20, 200)], services: [] };
  const r = computeFleetRunningCost({ vehicles: [a, b], period: 'year', today });
  expect(r.kmDriven).toBe(500);
  expect(r.fuelCost).toBe(300);
  expect(r.serviceCost).toBe(50);
  expect(r.economy).toBe(500 / 30);
  expect(r.totalSpent).toBe(650);
  expect(r.startCost).toBe(300);
  expect(r.vehiclesCounted).toBe(2);
});

test('a vehicle without two logs is left out of per-km but in totals', () => {
  const a = { fuelLogs: [fuel(d(0, 1), 1000, 10, 100), fuel(d(1, 1), 1200, 10, 100)], services: [] };
  const b = { fuelLogs: [fuel(d(2, 1), 50000, 20, 200)], services: [] };
  const r = computeFleetRunningCost({ vehicles: [a, b], period: 'year', today });
  expect(r.kmDriven).toBe(200);
  expect(r.totalSpent).toBe(400);
  expect(r.vehiclesCounted).toBe(1);
  expect(r.vehicleCount).toBe(2);
});
