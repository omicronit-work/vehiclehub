import { zipSync, strToU8 } from 'fflate';
import { toMs } from './backupFormat';

/*
 * Spreadsheet export (spec §3.2): one ZIP with a CSV per kind.
 * UTF-8 with BOM (so Excel shows Thai text), comma separated, CRLF lines,
 * standard quoting. Dates yyyy-mm-dd, decimals with a dot, odometer in km,
 * money as amount + currency. A text cell starting with = + - @ gets an
 * apostrophe so Excel can't run it as a formula.
 */

const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

const pad = n => String(n).padStart(2, '0');
export const ymd = value => {
  const ms = toMs(value);
  if (ms == null) {
    // Already a plain yyyy-mm-dd (schedules store their dates that way).
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** One cell. Numbers stay numbers; text is escaped and quoted as needed. */
export const csvCell = value => {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** columns: [[header, row => value], …] */
export const toCsv = (rows, columns) =>
  BOM +
  [columns.map(([h]) => csvCell(h)), ...rows.map(r => columns.map(([, get]) => csvCell(get(r))))]
    .map(cells => cells.join(','))
    .join('\r\n') +
  '\r\n';

const num = v => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * data: { vehicles, services, schedules, fuelLogs, documents } (backup records)
 * currency: the code of records saved before each record carried its own
 *   `currency` (every newer record names the currency it was entered in).
 * Returns { files: { name: csvText }, bytes: zip Uint8Array }.
 */
export const buildCsvExport = (data, currency) => {
  const vehicleName = Object.fromEntries(
    (data.vehicles || []).map(v => [v.id, [v.brand, v.model, v.year].filter(Boolean).join(' ')]),
  );
  const vName = r => vehicleName[r.vehicleId] || '';

  const files = {
    'vehicles.csv': toCsv(data.vehicles || [], [
      ['id', r => r.id],
      ['brand', r => r.brand],
      ['model', r => r.model],
      ['year', r => num(r.year) ?? r.year],
      ['odometer_km', r => num(r.currentOdometer)],
      ['starting_odometer_km', r => num(r.initialOdometer)],
      ['added', r => ymd(r.createdAt)],
    ]),
    'services.csv': toCsv(data.services || [], [
      ['id', r => r.id],
      ['vehicle_id', r => r.vehicleId],
      ['vehicle', vName],
      ['service', r => r.name],
      ['date', r => ymd(r.serviceDate)],
      ['odometer_km', r => num(r.currentMileage)],
      ['amount', r => num(r.totalCost) ?? 0],
      ['currency', r => r.currency || currency],
      ['shop', r => r.workshopName],
      ['notes', r => r.description],
      ['next_service_date', r => ymd(r.nextServiceDate)],
      ['next_service_km', r => num(r.nextServiceMileage)],
      ['remind_me', r => !!r.remindMe],
    ]),
    'schedules.csv': toCsv(data.schedules || [], [
      ['id', r => r.id],
      ['vehicle_id', r => r.vehicleId],
      ['vehicle', vName],
      ['name', r => r.name],
      ['service_type', r => r.serviceType],
      ['every_km', r => num(r.intervalKm)],
      ['every_months', r => num(r.intervalMonths)],
      ['last_done_date', r => ymd(r.baseDate)],
      ['last_done_odometer_km', r => num(r.baseOdo)],
      ['reminders_on', r => r.remindersOn !== false],
    ]),
    'fuel_logs.csv': toCsv(data.fuelLogs || [], [
      ['id', r => r.id],
      ['vehicle_id', r => r.vehicleId],
      ['vehicle', vName],
      ['date', r => ymd(r.date)],
      ['odometer_km', r => num(r.odometer)],
      ['fuel_type', r => r.fuelType],
      ['fuel_name', r => r.fuelName],
      ['quantity', r => num(r.liters)],
      ['price_per_unit', r => num(r.pricePerLiter)],
      ['amount', r => num(r.totalCost) ?? 0],
      ['currency', r => r.currency || currency],
      ['station', r => r.stationName],
    ]),
    'documents.csv': toCsv(data.documents || [], [
      ['id', r => r.id],
      ['vehicle_id', r => r.vehicleId],
      ['vehicle', vName],
      ['document', r => r.documentName],
      ['issue_date', r => ymd(r.issueDate)],
      ['expiry_date', r => ymd(r.expiryDate)],
      ['notes', r => r.description],
      ['remind_me', r => !!r.remindMe],
      ['remind_days_before', r => num(r.reminderDays)],
    ]),
  };

  const bytes = zipSync(Object.fromEntries(Object.entries(files).map(([n, t]) => [n, strToU8(t)])));
  return { files, bytes };
};
