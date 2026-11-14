import { KM_TO_MI, kmToUnit, unitToKm } from './schedule/scheduleMath';
import { t as tr } from '../i18n';
import { localDate } from '../i18n';

// Everything is stored in km; these turn stored figures into the user's
// distance unit (Settings → Distance unit, read with useDistanceUnit) for
// display, and typed values back into km for saving. Pure (no storage), so
// list/summary utils can use it; components get the unit from
// useDistanceUnit() in ./schedule/scheduleSettings.

export { kmToUnit, unitToKm };

// Blank (no reading) stays null rather than becoming 0.
const toNumber = value => {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** 1500 → '1,500 km' / '932 mi'. Whole numbers, thousands separated. */
export const formatKm = (km, unit = 'km') => {
  const n = toNumber(km);
  if (n === null) return '';
  return `${kmToUnit(n, unit).toLocaleString('en-US')} ${unit}`;
};

/** Stored km reading → the text an input shows in the user's unit. */
export const kmToField = (km, unit = 'km') => {
  const n = toNumber(km);
  return km === '' || km == null || n === null ? '' : String(kmToUnit(n, unit));
};

/** What the user typed (their unit) → whole-km string for the form state. */
export const fieldToKm = (value, unit = 'km') => {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (digits === '') return '';
  return String(unitToKm(digits, unit));
};

/** Economy: 26.7 km/L → 16.6 mi/L. */
export const effToUnit = (kmPer, unit = 'km') =>
  unit === 'mi' ? Number(kmPer) * KM_TO_MI : Number(kmPer);

/** 'km/L' → 'mi/L' (keeps the fuel's quantity unit). */
export const effUnitLabel = (effUnit, unit = 'km') =>
  unit === 'mi' ? String(effUnit).replace(/^km\//, 'mi/') : effUnit;

/** '26.7 km/L' / '16.6 mi/L'. */
export const formatEff = (kmPer, effUnit, unit = 'km') =>
  `${effToUnit(kmPer, unit).toFixed(1)} ${effUnitLabel(effUnit, unit)}`;

/** Cost per km → cost per mile when needed (a mile costs more). */
export const costPerUnit = (costPerKm, unit = 'km') =>
  unit === 'mi' ? Number(costPerKm) / KM_TO_MI : Number(costPerKm);

/**
 * The one odometer rule, used by every form: a reading lower than the last
 * one logged on or before the entry's date is probably a typo, so it is
 * flagged — never blocked, because older (backdated) entries are valid.
 * `floor` is { km, ms } (ms null = the car's current reading).
 */
export const odometerLowMessage = (floor, unit = 'km') => {
  if (!floor?.km) return '';
  const when = floor.ms
    ? ` · ${localDate(new Date(floor.ms), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';
  return tr('Odometer is lower than your last reading ({0}{1}). Check it? It\'s fine if this is an older entry.', { 0: formatKm(floor.km, unit), 1: when });
};
