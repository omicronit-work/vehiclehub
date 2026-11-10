import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  BackupError,
  backupFileName,
  buildBackup,
  csvFileName,
  fromPortable,
  listPhotoRefs,
  planRestore,
  readBackup,
  sha256Hex,
  toBackupRecord,
} from '../src/util/backup/backupFormat';
import { buildCsvExport, csvCell, toCsv } from '../src/util/backup/csvExport';
import { planBackupReminders } from '../src/util/backup/backupReminder';

const iso = s => new Date(s).toISOString();

// Spec §5: 2 vehicles, 5 services and schedules, 6 fuel logs = 13 records.
const fileData = () => ({
  vehicles: [
    { id: 'honda', brand: 'Honda', model: 'Accord RS', updatedAt: iso('2027-03-01T10:00:00Z') },
    { id: 'corolla', brand: 'Toyota', model: 'Corolla', updatedAt: iso('2027-03-01T10:00:00Z') },
  ],
  schedules: [
    { id: 'oil', vehicleId: 'honda', name: 'Engine oil', updatedAt: iso('2027-03-20T10:00:00Z') },
    { id: 'tyre', vehicleId: 'honda', name: 'Tyre rotation', updatedAt: iso('2027-03-20T10:00:00Z') },
  ],
  services: [
    { id: 's1', vehicleId: 'honda', name: 'Engine oil refill', totalCost: 3200, updatedAt: iso('2027-02-20T10:00:00Z'), imageUrl: 'https://media.example/a.jpg' },
    { id: 's2', vehicleId: 'honda', name: 'Air filter', totalCost: 450, updatedAt: iso('2027-03-10T10:00:00Z'), imageUrl: 'https://media.example/b.png' },
    { id: 's3', vehicleId: 'corolla', name: 'Brakes', totalCost: 900, updatedAt: iso('2027-03-11T10:00:00Z') },
  ],
  fuelLogs: Array.from({ length: 6 }, (_, i) => ({
    id: `f${i}`, vehicleId: 'honda', liters: 30, totalCost: 1200, updatedAt: iso(`2027-01-0${i + 1}T10:00:00Z`),
    ...(i === 0 ? { imageUrl: 'https://media.example/r.jpg' } : {}),
  })),
  documents: [],
});

const phoneData = () => ({
  vehicles: [{ id: 'honda', updatedAt: iso('2027-03-01T10:00:00Z') }],
  schedules: [
    { id: 'oil', vehicleId: 'honda', updatedAt: iso('2027-03-02T10:00:00Z') },
    { id: 'tyre', vehicleId: 'honda', updatedAt: iso('2027-03-25T10:00:00Z') },
  ],
  services: [],
  fuelLogs: [],
  documents: [],
});

const photos = () => ({
  'photos/s1.jpg': new Uint8Array([1, 2, 3]),
  'photos/s2.png': new Uint8Array([4, 5]),
  'photos/f0.jpg': new Uint8Array([6]),
});

const makeFile = () =>
  buildBackup({ data: fileData(), photos: photos(), appVersion: '1.0.21', currency: 'BDT', createdAt: new Date(2027, 2, 31, 18, 5) });

test('photo checksums worked out natively are used as given, and the file still reads back', () => {
  const pics = photos();
  const known = { 'photos/s1.jpg': sha256Hex(pics['photos/s1.jpg']) };
  const { bytes, manifest } = buildBackup({
    data: fileData(), photos: pics, photoChecksums: known, currency: 'BDT', createdAt: new Date(2027, 2, 31, 18, 5),
  });
  expect(manifest.checksums['photos/s1.jpg']).toBe(known['photos/s1.jpg']);
  expect(Object.keys(readBackup(bytes).photos)).toHaveLength(3);
});

test('T1: file names follow the pattern', () => {
  const at = new Date(2027, 2, 31, 18, 5);
  expect(backupFileName(at)).toBe('VehicleHub_Backup_2027-03-31_1805.vhbackup');
  expect(csvFileName(at)).toBe('VehicleHub_CSV_2027-03-31_1805.zip');
});

