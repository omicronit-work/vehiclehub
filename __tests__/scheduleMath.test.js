import {
  MODES,
  STATUS,
  addMonths,
  daysBetween,
  evaluateRule,
  chipLabel,
  dueValues,
  validateRule,
  validateMarkDone,
  restartRule,
  currentOdometer,
  formatDistance,
  unitToKm,
  ruleText,
  compareEvaluations,
  countStatuses,
  kmPerDayFrom,
  estimateDateForKm,
} from '../src/util/schedule/scheduleMath';

// Spec section 7 mock-up: Honda Accord RS delivered 31 Oct 2026 at 10 km;
// today 20 Apr 2027, odometer 8,900 km.
const TODAY = '2027-04-20';
const ODO = 8900;

const engineOil = {
  name: 'Engine oil & filter', mode: MODES.BOTH, intervalKm: 10000, intervalMonths: 6,
  baseDate: '2026-10-31', baseOdo: 10, warnKm: 500, warnDays: 14,
};
const tyreRotation = { name: 'Tyre rotation', mode: MODES.DISTANCE, intervalKm: 5000, baseDate: '2026-10-31', baseOdo: 3200 };
const cabinFilter = { name: 'Cabin air filter', mode: MODES.BOTH, intervalKm: 15000, intervalMonths: 12, baseDate: '2026-10-31', baseOdo: 10 };
const brakeFluid = { name: 'Brake fluid', mode: MODES.TIME, intervalMonths: 24, baseDate: '2026-10-31', baseOdo: 10 };

const at = (rule, odometer = ODO, today = TODAY) => evaluateRule(rule, { today, odometer });

describe('calendar months (R2)', () => {
  test.each([
    ['2026-10-31', 6, '2027-04-30'],
    ['2026-08-31', 6, '2027-02-28'], // T10
    ['2028-02-29', 12, '2029-02-28'],
    ['2027-01-01', 6, '2027-07-01'],
    ['2026-10-31', 24, '2028-10-31'],
    ['2026-11-15', 2, '2027-01-15'],
  ])('%s + %i months = %s', (base, months, expected) => {
    expect(addMonths(base, months)).toBe(expected);
  });

  test('always counts from the baseline, so clamping never drifts', () => {
    // 31 Aug + 6 = 28 Feb, but 31 Aug + 12 is 31 Aug again (not 28 Aug).
    expect(addMonths('2026-08-31', 12)).toBe('2027-08-31');
  });

  test('days between calendar dates', () => {
    expect(daysBetween(TODAY, '2027-04-30')).toBe(10);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween(TODAY, '2027-04-19')).toBe(-1);
  });
});

describe('worked examples (spec section 7)', () => {
  test('engine oil: due soon, time comes first', () => {
    const e = at(engineOil);
    expect(e.dueKm).toBe(10010);
    expect(e.distance.left).toBe(1110);
    expect(e.distance.status).toBe(STATUS.OK);
    expect(e.dueDate).toBe('2027-04-30');
    expect(e.time.left).toBe(10);
    expect(e.time.status).toBe(STATUS.SOON);
    expect(e.status).toBe(STATUS.SOON);
    expect(e.headline).toBe('time');
    expect(Math.round(e.distance.progress * 100)).toBe(89);
    expect(Math.round(e.time.progress * 100)).toBe(94);
    expect(chipLabel(e.chip)).toBe('In 10 days'); // T2
  });

  test('tyre rotation: overdue 700 km', () => {
    const e = at(tyreRotation);
    expect(e.dueKm).toBe(8200);
    expect(e.distance.left).toBe(-700);
    expect(e.time).toBeNull();
    expect(e.status).toBe(STATUS.OVERDUE);
    expect(chipLabel(e.chip)).toBe('Overdue 700 km');
  });

  test('cabin air filter: OK', () => {
    const e = at(cabinFilter);
    expect(e.dueKm).toBe(15010);
    expect(e.distance.left).toBe(6110);
    expect(e.dueDate).toBe('2027-10-31');
    expect(e.time.left).toBe(194);
    expect(e.status).toBe(STATUS.OK);
    expect(chipLabel(e.chip)).toBe('OK');
  });

  test('brake fluid: OK, 560 days left', () => {
    const e = at(brakeFluid);
    expect(e.dueDate).toBe('2028-10-31');
    expect(e.time.left).toBe(560);
    expect(e.distance).toBeNull();
    expect(e.status).toBe(STATUS.OK);
  });

  test('mark engine oil done on 20 Apr 2027 at 8,900 km (T8)', () => {
    const next = restartRule(engineOil, { dateDone: TODAY, odo: 8900 });
    expect(dueValues(next)).toEqual({ dueKm: 18900, dueDate: '2027-10-20' });
    expect(at(next).status).toBe(STATUS.OK);
  });

  test('heavy driver: distance comes first', () => {
    const rule = { ...engineOil, baseDate: '2027-01-01', baseOdo: 0 };
    const e = at(rule, 9600, '2027-04-01');
    expect(e.distance.left).toBe(400);
    expect(e.distance.status).toBe(STATUS.SOON);
    expect(e.time.left).toBe(91);
    expect(e.dueDate).toBe('2027-07-01');
    expect(e.time.status).toBe(STATUS.OK);
    expect(e.status).toBe(STATUS.SOON);
    expect(chipLabel(e.chip)).toBe('In 400 km');
  });
});

