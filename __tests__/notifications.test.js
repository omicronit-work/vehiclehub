import notifee from '@notifee/react-native';
import { scheduleReminder } from '../src/util/notifications';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

beforeEach(() => {
  jest.clearAllMocks();
  notifee.getNotificationSettings = jest.fn(() =>
    Promise.resolve({ authorizationStatus: 1, android: { alarm: 1 } }),
  );
  notifee.createTriggerNotification = jest.fn(() => Promise.resolve('id'));
});

afterEach(() => jest.useRealTimers());

const scheduledAt = () => notifee.createTriggerNotification.mock.calls[0][1].timestamp;
const scheduledTitle = () => notifee.createTriggerNotification.mock.calls[0][0].title;

test('fires at 9am the day before when that is still ahead', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 20, 12) });
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 25) });
  expect(res.scheduled).toBe(true);
  expect(scheduledAt()).toBe(at(2026, 9, 24, 9));
  expect(scheduledTitle()).toBe('Oil is due tomorrow');
});

test('falls back to the due day when the day-before slot has passed', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 24, 15) });
  const res = await scheduleReminder({ id: 'x', kind: 'document', subject: 'Insurance', dueDate: new Date(2026, 8, 25) });
  expect(res.scheduled).toBe(true);
  expect(scheduledAt()).toBe(at(2026, 9, 25, 9));
  expect(scheduledTitle()).toBe('Insurance expires today');
});

test('skips due dates that are already over', async () => {
  jest.useFakeTimers({ now: at(2026, 9, 24, 15) });
  const res = await scheduleReminder({ id: 'x', kind: 'service', subject: 'Oil', dueDate: new Date(2026, 8, 23) });
  expect(res).toEqual({ scheduled: false, reason: 'past' });
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});
