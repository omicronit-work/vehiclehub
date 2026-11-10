import {
  planRuleNotifications,
  distanceTransition,
  parseScheduleNotificationId,
} from '../src/util/schedule/scheduleReminders';
import { MODES, evaluateRule } from '../src/util/schedule/scheduleMath';

const engineOil = {
  id: 'rule1', name: 'Engine oil & filter', mode: MODES.BOTH, intervalKm: 10000, intervalMonths: 6,
  baseDate: '2026-10-31', baseOdo: 10, warnKm: 500, warnDays: 14, repeatOverdueDays: 7,
};
const ctx = { vehicleName: 'Honda Accord RS', unit: 'km' };
const at = (y, m, d, h = 0) => new Date(y, m - 1, d, h).getTime();

describe('timed alerts (spec 5)', () => {
  test('warning 14 days before at 09:00, due day at 09:00, then every 7 days', () => {
    const e = evaluateRule(engineOil, { today: '2027-04-01', odometer: 5000 });
    const plan = planRuleNotifications(e, { ...ctx, now: at(2027, 4, 1, 12) });
    const bySuffix = Object.fromEntries(plan.map(x => [x.suffix, x]));

    expect(bySuffix.warn.fireAt).toBe(at(2027, 4, 16, 9));
    expect(bySuffix.warn.title).toBe('Engine oil & filter due in 14 days');
    expect(bySuffix.warn.body).toBe('Honda Accord RS · due 30 Apr 2027 or 10,010 km. Tap to open.');
    expect(bySuffix.due.fireAt).toBe(at(2027, 4, 30, 9)); // T6
    expect(bySuffix.due.title).toBe('Engine oil & filter due today');
    expect(bySuffix.over1.fireAt).toBe(at(2027, 5, 7, 9));
    expect(bySuffix.over1.title).toBe('Engine oil & filter is overdue by 7 days');
    expect(bySuffix.over2.fireAt).toBe(at(2027, 5, 14, 9));
  });

  test('only future alerts are queued', () => {
    const e = evaluateRule(engineOil, { today: '2027-04-20', odometer: 8900 });
    const plan = planRuleNotifications(e, { ...ctx, now: at(2027, 4, 20, 12) });
    expect(plan.find(x => x.suffix === 'warn')).toBeUndefined();
    expect(plan.find(x => x.suffix === 'due')).toBeDefined();
  });

  test('repeat 0 means never repeat', () => {
    const e = evaluateRule({ ...engineOil, repeatOverdueDays: 0 }, { today: '2027-04-01', odometer: 5000 });
    const plan = planRuleNotifications(e, { ...ctx, now: at(2027, 4, 1, 12) });
    expect(plan.some(x => x.suffix.startsWith('over'))).toBe(false);
  });

  test('a paused rule queues nothing', () => {
    const e = evaluateRule({ ...engineOil, remindersOn: false }, { today: '2027-04-01', odometer: 5000 });
    expect(planRuleNotifications(e, { ...ctx, now: at(2027, 4, 1, 12) })).toEqual([]);
  });
});

describe('distance alerts fire once per status change', () => {
  const today = '2027-04-20';

  test('T3: a reading that enters the warning window alerts once', () => {
    const first = distanceTransition(evaluateRule(engineOil, { today, odometer: 9600 }), { ...ctx, today });
    expect(first.alert.title).toBe('Engine oil & filter due in 410 km');
    expect(first.state).toEqual({ distanceAlert: 'soon', distanceOverdueSince: null });

    const again = distanceTransition(
      evaluateRule({ ...engineOil, ...first.state }, { today, odometer: 9700 }),
      { ...ctx, today },
    );
    expect(again.alert).toBeNull();
    expect(again.state).toBeNull();
  });

  test('T4: crossing into overdue alerts and starts the repeat clock', () => {
    const res = distanceTransition(
      evaluateRule({ ...engineOil, distanceAlert: 'soon' }, { today, odometer: 10011 }),
      { ...ctx, today },
    );
    expect(res.alert.title).toBe('Engine oil & filter is overdue by 1 km');
    expect(res.alert.body).toBe('Honda Accord RS · was due at 10,010 km. Tap to mark as done.');
    expect(res.state).toEqual({ distanceAlert: 'overdue', distanceOverdueSince: today });
  });

  test('distance overdue repeats every 7 days at 09:00 from when it was seen', () => {
    const rule = { ...engineOil, mode: MODES.DISTANCE, intervalMonths: null, distanceAlert: 'overdue', distanceOverdueSince: today };
    const plan = planRuleNotifications(evaluateRule(rule, { today, odometer: 10100 }), { ...ctx, now: at(2027, 4, 20, 12) });
    expect(plan[0].suffix).toBe('dover1');
    expect(plan[0].fireAt).toBe(at(2027, 4, 27, 9));
  });

  test('back to OK (after Mark as done) clears the state silently', () => {
    const res = distanceTransition(
      evaluateRule({ ...engineOil, baseOdo: 8900, baseDate: today, distanceAlert: 'overdue' }, { today, odometer: 8900 }),
      { ...ctx, today },
    );
    expect(res.alert).toBeNull();
    expect(res.state).toEqual({ distanceAlert: null, distanceOverdueSince: null });
  });
});

test('notification ids map back to the schedule they open', () => {
  expect(parseScheduleNotificationId('sched-veh123-rule1-over2')).toEqual({ vehicleId: 'veh123', ruleId: 'rule1' });
  expect(parseScheduleNotificationId('service-abc')).toBeNull();
});
