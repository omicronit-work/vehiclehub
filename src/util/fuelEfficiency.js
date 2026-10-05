import { toMillis } from './dateStatus.js';

// Quantity unit per fuel type: liquid fuel is sold by volume (L), CNG by
// weight (kg), electricity by energy (kWh). Efficiency is km per that unit.
export const fuelUnit = fuelType =>
  fuelType === 'EV Charge' ? 'kWh' : fuelType === 'CNG' ? 'kg' : 'L';

export const efficiencyUnit = fuelType => `km/${fuelUnit(fuelType)}`;

// Highest reading in `readings` strictly below `odometer`, or null.
const closestReadingBelow = (readings, odometer) =>
  readings.reduce((best, r) => (r < odometer && (best === null || r > best) ? r : best), null);

const validReadings = values =>
  values.map(Number).filter(n => Number.isFinite(n) && n > 0);

// `odometer` is the vehicle's total reading. Each log's mileage is the distance
// from the closest lower fuel-log reading to this one, divided by the fuel
// added here — for full and partial fills alike (logs with the same reading
// are skipped over, not measured as 0 km). When no fuel log sits below it,
// the closest lower service mileage is the starting point; with no earlier
// reading at all it's measured from 0 km. Every log always gets a number:
// a 0 odometer or 0 fuel simply shows 0.
export const computeFuelEfficiency = (logs = [], services = []) => {
  const fuelReadings = validReadings(logs.map(l => l.odometer));
  const serviceReadings = validReadings(services.map(s => s.currentMileage));

  const withEfficiency = logs.map(log => {
    const odometer = Math.max(Number(log.odometer) || 0, 0);
    const liters = Number(log.liters) || 0;

    let start = closestReadingBelow(fuelReadings, odometer);
    let measuredFrom = 'fuel';
    if (start === null) {
      start = closestReadingBelow(serviceReadings, odometer);
      measuredFrom = 'service';
    }
    if (start === null) {
      start = 0;
      measuredFrom = 'zero';
    }

    const distance = odometer - start;
    const efficiency = liters > 0 ? distance / liters : 0; // km per fuelUnit(log.fuelType)
    const costPerKm = distance > 0 ? (Number(log.totalCost) || 0) / distance : null;

    return { ...log, distance, efficiency, costPerKm, measuredFrom };
  });

  // Newest first, matching services/documents lists.
  return withEfficiency.sort((a, b) => (toMillis(b.date) ?? 0) - (toMillis(a.date) ?? 0));
};
