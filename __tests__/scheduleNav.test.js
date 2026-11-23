// Notification taps before the signed-in navigator exists (cold start) are
// kept until it mounts, however long start-up takes.
let mockReady = false;
let mockRouteNames = [];
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => mockReady,
    getRootState: () => ({ routeNames: mockRouteNames }),
    navigate: (...args) => mockNavigate(...args),
  }),
}));

const { openBackup, openScheduleDetail, flushPendingScheduleLink } = require('../src/util/schedule/scheduleNav');

const SIGNED_IN = ['Tabbar', 'Backup', 'ScheduleDetail'];

beforeEach(() => {
  mockReady = false;
  mockRouteNames = [];
  mockNavigate.mockClear();
});

test('a backup tap during start-up opens Backup once the navigator mounts', () => {
  openBackup();
  expect(mockNavigate).not.toHaveBeenCalled();
  // However long the splash / sign-in took: still pending, not dropped.
  mockReady = true;
  mockRouteNames = SIGNED_IN;
  flushPendingScheduleLink();
  expect(mockNavigate).toHaveBeenCalledWith('Backup', undefined);
});

test('opens at once when the navigator is already up', () => {
  mockReady = true;
  mockRouteNames = SIGNED_IN;
  openScheduleDetail({ vehicleId: 'v', ruleId: 'r' });
  expect(mockNavigate).toHaveBeenCalledWith('ScheduleDetail', { vehicleId: 'v', ruleId: 'r' });
});

test('a newer tap replaces an older pending one', () => {
  openScheduleDetail({ vehicleId: 'v', ruleId: 'r' });
  openBackup();
  mockReady = true;
  mockRouteNames = SIGNED_IN;
  flushPendingScheduleLink();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('Backup', undefined);
});
