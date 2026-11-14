import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULTS } from './scheduleMath';
import { EVENTS, setUserProps, track } from '../analytics';

// Device-level preferences for service schedules: the distance unit and the
// Service alerts screen (screen 6). The alert values are the defaults every
// new schedule starts with; each schedule can still change its own.

const UNIT_KEY = 'distanceUnit'; // 'km' | 'mi'
const ALERTS_KEY = 'scheduleAlertSettings';

export const DEFAULT_ALERT_SETTINGS = {
  enabled: true,
  warnKm: DEFAULTS.warnKm,
  warnDays: DEFAULTS.warnDays,
  repeatOverdueDays: DEFAULTS.repeatOverdueDays,
};

const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());
export const onScheduleSettingsChange = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getDistanceUnit = async () => ((await AsyncStorage.getItem(UNIT_KEY)) === 'mi' ? 'mi' : 'km');

export const setDistanceUnit = async unit => {
  const value = unit === 'mi' ? 'mi' : 'km';
  await AsyncStorage.setItem(UNIT_KEY, value);
  track(EVENTS.DISTANCE_UNIT_CHANGED, { unit: value });
  setUserProps({ distance_unit: value });
  emit();
};

export const getAlertSettings = async () => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(ALERTS_KEY)) || 'null');
    return { ...DEFAULT_ALERT_SETTINGS, ...(saved || {}) };
  } catch (_) {
    return DEFAULT_ALERT_SETTINGS;
  }
};

export const setAlertSettings = async patch => {
  const next = { ...(await getAlertSettings()), ...patch };
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  emit();
  return next;
};

/** Current distance unit; re-renders when it changes anywhere. */
export const useDistanceUnit = () => {
  const [unit, setUnit] = useState('km');
  useEffect(() => {
    let alive = true;
    const load = () => getDistanceUnit().then(u => alive && setUnit(u));
    load();
    const off = onScheduleSettingsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return unit;
};

export const useAlertSettings = () => {
  const [settings, setSettings] = useState(DEFAULT_ALERT_SETTINGS);
  useEffect(() => {
    let alive = true;
    const load = () => getAlertSettings().then(s => alive && setSettings(s));
    load();
    const off = onScheduleSettingsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return settings;
};
