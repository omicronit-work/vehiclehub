import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId,
  setUserProperties,
} from '@react-native-firebase/analytics';

/*
 * Firebase Analytics, in one place.
 *
 * Every call is fire-and-forget: analytics must never throw into, or slow
 * down, the action being measured. Nothing personal is sent — the user is
 * identified by their Firebase Auth uid (never the email), and no names,
 * notes, workshop/station names or amounts are logged.
 *
 * Event names: snake_case, ≤ 40 chars. Params: ≤ 25 per event, values are
 * strings ≤ 100 chars or numbers. See EVENTS for the full list.
 */

export const EVENTS = {
  // Auth
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  LOGOUT: 'logout',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  ACCOUNT_DELETED: 'account_deleted',

  // Vehicles
  VEHICLE_ADDED: 'vehicle_added',
  VEHICLE_UPDATED: 'vehicle_updated',
  VEHICLE_DELETED: 'vehicle_deleted',

  // Records (fuel logs, services, documents)
  FUEL_LOG_ADDED: 'fuel_log_added',
  FUEL_LOG_UPDATED: 'fuel_log_updated',
  SERVICE_ADDED: 'service_added',
  SERVICE_UPDATED: 'service_updated',
  DOCUMENT_ADDED: 'document_added',
  DOCUMENT_UPDATED: 'document_updated',
  RECORD_DELETED: 'record_deleted',
  RECORD_DELETE_UNDONE: 'record_delete_undone',

  // Service schedules
  SCHEDULE_CREATED: 'schedule_created',
  SCHEDULE_UPDATED: 'schedule_updated',
  SCHEDULE_DELETED: 'schedule_deleted',
  SCHEDULE_MARKED_DONE: 'schedule_marked_done',

  // Backup & export
  BACKUP_CREATED: 'backup_created',
  BACKUP_FAILED: 'backup_failed',
  BACKUP_RESTORED: 'backup_restored',
  RESTORE_FAILED: 'restore_failed',
  CSV_EXPORTED: 'csv_exported',

  // Settings & misc
  THEME_CHANGED: 'theme_changed',
  ACCENT_CHANGED: 'accent_changed',
  CURRENCY_CHANGED: 'currency_changed',
  DISTANCE_UNIT_CHANGED: 'distance_unit_changed',
  LANGUAGE_CHANGED: 'language_changed',
  CONTACT_SUPPORT: 'contact_support',
  NOTIFICATION_OPENED: 'notification_opened',
};

let analytics = null;
const instance = () => {
  if (!analytics) analytics = getAnalytics();
  return analytics;
};

const safely = (label, fn) => {
  try {
    const p = fn();
    if (p && typeof p.catch === 'function') {
      p.catch(e => __DEV__ && console.log(`Analytics ${label} failed:`, e?.message || e));
    }
  } catch (e) {
    if (__DEV__) console.log(`Analytics ${label} failed:`, e?.message || e);
  }
};

// Analytics only accepts strings and numbers; booleans become 0/1 so they can
// be used as metrics, and long strings are trimmed to the 100-char limit.
const clean = params => {
  if (!params) return undefined;
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = v; }
    else out[k] = String(v).slice(0, 100);
  });
  return out;
};

/** Logs a custom or recommended event. */
export const track = (name, params) =>
  safely(name, () => logEvent(instance(), name, clean(params)));

/** Logs a screen_view. Called from the NavigationContainer (App.jsx). */
export const trackScreen = screenName => {
  if (!screenName) return;
  safely('screen_view', () =>
    logScreenView(instance(), { screen_name: screenName, screen_class: screenName }),
  );
};

/** Ties events to the signed-in account (Firebase uid), or clears it. */
export const identifyUser = uid =>
  safely('setUserId', () => setUserId(instance(), uid || null));

/** User-scoped dimensions, e.g. { app_theme: 'dark', currency: 'THB' }. */
export const setUserProps = props =>
  safely('setUserProperties', () => {
    const cleaned = clean(props) || {};
    // User property values must be strings.
    const asStrings = Object.fromEntries(
      Object.entries(cleaned).map(([k, v]) => [k, String(v).slice(0, 36)]),
    );
    return setUserProperties(instance(), asStrings);
  });

/** Name of the currently focused route, walking into nested navigators. */
export const activeRouteName = state => {
  let route = state?.routes?.[state.index ?? 0];
  while (route?.state?.routes) {
    route = route.state.routes[route.state.index ?? 0];
  }
  return route?.name;
};