test('T1: manifest counts and checksums', () => {
  const { bytes, manifest } = makeFile();
  expect(manifest.format).toBe('vehiclehub-backup');
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.counts).toMatchObject({ vehicles: 2, schedules: 2, services: 3, fuelLogs: 6, photos: 3 });
  const files = unzipSync(bytes);
  expect(Object.keys(manifest.checksums).sort()).toEqual(Object.keys(files).filter(p => p !== 'manifest.json').sort());
  const back = readBackup(bytes);
  expect(back.data.fuelLogs).toHaveLength(6);
  expect(Object.keys(back.photos)).toHaveLength(3);
});

test('worked example: 10 added, 1 updated, 2 up to date, 0 unreadable (T5, T6, T12)', () => {
  const { counts, actions } = planRestore(fileData(), phoneData());
  expect(counts).toEqual({ added: 10, updated: 1, upToDate: 2, couldNotRead: 0, total: 13 });
  expect(counts.added + counts.updated + counts.upToDate + counts.couldNotRead).toBe(counts.total);
  expect(actions.find(a => a.record.id === 'oil').op).toBe('update'); // file is newer
  expect(actions.find(a => a.record.id === 'tyre')).toBeUndefined(); // phone is newer
  expect(actions[0].kind).toBe('vehicles'); // R13 order
});

test('T4: restoring the same file twice changes nothing the second time', () => {
  const file = fileData();
  const phone = phoneData();
  const first = planRestore(file, phone);
  // The phone now holds what the first restore wrote.
  const after = { ...phone };
  first.actions.forEach(({ kind, record }) => {
    after[kind] = [...after[kind].filter(r => r.id !== record.id), record];
  });
  const second = planRestore(file, after);
  expect(second.actions).toHaveLength(0);
  expect(second.counts.upToDate).toBe(13);
});

test('a record whose vehicle exists nowhere could not be read', () => {
  const file = fileData();
  file.fuelLogs.push({ id: 'orphan', vehicleId: 'gone', updatedAt: iso('2027-01-01') });
  file.services.push({ name: 'no id' });
  const { counts } = planRestore(file, phoneData());
  expect(counts.couldNotRead).toBe(2);
  expect(counts.total).toBe(15);
});

test('T2: one damaged byte is refused and the file is named', () => {
  const files = unzipSync(makeFile().bytes);
  const damaged = new Uint8Array(files['data/fuel_logs.json']);
  damaged[5] ^= 1;
  const bytes = zipSync({ ...files, 'data/fuel_logs.json': damaged });
  expect(() => readBackup(bytes)).toThrow(BackupError);
  try {
    readBackup(bytes);
  } catch (e) {
    expect(e.code).toBe('damaged');
    expect(e.file).toBe('data/fuel_logs.json');
  }
});

test('T3: a newer schemaVersion is refused', () => {
  const files = unzipSync(makeFile().bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  manifest.schemaVersion = 2;
  const bytes = zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(manifest)) });
  expect(() => readBackup(bytes)).toThrow('This file was made by a newer VehicleHub. Update the app first.');
});

