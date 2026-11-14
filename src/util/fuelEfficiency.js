import { toMillis } from './dateStatus.js';
import { KM_TO_MI } from './schedule/scheduleMath';
import { recordCurrency } from './methods/useCurrency.js';
import { t } from '../i18n';
import { t as tr } from '../i18n';

// Every amount is in the app currency (see useCurrency.js).
const currencyOf = log => recordCurrency(log);

// Quantity unit per fuel type: liquid fuel is sold by volume (L), CNG/LPG by
// weight (kg), electricity by energy (kWh). Efficiency is km per that unit.
export const fuelUnit = fuelType =>
  fuelType === 'EV Charge' ? 'kWh' : fuelType === 'CNG' || fuelType === 'LPG' ? 'kg' : 'L';

export const efficiencyUnit = fuelType => `km/${fuelUnit(fuelType)}`;

// Fill-ups happen in date order. Sorting by odometer would put every log
// without a reading (stored as 0) at the very start of the history.
const byDate = (a, b) =>
  (toMillis(a.date) ?? 0) - (toMillis(b.date) ?? 0) ||
  (Number(a.odometer) || 0) - (Number(b.odometer) || 0) ||
  (toMillis(a.createdAt) ?? 0) - (toMillis(b.createdAt) ?? 0);

// Fill-up to fill-up (simplified spec): every fill-up is a measuring point.
// Economy at a fill-up is the distance since the previous reading divided by
// the fuel bought since then (this fill plus any logged in between without a
// reading). There is no "filled to full" or "missed fill-up" flag; old logs
// that still carry them are treated the same as any other.
//   - the first fill-up only sets the starting point → no economy yet
//   - a log without an odometer reading can't start or end a stretch (its
//     position is unknown), but its fuel still counts towards the next one
// Each fuel unit is tracked separately (a bi-fuel car's CNG and petrol tanks).
//
// Adds to every log:
//   distance    km since the previous log with a reading (null when unknown)
//   efficiency  km per unit for the stretch ending here, or null
//   tripDistance / tripQty / tripCost   the stretch the efficiency covers
//   costPerKm   tripCost / tripDistance, or null. In the log's own currency;
//               null when the stretch mixes currencies (never converted)
//   status      'measured' | 'first' | 'noOdometer'
export const computeFuelEfficiency = (logs = []) => {
  const ascending = [...logs].sort(byDate);
  const chains = {}; // fuelType → { anchor, qty, cost }
  let previousOdometer = null;

  const withEfficiency = ascending.map(log => {
    const odometer = Math.max(Number(log.odometer) || 0, 0);
    const qty = Number(log.liters) || 0;
    const cost = Number(log.totalCost) || 0;
    const unit = fuelUnit(log.fuelType);
    const chain = chains[unit] || (chains[unit] = { anchor: null, qty: 0, cost: 0, currencies: new Set() });

    // 0 is a real reading only as the very first one (a new vehicle starts
    // there). Once a higher reading exists, 0 can only mean "not entered" —
    // odometers don't run backwards — as do blanks from older logs.
    const entered = log.odometer !== '' && log.odometer != null;
    const hasReading = odometer > 0 || (entered && previousOdometer === null);
    const distance = !hasReading || previousOdometer === null
      ? null
      : Math.max(odometer - previousOdometer, 0);
    if (hasReading) previousOdometer = odometer;

    const result = {
      ...log,
      hasReading,
      distance,
      efficiency: null,
      tripDistance: null,
      tripQty: null,
      tripCost: null,
      costPerKm: null,
      status: 'first',
    };

    if (chain.anchor !== null) {
      chain.qty += qty;
      chain.cost += cost;
      if (cost > 0) chain.currencies.add(currencyOf(log));
    }

    if (!hasReading) {
      result.status = 'noOdometer';
      return result;
    }

    if (chain.anchor !== null && odometer > chain.anchor && chain.qty > 0) {
      const tripDistance = odometer - chain.anchor;
      // Amounts in different currencies can't be added without converting.
      const oneCurrency = chain.currencies.size <= 1
        && (chain.currencies.size === 0 || chain.currencies.has(currencyOf(log)));
      Object.assign(result, {
        status: 'measured',
        tripDistance,
        tripQty: chain.qty,
        tripCost: oneCurrency ? chain.cost : null,
        efficiency: tripDistance / chain.qty,
        costPerKm: oneCurrency && chain.cost > 0 ? chain.cost / tripDistance : null,
      });
    }

    // This fill-up is the starting point for the next stretch.
    chain.anchor = odometer;
    chain.qty = 0;
    chain.cost = 0;
    chain.currencies = new Set();
    return result;
  });

  // Newest first, matching services/documents lists.
  return withEfficiency.sort((a, b) => (toMillis(b.date) ?? 0) - (toMillis(a.date) ?? 0));
};

