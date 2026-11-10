import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { sha256 } from 'js-sha256';

/*
 * The .vhbackup file (spec "Backup and Export", §3.1). A ZIP holding:
 *   manifest.json   format, schemaVersion, appVersion, createdAt, counts,
 *                   and the SHA-256 of every other file
 *   data/*.json     one array per kind; every record has id, vehicleId
 *                   (not vehicles), updatedAt, and all its fields
 *   photos/*        photos and attachments, original bytes
 * Dates are ISO 8601 UTC, distances km, money a number in the record's own
 * `currency` field (older records without one: the manifest `currency`).
 * Pure: no Firebase or file system here, so it is unit tested as is.
 */

export const BACKUP_FORMAT = 'vehiclehub-backup';
export const SCHEMA_VERSION = 1;
export const BACKUP_EXT = 'vhbackup';
export const BACKUP_MIME = 'application/octet-stream';

// Restore order (R13): vehicles first so every other record has its vehicle.
export const KINDS = ['vehicles', 'schedules', 'services', 'fuelLogs', 'documents'];
export const DATA_FILES = {
  vehicles: 'data/vehicles.json',
  schedules: 'data/schedules.json',
  services: 'data/services.json',
  fuelLogs: 'data/fuel_logs.json',
  documents: 'data/documents.json',
};
export const SETTINGS_FILE = 'data/settings.json';
const MANIFEST = 'manifest.json';

// Fields that hold a photo or attachment URL on the media server.
export const PHOTO_FIELDS = ['imageUrl', 'file'];

export class BackupError extends Error {
  constructor(code, message, file) {
    super(message);
    this.code = code; // 'not-backup' | 'newer' | 'damaged'
    this.file = file || null;
  }
}

const pad = n => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

/** VehicleHub_Backup_2027-03-31_1805.vhbackup (local time). */
export const backupFileName = (d = new Date()) => `VehicleHub_Backup_${stamp(d)}.${BACKUP_EXT}`;
/** VehicleHub_CSV_2027-03-31_1805.zip */
export const csvFileName = (d = new Date()) => `VehicleHub_CSV_${stamp(d)}.zip`;

/* ── Values ─────────────────────────────────────────────────────────────── */

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Firestore Timestamps and Dates → ISO strings, recursively. */
export const toPortable = value => {
  if (value == null || typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d?.getTime?.()) ? null : d.toISOString();
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(toPortable);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPortable(v)]));
};

/** ISO strings written by toPortable → Dates (Firestore stores them as Timestamps). */
export const fromPortable = value => {
  if (typeof value === 'string') return ISO_UTC.test(value) ? new Date(value) : value;
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(fromPortable);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromPortable(v)]));
};

/** Milliseconds of a stored or portable date, or null. */
export const toMs = value => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/** When a record last changed: updatedAt, else when it was made. */
export const recordUpdatedMs = r => toMs(r?.updatedAt) ?? toMs(r?.createdAt);

/**
 * A Firestore record → its backup form. `vehicleId` is omitted for vehicles.
 */
export const toBackupRecord = (id, data, vehicleId) => {
  const fields = toPortable(data || {});
  const updated = recordUpdatedMs(data);
  return {
    ...fields,
    id,
    ...(vehicleId ? { vehicleId } : {}),
    updatedAt: updated != null ? new Date(updated).toISOString() : null,
  };
};

/** Backup record → the fields written back to Firestore (no id / vehicleId). */
export const toFirestoreFields = record => {
  const { id, vehicleId, ...fields } = record;
  return fromPortable(fields);
};

/* ── Bytes ──────────────────────────────────────────────────────────────── */

export const sha256Hex = bytes => sha256(bytes);

const B64_CHUNK = 0x8000;
export const bytesToBase64 = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + B64_CHUNK));
  }
  return global.btoa(bin);
};
export const base64ToBytes = b64 => {
  const bin = global.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const extFromUrl = url => {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : 'jpg';
};

/** Zip path for a record's photo: photos/<recordId>.<ext> (documents' file: <recordId>_file). */
export const photoPath = (recordId, field, url) =>
  `photos/${recordId}${field === 'imageUrl' ? '' : `_${field}`}.${extFromUrl(url)}`;

/** Every { kind, recordId, field, url } photo the records point at. */
export const listPhotoRefs = data => {
  const refs = [];
  KINDS.forEach(kind => (data[kind] || []).forEach(r => {
    PHOTO_FIELDS.forEach(field => {
      const url = r[field];
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        refs.push({ kind, recordId: r.id, field, url, path: photoPath(r.id, field, url) });
      }
    });
  }));
  return refs;
};

/* ── Building ───────────────────────────────────────────────────────────── */

/**
 * data: { vehicles, schedules, services, fuelLogs, documents } (backup records)
 * photos: { [zipPath]: Uint8Array }
 * photoChecksums: { [zipPath]: sha256 hex } already worked out natively for
 *   the photo files; those aren't hashed again here (hashing megabytes in JS
 *   is the slowest part of a backup on the phone).
 * Returns { bytes, manifest }.
 */