describe('test cases (spec section 9)', () => {
  test('T3: odometer 9,600 → distance due soon (400 km)', () => {
    const e = at(engineOil, 9600);
    expect(e.distance.status).toBe(STATUS.SOON);
    expect(e.distance.left).toBe(410);
  });

  test('T4: odometer 10,011 → overdue 1 km', () => {
    const e = at(engineOil, 10011);
    expect(e.status).toBe(STATUS.OVERDUE);
    expect(chipLabel(e.chip)).toBe('Overdue 1 km');
  });

  test('T5: exactly 10,010 → due now, not overdue', () => {
    const e = at({ ...engineOil, mode: MODES.DISTANCE }, 10010);
    expect(e.status).toBe(STATUS.SOON);
    expect(chipLabel(e.chip)).toBe('Due now');
  });

  test('T6: on the due date → due today', () => {
    const e = at(engineOil, ODO, '2027-04-30');
    expect(e.status).toBe(STATUS.SOON);
    expect(chipLabel(e.chip)).toBe('Due today');
  });

  test('T7: day after → overdue 1 day', () => {
    const e = at(engineOil, ODO, '2027-05-01');
    expect(e.status).toBe(STATUS.OVERDUE);
    expect(chipLabel(e.chip)).toBe('Overdue 1 day');
  });

  test('1 day left reads "In 1 day"', () => {
    expect(chipLabel(at(engineOil, ODO, '2027-04-29').chip)).toBe('In 1 day');
  });

  test('both overdue: the limit further past due is shown', () => {
    // 6 months 30 days in: time progress ~1.16; distance 10,500 → 1.049.
    const e = at(engineOil, 10510, '2027-05-30');
    expect(e.distance.status).toBe(STATUS.OVERDUE);
    expect(e.time.status).toBe(STATUS.OVERDUE);
    expect(chipLabel(e.chip)).toBe('Overdue 30 days');
  });

  test('T11: time-only rule with no odometer works, no distance bar', () => {
    const e = at(brakeFluid, null);
    expect(e.distance).toBeNull();
    expect(e.needsOdometer).toBe(false);
    expect(e.status).toBe(STATUS.OK);
  });

  test('no odometer reading: distance ignored, card asks for one', () => {
    const e = at(engineOil, null);
    expect(e.distance).toBeNull();
    expect(e.needsOdometer).toBe(true);
    expect(e.headline).toBe('time');
  });

  test('very old baseline shows overdue immediately', () => {
    expect(at({ ...engineOil, baseDate: '2020-01-01' }).status).toBe(STATUS.OVERDUE);
  });

  test('progress bars cap at 100%', () => {
    expect(at(tyreRotation).distance.fill).toBe(1);
  });

  test('T12: miles are display-only, rounded', () => {
    expect(formatDistance(10010, 'mi')).toBe('6,220 mi');
    expect(chipLabel(at(tyreRotation).chip, 'mi')).toBe('Overdue 435 mi');
    expect(unitToKm('6,220', 'mi')).toBe(10010);
    expect(ruleText(engineOil, 'mi')).toBe('Every 6,214 mi or 6 months, whichever first');
  });
});

