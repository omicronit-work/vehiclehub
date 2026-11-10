import { createNavigationContainerRef } from '@react-navigation/native';

// The root navigator, so a notification tap can open a schedule from outside
// any screen (App.jsx wires it to the NavigationContainer).
export const navigationRef = createNavigationContainerRef();

// The Garage tab resets to its vehicle list every time it gains focus. Coming
// back from a schedule screen opened inside it must not count as a new visit,
// so the list marks the push and the tab consumes the mark once.
let returningFromSchedule = false;
export const markScheduleNavigation = () => {
  returningFromSchedule = true;
};
export const consumeScheduleReturn = () => {
  const was = returningFromSchedule;
  returningFromSchedule = false;
  return was;
};

// Home's "View all" opens a vehicle in the Garage tab on a given detail tab.
// The Garage tab consumes the request once when it gains focus.
let pendingVehicleOpen = null;
export const requestVehicleOpen = (vehicleId, tab = 'Schedule') => {
  pendingVehicleOpen = vehicleId ? { vehicleId, tab, at: Date.now() } : null;
};
export const consumeVehicleOpen = () => {
  const req = pendingVehicleOpen;
  pendingVehicleOpen = null;
  return req;
};

let pendingLink = null;

/**
 * Opens the Home tab (vehiclehub://home). Signed out, nothing to do: the app
 * lands on Home right after sign-in anyway.
 */
export const openHome = () => {
  if (!navigationRef.isReady()) return;
  if (navigationRef.getRootState()?.routeNames?.includes('Tabbar')) {
    navigationRef.navigate('Tabbar', { screen: 'Home' });
  }
};

const canOpen = () =>
  navigationRef.isReady() && !!navigationRef.getRootState()?.routeNames?.includes('ScheduleDetail');

/** Opens a schedule's detail now, or once the signed-in navigator is up. */
export const openScheduleDetail = target => {
  if (!target) return;
  if (canOpen()) navigationRef.navigate('ScheduleDetail', target);
  else pendingLink = target;
};

/**
 * Call when the signed-in navigator mounts. Its state can take a moment to
 * register with the container, so this retries briefly.
 */
export const flushPendingScheduleLink = (attempt = 0) => {
  if (!pendingLink) return;
  if (canOpen()) {
    const target = pendingLink;
    pendingLink = null;
    navigationRef.navigate('ScheduleDetail', target);
  } else if (attempt < 15) {
    setTimeout(() => flushPendingScheduleLink(attempt + 1), 200);
  }
};
