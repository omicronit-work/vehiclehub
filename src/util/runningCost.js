import { toMillis } from './dateStatus.js';
import { fuelUnit } from './fuelEfficiency.js';
import { KM_TO_MI } from './schedule/scheduleMath';
import { t as tr } from '../i18n';

/*
 * Running cost and fuel economy for one vehicle over a period
 * (spec "Running Cost and Fuel Economy", draft v2).
 *
 * One idea: litres burned between the first and the last fill-up of the
 * period, over the km between them. The first log is only the starting
 * point: its litres and cost paid for driving before the period. Fuel types
 * are added together; full-tank / partial / missed-fill flags are ignored.
 * Nothing from outside the period is ever borrowed.
 *
 * All amounts are in one currency, never converted: the caller zeroes the
 * cost of records saved in another one (costsInCurrentCurrency), so they
 * count for distance and litres only. Full precision; round
 * only for display (perKmParts, roundHalfUp).
 */

const DAY = 24 * 60 * 60 * 1000;
export const DAYS_PER_MONTH = 30.4375;

// Services colour in the running-cost bars (fuel uses the accent colour).
export const SERVICE_COLOR = '#E0A100';
// Spending chart: one colour per fuel type, in order of spend (the first is
// replaced by the app accent on screen). None is close to SERVICE_COLOR.
export const FUEL_COLORS = ['#127C78', '#3B82F6', '#8B5CF6', '#EF6C57', '#64748B', '#0EA5E9'];
const fuelTypeName = f => String(f.fuelName || f.fuelType || '').trim() || tr('Fuel');

export const PERIODS = [
  { key: '30d', get label() { return tr('30 days'); } },
  { key: '3m', get label() { return tr('3 months'); } },
  { key: 'year', get label() { return tr('This year'); } },
  { key: 'all', get label() { return tr('All'); } },
];