describe('validation', () => {
  test('every interval the mode uses is required', () => {
    const both = validateRule({ ...engineOil, intervalKm: '', intervalMonths: '' });
    expect(both.ok).toBe(false);
    expect(both.errors.intervalKm).toBeTruthy();
    expect(both.errors.intervalMonths).toBeTruthy();
    // Whichever first needs both, not just one.
    expect(validateRule({ ...engineOil, intervalMonths: '' }).errors.intervalMonths).toBeTruthy();
    expect(validateRule({ ...brakeFluid }).ok).toBe(true);
  });

  test('distance-only rules are allowed', () => {
    expect(validateRule({ ...tyreRotation }).ok).toBe(true);
  });

  test('starting odometer is required; a lower (backdated) reading is allowed', () => {
    expect(validateRule({ ...engineOil, baseOdo: '' }).errors.baseOdo).toBeTruthy();
    expect(validateRule({ ...engineOil, baseOdo: -5 }).errors.baseOdo).toBeTruthy();
    // Below the reading the vehicle was added with: still valid, only flagged in the form.
    expect(validateRule({ ...engineOil, baseOdo: 1500 }, { minOdo: 2000 }).ok).toBe(true);
    expect(validateRule({ ...engineOil, baseOdo: 2000 }).ok).toBe(true);
  });

  test('time-only service types skip the odometer', () => {
    const paint = { name: 'Body / Paint Repair', serviceType: 'Body / Paint Repair', mode: MODES.TIME, intervalMonths: 12, baseDate: '2026-11-04', baseOdo: null };
    expect(validateRule(paint).errors.baseOdo).toBeTruthy();
    expect(validateRule(paint, { requireOdo: false, minOdo: 2000 }).ok).toBe(true);
    const done = validateMarkDone({ dateDone: TODAY, odo: null, today: TODAY, rule: paint, vehicleOdo: ODO, requireOdo: false });
    expect(done.ok).toBe(true);
  });

  test('range limits', () => {
    expect(validateRule({ ...engineOil, intervalKm: 50 }).errors.intervalKm).toBeTruthy();
    expect(validateRule({ ...engineOil, intervalMonths: 121 }).errors.intervalMonths).toBeTruthy();
    expect(validateRule({ ...engineOil, name: 'x'.repeat(41) }).errors.name).toBeTruthy();
    expect(validateRule(engineOil).ok).toBe(true);
  });

  test('T9: mark as done with a future date is blocked', () => {
    const res = validateMarkDone({ dateDone: '2027-04-21', odo: 8900, today: TODAY, rule: engineOil, vehicleOdo: ODO });
    expect(res.ok).toBe(false);
    expect(res.errors.date).toMatch(/future/);
  });

  test('R11: odometer below the baseline is blocked', () => {
    const res = validateMarkDone({ dateDone: TODAY, odo: 5, today: TODAY, rule: engineOil, vehicleOdo: ODO });
    expect(res.ok).toBe(false);
    expect(res.errors.odo).toBeTruthy();
  });

  test('R11: backdated reading below current odometer warns but allows', () => {
    const res = validateMarkDone({ dateDone: '2027-03-01', odo: 7000, today: TODAY, rule: engineOil, vehicleOdo: ODO });
    expect(res.ok).toBe(true);
    expect(res.warning).toBeTruthy();
  });

  test('R8: date and odometer are required', () => {
    const res = validateMarkDone({ dateDone: null, odo: '', today: TODAY, rule: engineOil, vehicleOdo: ODO });
    expect(res.errors.date).toBeTruthy();
    expect(res.errors.odo).toBeTruthy();
  });
});

describe('distance-only estimate', () => {
  test('due date estimated from average daily driving', () => {
    const rate = kmPerDayFrom([
      { date: '2027-01-01', km: 1000 },
      { date: '2027-01-31', km: 2200 },
    ]);
    expect(rate).toBe(40);
    expect(estimateDateForKm({ dueKm: 4000, odometer: 2200, kmPerDay: rate, today: '2027-01-31' })).toBe('2027-03-17');
  });

  test('no estimate with readings under two weeks apart', () => {
    expect(kmPerDayFrom([{ date: '2027-01-01', km: 100 }, { date: '2027-01-05', km: 300 }])).toBeNull();
  });
});

describe('lists', () => {
  test('sorted overdue, due soon, then OK', () => {
    const list = [cabinFilter, engineOil, brakeFluid, tyreRotation].map(r => at(r)).sort(compareEvaluations);
    expect(list.map(e => e.rule.name)).toEqual(['Tyre rotation', 'Engine oil & filter', 'Cabin air filter', 'Brake fluid']);
    expect(countStatuses(list)).toEqual({ overdue: 1, soon: 1, ok: 2 });
  });

  test('current odometer is the highest reading anywhere (4.6)', () => {
    expect(currentOdometer({ vehicle: { currentOdometer: 8000 }, services: [{ currentMileage: 8900 }], fuelLogs: [{ odometer: 8500 }] })).toBe(8900);
    expect(currentOdometer({ vehicle: { currentOdometer: 0 } })).toBeNull();
  });
});

describe('dueInWords', () => {
  const { dueInWords } = require('../src/util/schedule/scheduleMath');
  test('both limits ahead', () => {
    expect(dueInWords({ distance: { left: 320 }, time: { left: 12 } })).toBe('Due in 320 km or 12 days');
  });
  test('one limit only', () => {
    expect(dueInWords({ distance: null, time: { left: 1 } })).toBe('Due in 1 day');
  });
  test('overdue names what is overdue', () => {
    expect(dueInWords({ distance: { left: -1200 }, time: { left: 30 } })).toBe('Overdue by 1,200 km');
  });
  test('due today', () => {
    expect(dueInWords({ distance: null, time: { left: 0 } })).toBe('Due today');
  });
});