// Totals for a vehicle's fuel history (logs from computeFuelEfficiency).
// Economy figures only use measured full-to-full stretches; mixed units are
// summarised by the most-used one so km/L and km/kWh never get averaged.
export const summarizeFuel = (logs = []) => {
  if (!logs.length) return null;

  const unitCounts = {};
  logs.forEach(l => {
    const u = fuelUnit(l.fuelType);
    unitCounts[u] = (unitCounts[u] || 0) + 1;
  });
  const unit = Object.keys(unitCounts).sort((a, b) => unitCounts[b] - unitCounts[a])[0];
  const ofUnit = logs.filter(l => fuelUnit(l.fuelType) === unit);
  const measured = ofUnit.filter(l => l.efficiency != null);

  const sum = (list, key) => list.reduce((s, l) => s + (Number(l[key]) || 0), 0);
  const tripDistance = sum(measured, 'tripDistance');
  const tripQty = sum(measured, 'tripQty');
  const tripCost = sum(measured, 'tripCost');

  const readings = logs
    .filter(l => l.hasReading ?? Number(l.odometer) > 0)
    .map(l => Number(l.odometer) || 0);
  const totalQty = sum(ofUnit, 'liters');
  const totalQtyCost = sum(ofUnit, 'totalCost');

  // Money totals only when every log is in the same currency: saved amounts
  // are never converted, and adding ৳ to $ would be meaningless.
  const codes = [...new Set(logs.filter(l => Number(l.totalCost) > 0).map(currencyOf))];
  const currency = codes.length <= 1 ? (codes[0] || currencyOf(logs[0])) : null;

  return {
    unit,
    effUnit: `km/${unit}`,
    fillUps: logs.length,
    currency, // null when the logs mix currencies (money figures are then null)
    totalCost: currency ? sum(logs, 'totalCost') : null,
    totalQty,
    distance: readings.length > 1 ? Math.max(...readings) - Math.min(...readings) : 0,
    avgEfficiency: tripQty > 0 ? tripDistance / tripQty : null,
    // logs are newest first, so the first measured one is the latest stretch
    lastEfficiency: measured[0]?.efficiency ?? null,
    bestEfficiency: measured.length ? Math.max(...measured.map(l => l.efficiency)) : null,
    costPerKm: currency && tripDistance > 0 && tripCost > 0 ? tripCost / tripDistance : null,
    avgPrice: currency && totalQty > 0 ? totalQtyCost / totalQty : null,
  };
};

// Quantity, price per unit and total are linked: given any two, the third
// follows. `edited` lists the amount fields the user typed, most recent last;
// the one not among the last two is recalculated. Until two are typed, the
// price counts as known (so qty → total, total → qty).
// Returns the patch to merge into the form.
const AMOUNT_KEYS = ['liters', 'pricePerLiter', 'totalCost'];
const round = (n, dp) => String(Math.round(n * 10 ** dp) / 10 ** dp);

export const linkFuelAmounts = (form, edited) => {
  const recent = edited.filter(k => AMOUNT_KEYS.includes(k)).slice(-2);
  ['pricePerLiter', 'liters'].forEach(k => {
    if (recent.length < 2 && !recent.includes(k)) recent.unshift(k);
  });
  const target = AMOUNT_KEYS.find(k => !recent.includes(k));
  const q = parseFloat(form.liters);
  const p = parseFloat(form.pricePerLiter);
  const total = parseFloat(form.totalCost);
  if (target === 'totalCost') return q > 0 && p > 0 ? { totalCost: round(q * p, 2) } : {};
  if (target === 'liters') return total > 0 && p > 0 ? { liters: round(total / p, 2) } : {};
  return total > 0 && q > 0 ? { pricePerLiter: round(total / q, 2) } : {};
};

// Short badge text for a log in lists.
// `distUnit` 'mi' shows economy per mile (stored figures are per km).
export const fuelBadge = (log, distUnit = 'km') =>
  log.efficiency != null
    ? distUnit === 'mi'
      ? `${(log.efficiency * KM_TO_MI).toFixed(1)} mi/${fuelUnit(log.fuelType)}`
      : `${log.efficiency.toFixed(1)} ${efficiencyUnit(log.fuelType)}`
    : log.status === 'noOdometer' ? t('rec.noOdometer')
    : t('rec.firstFill');

// One line explaining a log's economy (or why there isn't one yet).
export const fuelEconomyNote = (log, distUnit = 'km') => {
  const unit = fuelUnit(log.fuelType);
  if (log.efficiency != null) {
    const dist = Math.round(distUnit === 'mi' ? log.tripDistance * KM_TO_MI : log.tripDistance);
    return tr('{0} {1} on {2} {3} since the previous fill-up', { 0: dist.toLocaleString('en-US'), 1: distUnit, 2: Number(log.tripQty.toFixed(2)), 3: unit });
  }
  if (log.status === 'noOdometer') {
    return tr('No odometer reading, so economy can\'t start or end at this fill-up. Add one to measure it.');
  }
  return tr('Starting point — economy shows from your next fill-up.');
};