test('a file that is not a backup is refused', () => {
  expect(() => readBackup(new Uint8Array([1, 2, 3]))).toThrow(BackupError);
  expect(() => readBackup(zipSync({ 'a.txt': strToU8('hi') }))).toThrow(/isn't a VehicleHub backup/);
});

test('an extra file not in the manifest is refused', () => {
  const files = unzipSync(makeFile().bytes);
  expect(() => readBackup(zipSync({ ...files, 'photos/extra.jpg': new Uint8Array([9]) }))).toThrow(BackupError);
});

test('dates become ISO and come back as Dates; updatedAt falls back to createdAt', () => {
  const ts = { toDate: () => new Date('2027-03-31T11:05:00Z'), toMillis: () => Date.parse('2027-03-31T11:05:00Z') };
  const rec = toBackupRecord('x', { date: ts, createdAt: ts, odometer: 100, note: '2027-01-01' }, 'v1');
  expect(rec).toMatchObject({ id: 'x', vehicleId: 'v1', date: '2027-03-31T11:05:00.000Z', updatedAt: '2027-03-31T11:05:00.000Z' });
  const back = fromPortable(rec);
  expect(back.date).toBeInstanceOf(Date);
  expect(back.note).toBe('2027-01-01'); // plain day strings stay strings
});

test('photo refs name photos/<recordId>.<ext>', () => {
  expect(listPhotoRefs(fileData()).map(r => r.path).sort()).toEqual(['photos/f0.jpg', 'photos/s1.jpg', 'photos/s2.png']);
});

test('sha256', () => {
  expect(sha256Hex(strToU8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

/* ── CSV ── */

test('T10: a formula-looking note gets an apostrophe', () => {
  expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  expect(csvCell('+66 81')).toBe("'+66 81");
  expect(csvCell('@sum')).toBe("'@sum");
  expect(csvCell(-12.5)).toBe('-12.5'); // numbers are not text
});

test('T9: BOM, CRLF, quoting, Thai text, real numbers and dates', () => {
  const text = toCsv([{ a: 'น้ำมันเครื่อง, ฿', b: 1234.5 }], [['name', r => r.a], ['amount', r => r.b]]);
  expect(text.startsWith('﻿')).toBe(true);
  expect(text).toBe('﻿name,amount\r\n"น้ำมันเครื่อง, ฿",1234.5\r\n');

  const { files } = buildCsvExport(
    { ...fileData(), fuelLogs: [{ id: 'f', vehicleId: 'honda', date: '2027-01-05T05:00:00.000Z', odometer: 2000, liters: 40, totalCost: 1660 }] },
    'BDT',
  );
  expect(Object.keys(files).sort()).toEqual(['documents.csv', 'fuel_logs.csv', 'schedules.csv', 'services.csv', 'vehicles.csv']);
  const row = files['fuel_logs.csv'].split('\r\n')[1];
  expect(row).toMatch(/^f,honda,Honda Accord RS,2027-01-05,2000,,,40,,1660,BDT,$/);
});

/* ── Reminder (T11) ── */

const DAY = 86400000;
const at = (y, m, d, h = 0) => new Date(y, m - 1, d, h).getTime();

test('T11: 09:00 once a backup is 30 days old, repeating every 7 days', () => {
  const last = at(2027, 3, 1, 15);
  const { times } = planBackupReminders({ lastBackupAt: last, now: at(2027, 3, 2) });
  expect(new Date(times[0])).toEqual(new Date(2027, 3, 1, 9)); // 31 Mar 09:00 is only 29 d 18 h
  expect(times[1] - times[0]).toBe(7 * DAY);
});

test('no backup: due 7 days after the first record; nothing without records', () => {
  const { times } = planBackupReminders({ firstRecordAt: at(2027, 1, 1, 8), now: at(2027, 1, 2) });
  expect(new Date(times[0])).toEqual(new Date(2027, 0, 8, 9));
  expect(planBackupReminders({ now: at(2027, 1, 2) }).times).toEqual([]);
});

test('overdue: the series keeps its weekly rhythm across app launches', () => {
  const first = planBackupReminders({ lastBackupAt: at(2027, 1, 1), now: at(2027, 3, 10, 12) });
  expect(new Date(first.times[0])).toEqual(new Date(2027, 2, 11, 9)); // next 09:00
  const later = planBackupReminders({ lastBackupAt: at(2027, 1, 1), now: at(2027, 3, 12, 12), anchor: first.anchor });
  expect(new Date(later.times[0])).toEqual(new Date(2027, 2, 18, 9)); // not 13 Mar
});
