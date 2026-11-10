import ReminderScheduler from '../specs/NativeReminderScheduler';
import { scheduleReminder, reminderSlot } from '../src/util/notifications';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

const scheduledAt = () => ReminderScheduler.schedule.mock.calls[0][3];
const scheduledTitle = () => ReminderScheduler.schedule.mock.calls[0][1];

test('fires at 9am seven days before when that is still ahead', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 10, 12) });
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 25) });
  expect(res.scheduled).toBe(true);
  expect(scheduledAt()).toBe(at(2026, 9, 18, 9));
  expect(scheduledTitle()).toBe('Oil is due in 7 days');
});

test('fires this morning with the days left when inside the 7-day window', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 22, 7) });
  const res = await scheduleReminder({ id: 'x', kind: 'document', subject: 'Insurance', dueDate: new Date(2026, 8, 25) });
  expect(res.scheduled).toBe(true);
  expect(scheduledAt()).toBe(at(2026, 9, 22, 9));
  expect(scheduledTitle()).toBe('Insurance expires in 3 days');
});

test('fires a minute from now when 9am today has passed', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 24, 15) });
  const res = await scheduleReminder({ id: 'x', kind: 'document', subject: 'Insurance', dueDate: new Date(2026, 8, 25) });
  expect(res.scheduled).toBe(true);
  expect(scheduledAt()).toBe(at(2026, 9, 24, 15, 1));
  expect(scheduledTitle()).toBe('Insurance expires tomorrow');
});

test('fires today on the due day itself', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 25, 8) });
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 25) });
  expect(scheduledAt()).toBe(at(2026, 9, 25, 9));
  expect(scheduledTitle()).toBe('Oil is due today');
});

test('skips due dates that are already over', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 24, 15) });
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 23) });
  expect(res).toEqual({ scheduled: false, reason: 'past' });
  expect(ReminderScheduler.schedule).not.toHaveBeenCalled();
});

test('reports a denied permission instead of scheduling', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 20, 12) });
  ReminderScheduler.requestPermission.mockResolvedValueOnce(false);
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 25) });
  expect(res).toEqual({ scheduled: false, reason: 'permission' });
  expect(ReminderScheduler.schedule).not.toHaveBeenCalled();
});

test('reminderSlot gives the notification date shown in the form', () => {
  expect(reminderSlot(new Date(2026, 10, 28), at(2026, 10, 27, 12)).fireAt).toBe(at(2026, 11, 21, 9));
  expect(reminderSlot(new Date(2026, 9, 1), at(2026, 10, 27, 12))).toBeNull();
  expect(reminderSlot(null)).toBeNull();
});