export const buildBackup = ({ data, settings = {}, photos = {}, photoChecksums = {}, appVersion = '', currency, createdAt = new Date() }) => {
  const files = {};
  KINDS.forEach(kind => {
    files[DATA_FILES[kind]] = strToU8(JSON.stringify(data[kind] || []));
  });
  files[SETTINGS_FILE] = strToU8(JSON.stringify(settings));
  Object.entries(photos).forEach(([path, bytes]) => { files[path] = bytes; });

  const checksums = Object.fromEntries(Object.entries(files).map(([p, b]) => [p, photoChecksums[p] || sha256Hex(b)]));
  const manifest = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    createdAt: createdAt.toISOString(),
    // Each fuel log / service names its own `currency`; this is the currency
    // of older records that don't (amounts are never converted).
    currency,
    distanceUnit: 'km',
    counts: {
      ...Object.fromEntries(KINDS.map(k => [k, (data[k] || []).length])),
      photos: Object.keys(photos).length,
    },
    checksums,
  };
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
  // Photos are already compressed; zipping them again only costs time.
  const entries = Object.fromEntries(
    Object.entries(files).map(([p, b]) => [p, p.startsWith('photos/') ? [b, { level: 0 }] : b]),
  );
  return { bytes: zipSync(entries, { level: 6 }), manifest };
};

/* ── Checking (R7–R10) ──────────────────────────────────────────────────── */

const NOT_BACKUP = "This isn't a VehicleHub backup file. Pick a file that ends in .vhbackup.";

/**
 * Opens and checks a backup. Throws BackupError, changing nothing, unless
 * the ZIP opens, the manifest is ours, the version is supported and every
 * file matches its checksum.
 * Returns { manifest, data, settings, photos }.
 */
export const readBackup = bytes => {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BackupError('not-backup', NOT_BACKUP);
  }
  if (!files[MANIFEST]) throw new BackupError('not-backup', NOT_BACKUP);

  let manifest;
  try {
    manifest = JSON.parse(strFromU8(files[MANIFEST]));
  } catch {
    throw new BackupError('not-backup', NOT_BACKUP);
  }
  if (manifest?.format !== BACKUP_FORMAT) throw new BackupError('not-backup', NOT_BACKUP);
  if (!(Number(manifest.schemaVersion) >= 1)) throw new BackupError('not-backup', NOT_BACKUP);
  if (Number(manifest.schemaVersion) > SCHEMA_VERSION) {
    throw new BackupError('newer', 'This file was made by a newer VehicleHub. Update the app first.');
  }

  const checksums = manifest.checksums || {};
  const damaged = file =>
    new BackupError('damaged', `${file} in this backup is damaged, so nothing was restored.`, file);

  // Every file must be listed and match; every listed file must be there.
  Object.keys(files).forEach(path => {
    if (path === MANIFEST || path.endsWith('/')) return;
    if (!checksums[path] || sha256Hex(files[path]) !== checksums[path]) throw damaged(path);
  });
  Object.keys(checksums).forEach(path => {
    if (!files[path]) throw damaged(path);
  });

  const parse = path => {
    if (!files[path]) return path === SETTINGS_FILE ? {} : [];
    try {
      return JSON.parse(strFromU8(files[path]));
    } catch {
      throw damaged(path);
    }
  };
  const data = Object.fromEntries(KINDS.map(kind => {
    const list = parse(DATA_FILES[kind]);
    if (!Array.isArray(list)) throw damaged(DATA_FILES[kind]);
    return [kind, list];
  }));
  const photos = Object.fromEntries(
    Object.entries(files).filter(([p]) => p.startsWith('photos/') && !p.endsWith('/')),
  );

  return { manifest, data, settings: parse(SETTINGS_FILE), photos };
};

/* ── Restore plan (R11–R13, R15, R17) ───────────────────────────────────── */

const isRecord = r => r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0;

/**
 * Merge only: decides per record what to do, without touching anything.
 *   fileData   { kind: [backup records] }
 *   phoneData  { kind: [{ id, vehicleId, updatedAt, createdAt }] }
 * Returns { actions: [{ kind, op: 'add' | 'update', record }], counts }.
 * counts.added + updated + upToDate + couldNotRead === counts.total.
 */
export const planRestore = (fileData, phoneData) => {
  const counts = { added: 0, updated: 0, upToDate: 0, couldNotRead: 0, total: 0 };
  const actions = [];

  const phoneVehicleIds = new Set((phoneData.vehicles || []).map(v => v.id));
  const fileVehicleIds = new Set((fileData.vehicles || []).filter(isRecord).map(v => v.id));

  KINDS.forEach(kind => {
    const phoneById = new Map((phoneData[kind] || []).map(r => [r.id, r]));
    const seen = new Set();
    (fileData[kind] || []).forEach(record => {
      counts.total += 1;
      const needsVehicle = kind !== 'vehicles';
      const vehicleKnown = !needsVehicle ||
        (record?.vehicleId && (phoneVehicleIds.has(record.vehicleId) || fileVehicleIds.has(record.vehicleId)));
      if (!isRecord(record) || !vehicleKnown || seen.has(record.id)) {
        counts.couldNotRead += 1;
        return;
      }
      seen.add(record.id);

      const phone = phoneById.get(record.id);
      if (!phone) {
        actions.push({ kind, op: 'add', record });
        counts.added += 1;
        return;
      }
      const fileMs = recordUpdatedMs(record);
      const phoneMs = recordUpdatedMs(phone);
      if (fileMs != null && (phoneMs == null || fileMs > phoneMs)) {
        // Keep it under the vehicle it lives under on the phone.
        actions.push({ kind, op: 'update', record: needsVehicle ? { ...record, vehicleId: phone.vehicleId || record.vehicleId } : record });
        counts.updated += 1;
      } else {
        counts.upToDate += 1;
      }
    });
  });

  return { actions, counts };
};