const startOfDay = ms => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const endOfDay = ms => startOfDay(ms) + DAY - 1;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/** Round half up (2.675 → 2.68), for display only. */
export const roundHalfUp = (n, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

const fuelDate = f => toMillis(f.date) ?? toMillis(f.createdAt);
const serviceDate = s => toMillis(s.serviceDate) ?? toMillis(s.createdAt);
const cost = r => {
  const n = Number(r.totalCost);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const hasCost = r => Number(r.totalCost) > 0;

/**
 * Every cost record in `range`, grouped by the currency it was saved in, for
 * the Dashboard's "Records by currency" card.
 *   current     [{ kind, ...record }] in the selected currency (counted)
 *   others      [{ kind, ...record }] in another currency (not counted)
 *   selected    { code, symbol } of the selected currency
 *   currencyOf  record → { code, symbol } it was saved in
 * → { rows: [{ code, symbol, counted, count, fuelCount, serviceCount, total }],
 *     total, matched } — the selected currency first (even with no records),
 *     then the others, most records first.
 */
export const currencyBreakdown = ({ current = [], others = [], range, selected, currencyOf, today = Date.now() }) => {
  const rows = new Map([[selected.code, {
    code: selected.code, symbol: selected.symbol, counted: true,
    count: 0, fuelCount: 0, serviceCount: 0, total: 0,
  }]]);
  if (!range) return { rows: [...rows.values()], total: 0, matched: 0 };
  const todayEnd = endOfDay(today);
  const add = (r, counted) => {
    const ms = r.kind === 'fuel' ? fuelDate(r) : serviceDate(r);
    if (ms == null || ms > todayEnd || ms < range.start || ms > range.end) return;
    const { code, symbol } = counted ? selected : currencyOf(r);
    if (!rows.has(code)) {
      rows.set(code, { code, symbol, counted, count: 0, fuelCount: 0, serviceCount: 0, total: 0 });
    }
    const row = rows.get(code);
    row.count += 1;
    row[r.kind === 'fuel' ? 'fuelCount' : 'serviceCount'] += 1;
    row.total += cost(r);
  };
  current.forEach(r => add(r, true));
  others.forEach(r => add(r, false));
  const [first, ...rest] = [...rows.values()];
  const list = [first, ...rest.sort((a, b) => b.count - a.count)];
  return {
    rows: list,
    total: list.reduce((n, r) => n + r.count, 0),
    matched: first.count,
  };
};

/**
 * What records in another currency than the selected one cost in `range`
 * (they are left out of every total, never converted), per currency.
 *   others      [{ kind: 'fuel' | 'service', ...record }]
 *   currencyOf  record → { code, symbol } it was saved in
 * → [{ code, symbol, fuel, service, total, count }], largest first.
 */
export const otherCurrencySpent = (others = [], range, currencyOf, today = Date.now()) => {
  if (!range) return [];
  const todayEnd = endOfDay(today);
  const byCode = new Map();
  others.forEach(r => {
    const ms = r.kind === 'fuel' ? fuelDate(r) : serviceDate(r);
    if (ms == null || ms > todayEnd || ms < range.start || ms > range.end) return;
    // Records with no cost still count (same count as currencyBreakdown);
    // they just add nothing to the amounts.
    const amount = cost(r);
    const { code, symbol } = currencyOf(r);
    if (!byCode.has(code)) byCode.set(code, { code, symbol, fuel: 0, service: 0, total: 0, count: 0 });
    const row = byCode.get(code);
    row[r.kind === 'fuel' ? 'fuel' : 'service'] += amount;
    row.total += amount;
    row.count += 1;
  });
  return [...byCode.values()].sort((a, b) => b.count - a.count);
};

/**
 * The same records as otherCurrencySpent, itemised for the Spending view's
 * "Where it went" list: what each fuel type cost in each other currency,
 * and every service saved in another currency with its own amount.
 * → { byFuel: { [fuel name]: [{ code, symbol, total, count }] },
 *     services: [{ name, ms, cost, hasCost, code, symbol }] (oldest first) }
 */
export const otherCurrencyDetail = (others = [], range, currencyOf, today = Date.now()) => {
  const byFuel = {};
  const services = [];
  if (!range) return { byFuel, services };
  const todayEnd = endOfDay(today);
  others.forEach(r => {
    const ms = r.kind === 'fuel' ? fuelDate(r) : serviceDate(r);
    if (ms == null || ms > todayEnd || ms < range.start || ms > range.end) return;
    const { code, symbol } = currencyOf(r);
    if (r.kind === 'fuel') {
      const amount = cost(r);
      if (!amount) return;
      const list = byFuel[fuelTypeName(r)] || (byFuel[fuelTypeName(r)] = []);
      let row = list.find(x => x.code === code);
      if (!row) list.push(row = { code, symbol, total: 0, count: 0 });
      row.total += amount;
      row.count += 1;
    } else {
      services.push({ name: r.name || '', ms, cost: cost(r), hasCost: hasCost(r), code, symbol });
    }
  });
  services.sort((a, b) => a.ms - b.ms);
  return { byFuel, services };
};

/**
 * First and last day (ms) of a period, both whole days, ending today.
 * 'all' starts at the oldest record; returns null when there is none.
 */
export const periodRange = (key, today = Date.now(), oldestMs = null) => {
  const end = endOfDay(today);
  const t = new Date(today);
  let start;
  if (key === '30d') {
    start = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29).getTime();
  } else if (key === '3m') {
    // Today minus 3 months, plus 1 day: 31 Mar → 1 Jan. A day that doesn't
    // exist in that month uses its last day (31 May → 28 Feb → 1 Mar).
    const y = t.getFullYear();
    const m = t.getMonth() - 3;
    const back = new Date(y, m, 1);
    const day = Math.min(t.getDate(), daysInMonth(back.getFullYear(), back.getMonth()));
    start = new Date(back.getFullYear(), back.getMonth(), day + 1).getTime();
  } else if (key === 'year') {
    start = new Date(t.getFullYear(), 0, 1).getTime();
  } else {
    if (oldestMs == null) return null;
    start = startOfDay(Math.min(oldestMs, end));
  }
  return { start, end };
};

/**
 * The period's range over records in every currency ([{ kind, ...record }]),
 * for the other-currency figures. 'all' starts at the oldest of them, so a
 * record in another currency older than every counted one is still taken in
 * (computeRunningCost never sees services in another currency).
 */
export const allRecordsRange = (period, records = [], today = Date.now()) => {
  const todayEnd = endOfDay(today);
  let oldest = null;
  records.forEach(r => {
    const ms = r.kind === 'fuel' ? fuelDate(r) : serviceDate(r);
    if (ms != null && ms <= todayEnd && (oldest == null || ms < oldest)) oldest = ms;
  });
  return periodRange(period, today, oldest);
};

/** Whole days in a range, both ends included (1 Jan–31 Mar 2027 → 90). */
export const daysInRange = ({ start, end }) =>
  Math.round((startOfDay(end) - startOfDay(start)) / DAY) + 1;

/** R11: months = days / 30.4375, to 1 decimal, at least 1.0. */
export const monthsInRange = range =>
  Math.max(1, roundHalfUp(daysInRange(range) / DAYS_PER_MONTH, 1));

/**
 * R7: each part per km, converted with `rate` and rounded to 2 decimals;
 * the total is the sum of the rounded parts (2.69 + 1.51 = 4.20).
 * `distUnit` 'mi' gives the cost per mile.
 */
export const perKmParts = (fuelCost, serviceCost, km, rate = 1, distUnit = 'km') => {
  if (!(km > 0)) return null;
  const distance = distUnit === 'mi' ? km * KM_TO_MI : km;
  const fuel = roundHalfUp((fuelCost * rate) / distance, 2);
  const service = roundHalfUp((serviceCost * rate) / distance, 2);
  return { fuel, service, total: roundHalfUp(fuel + service, 2) };
};

const reading = log => {
  if (log.odometer === '' || log.odometer == null) return null;
  const n = Number(String(log.odometer).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Everything the Dashboard shows for one vehicle and one period.
 *   fuelLogs  [{ date, odometer, liters, totalCost, fuelType }]
 *   services  [{ serviceDate, totalCost, name }]
 *   period    'year' | '30d' | '3m' | 'all'
 *   today     ms; records dated after today are ignored
 */
export const computeRunningCost = ({ fuelLogs = [], services = [], period = 'year', today = Date.now() }) => {
  const todayEnd = endOfDay(today);

  // Future-dated records are ignored until their date.
  const fuel = fuelLogs
    .map(f => ({ ...f, ms: fuelDate(f) }))
    .filter(f => f.ms != null && f.ms <= todayEnd);
  const svc = services
    .map(s => ({ ...s, ms: serviceDate(s) }))
    .filter(s => s.ms != null && s.ms <= todayEnd);

  const oldest = Math.min(...fuel.map(f => f.ms), ...svc.map(s => s.ms));
  const range = periodRange(period, today, Number.isFinite(oldest) ? oldest : null);
  const empty = {
    period, range, days: 0, months: 1, kmDriven: 0, litresUsed: 0,
    economy: null, fuelCost: 0, serviceCost: 0, fuelShare: null, enoughData: false,
    odometerWarning: false, servicesWithoutCost: 0, nonLitreFuel: false,
    totalSpent: 0, fuelSpent: 0, serviceSpent: 0, monthly: [], perMonth: 0,
    fuelLogCount: 0, serviceCount: 0, firstLog: null, lastLog: null,
    // Same shape as a full result, so screens can read these without checks.
    servicesInPeriod: [], fuelNames: [], fuelBreakdown: [], startCost: 0,
  };
  if (!range) return empty;

  const inRange = r => r.ms >= range.start && r.ms <= range.end;
  const fuelIn = fuel.filter(inRange);
  const svcIn = svc.filter(inRange);

  // R9: total spent is every record in the period, nothing left out.
  const fuelSpent = fuelIn.reduce((s, f) => s + cost(f), 0);
  const serviceSpent = svcIn.reduce((s, x) => s + cost(x), 0);

  // R10: calendar months from the period's first to last day.
  const monthly = [];
  const first = new Date(range.start);
  const last = new Date(range.end);
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    monthly.push({ year: d.getFullYear(), month: d.getMonth(), fuel: 0, service: 0, byFuel: {} });
  }
  const monthOf = ms => {
    const d = new Date(ms);
    return monthly.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
  };
  fuelIn.forEach(f => {
    const m = monthOf(f.ms);
    if (!m) return;
    const name = fuelTypeName(f);
    m.fuel += cost(f);
    m.byFuel[name] = (m.byFuel[name] || 0) + cost(f);
  });
  // Spend per fuel type over the period, biggest first (bar and list order).
  const fuelTotals = {};
  fuelIn.forEach(f => {
    const name = fuelTypeName(f);
    const t = fuelTotals[name] || (fuelTotals[name] = { name, spent: 0, count: 0, quantity: 0, unit: fuelUnit(f.fuelType) });
    t.spent += cost(f);
    t.count += 1;
    t.quantity += Number(f.liters) || 0; // in `unit`: L, kg (CNG/LPG) or kWh (EV)
  });
  const fuelBreakdown = Object.values(fuelTotals).sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
  svcIn.forEach(s => { const m = monthOf(s.ms); if (m) m.service += cost(s); });

  const months = monthsInRange(range);
  const totalSpent = fuelSpent + serviceSpent;

  // R1: logs with an odometer reading, by date then odometer.
  let ordered = fuelIn
    .filter(f => reading(f) !== null)
    .sort((a, b) => a.ms - b.ms || reading(a) - reading(b));
  // A reading lower than the one before is a typo somewhere: use first and
  // last by odometer order, and say so.
  const odometerWarning = ordered.some((f, i) => i > 0 && reading(f) < reading(ordered[i - 1]));
  if (odometerWarning) {
    ordered = [...ordered].sort((a, b) => reading(a) - reading(b) || a.ms - b.ms);
  }

  const start = ordered[0];
  const end = ordered[ordered.length - 1];
  // R2
  const kmDriven = ordered.length >= 2 ? reading(end) - reading(start) : 0;
  // R12
  const enoughData = ordered.length >= 2 && kmDriven > 0;

  // R3 / R5: every log after the first, up to and including the last. Logs
  // without a reading still count when dated between the two.
  const between = enoughData
    ? fuelIn.filter(f => f !== start && (
      reading(f) !== null
        ? ordered.indexOf(f) > 0
        : f.ms >= start.ms && f.ms <= end.ms
    ))
    : [];
  const litresUsed = between.reduce((s, f) => s + (Number(f.liters) || 0), 0);
  const fuelCost = between.reduce((s, f) => s + cost(f), 0);

  // R6: services from the first log's day to the last log's day.
  const svcFrom = enoughData ? startOfDay(Math.min(start.ms, end.ms)) : 0;
  const svcTo = enoughData ? endOfDay(Math.max(start.ms, end.ms)) : 0;
  const serviceCost = enoughData
    ? svcIn.filter(s => s.ms >= svcFrom && s.ms <= svcTo).reduce((s, x) => s + cost(x), 0)
    : 0;

  // R4: km per litre. kg (CNG/LPG) and kWh (EV) can't be added to litres,
  // so economy is left out when such a log is in the stretch.
  const nonLitreFuel = [start, ...between].some(f => f && fuelUnit(f.fuelType) !== 'L');
  const economy = enoughData && litresUsed > 0 && !nonLitreFuel ? kmDriven / litresUsed : null;

  // R8
  const fuelShare = enoughData && fuelCost + serviceCost > 0
    ? Math.round((fuelCost / (fuelCost + serviceCost)) * 100)
    : null;

  return {
    period,
    range,
    days: daysInRange(range),
    months,
    enoughData,
    kmDriven: enoughData ? kmDriven : 0,
    litresUsed,
    economy,
    nonLitreFuel,
    fuelCost,
    serviceCost,
    fuelShare,
    odometerWarning,
    servicesWithoutCost: svcIn.filter(s => !hasCost(s)).length,
    totalSpent,
    fuelSpent,
    serviceSpent,
    monthly,
    perMonth: totalSpent / months, // R11
    fuelLogCount: fuelIn.length,
    serviceCount: svcIn.length,
    // For "Where it went": every service in the period, oldest first, and the
    // fuels bought (counted together).
    servicesInPeriod: svcIn
      .map(s => ({ name: s.name || '', ms: s.ms, cost: cost(s), hasCost: hasCost(s) }))
      .sort((a, b) => a.ms - b.ms),
    fuelBreakdown,
    fuelNames: [...new Set(fuelIn.map(f => String(f.fuelName || f.fuelType || '').trim()).filter(Boolean))],
    // The first log's cost paid for driving before the period (R5).
    startCost: enoughData ? cost(start) : 0,
    firstLog: enoughData ? { ms: start.ms, odometer: reading(start) } : null,
    lastLog: enoughData ? { ms: end.ms, odometer: reading(end) } : null,
  };
};

/**
 * Running cost across several vehicles (Dashboard "All vehicles").
 *   vehicles  [{ fuelLogs, services }], one entry per vehicle
 *
 * Totals, months and "where it went" cover every record together. The
 * per-km figures can't come from one pooled list (odometers belong to one
 * vehicle each), so each vehicle is worked out on its own and the km, fuel
 * cost, service cost and litres are added up: fleet cost per km is
 * (all fuel + all services) / all km driven.
 */
export const computeFleetRunningCost = ({ vehicles = [], period = 'year', today = Date.now() }) => {
  const all = computeRunningCost({
    fuelLogs: vehicles.flatMap(v => v.fuelLogs || []),
    services: vehicles.flatMap(v => v.services || []),
    period,
    today,
  });
  // With 'all', each vehicle's range starts at its own oldest record; that
  // still takes in every one of its logs, so the per-km sums are unaffected.
  const each = vehicles.map(v => computeRunningCost({ fuelLogs: v.fuelLogs, services: v.services, period, today }));
  const ok = each.filter(r => r.enoughData);
  const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);

  const kmDriven = sum(ok, 'kmDriven');
  const fuelCost = sum(ok, 'fuelCost');
  const serviceCost = sum(ok, 'serviceCost');
  const enoughData = kmDriven > 0;
  // Economy only from vehicles that have one (fuel sold in litres).
  const withEconomy = ok.filter(r => r.economy != null);
  const ecoKm = sum(withEconomy, 'kmDriven');
  const ecoLitres = sum(withEconomy, 'litresUsed');

  return {
    ...all,
    enoughData,
    kmDriven,
    litresUsed: ecoLitres,
    economy: ecoLitres > 0 ? ecoKm / ecoLitres : null,
    nonLitreFuel: withEconomy.length === 0 && ok.some(r => r.nonLitreFuel),
    fuelCost,
    serviceCost,
    fuelShare: enoughData && fuelCost + serviceCost > 0
      ? Math.round((fuelCost / (fuelCost + serviceCost)) * 100)
      : null,
    odometerWarning: each.some(r => r.odometerWarning),
    startCost: sum(ok, 'startCost'),
    firstLog: null,
    lastLog: null,
    vehicleCount: vehicles.length,
    vehiclesCounted: ok.length,
  };
};
