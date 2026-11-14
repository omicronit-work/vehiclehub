import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
} from '@react-native-firebase/firestore';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { pick, keepLocalCopy, saveDocuments, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { version as appVersion } from '../../../package.json';
import { BASE_CURRENCY } from '../fx';
import { uploadImage } from '../imageStorage';
import { rescheduleAllReminders, resyncScheduleReminders } from '../reminderSync';
import {
  BACKUP_MIME,
  KINDS,
  PHOTO_FIELDS,
  backupFileName,
  base64ToBytes,
  buildBackup,
  bytesToBase64,
  csvFileName,
  listPhotoRefs,
  photoPath,
  planRestore,
  readBackup,
  toBackupRecord,
  toFirestoreFields,
  toMs,
} from './backupFormat';
import { buildCsvExport } from './csvExport';
import { LAST_BACKUP_KEY, syncBackupReminder } from './backupReminder';
import { t as tr } from '../../i18n';

/*
 * Backup, spreadsheet export and restore against the real data: records in
 * Cloud Firestore (users/{email}/vehicles/{id}/…, the source of truth, so a
 * restore writes there), photos on the media server. Files are built in the
 * app's cache folder, which needs no storage permission; saving and sharing
 * go through Android's own sheets (R4).
 */

const SUBCOLLECTION = {
  services: 'services',
  fuelLogs: 'fuelLogs',
  documents: 'documents',
  schedules: 'schedules',
};
const WORK_DIR = `${RNFS.CachesDirectoryPath}/backups`;
const TMP = '.tmp';
const PHOTO_TIMEOUT_MS = 20000;
const PHOTO_CONCURRENCY = 4;
const COMMIT_WAIT_MS = 20000;

export class BackupProblem extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code; // 'no-vehicles' | 'photos-offline' | 'no-space' | 'write-failed'
    Object.assign(this, extra);
  }
}

const vehiclesRef = email => collection(getFirestore(), 'users', email, 'vehicles');
const kindRef = (email, kind, vehicleId) =>
  collection(getFirestore(), 'users', email, 'vehicles', vehicleId, SUBCOLLECTION[kind]);
const recordDoc = (email, kind, record) =>
  kind === 'vehicles'
    ? doc(vehiclesRef(email), record.id)
    : doc(kindRef(email, kind, record.vehicleId), record.id);

// A record saved on this phone but not yet on the server (e.g. offline)
// reads its updatedAt as null until the upload. It is the newest version
// there is, so date it now: a restore must never overwrite it.
const snapData = d => {
  const data = d.data() || {};
  if (data.updatedAt == null && d.metadata?.hasPendingWrites) return { ...data, updatedAt: new Date() };
  return data;
};

/**
 * Every record the user has, as backup records. Read together, right after
 * one another; Firestore offers no snapshot across collections on a phone.
 */
export const collectUserData = async email => {
  const vSnap = await getDocs(vehiclesRef(email));
  const vehicles = vSnap.docs.map(d => toBackupRecord(d.id, snapData(d)));
  const data = { vehicles, schedules: [], services: [], fuelLogs: [], documents: [] };

  const perVehicle = await Promise.all(vehicles.map(v => Promise.all(
    ['schedules', 'services', 'fuelLogs', 'documents'].map(async kind => {
      const snap = await getDocs(kindRef(email, kind, v.id));
      return [kind, snap.docs.map(d => toBackupRecord(d.id, snapData(d), v.id))];
    }),
  )));
  perVehicle.forEach(lists => lists.forEach(([kind, list]) => data[kind].push(...list)));
  return data;
};

const readSettings = async () => {
  const pairs = await AsyncStorage.multiGet(['selectedCurrency', 'currencyMode', 'distanceUnit', 'theme', 'accentColor']);
  const out = {};
  pairs.forEach(([k, v]) => {
    if (v == null) return;
    try {
      out[k] = JSON.parse(v);
    } catch {
      out[k] = v;
    }
  });
  return out;
};

const ensureDir = async dir => {
  if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
};

const removeQuietly = async path => {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch (_) {}
};

/** At launch: a backup cut short leaves a .tmp file; delete it (R2). */
export const cleanupBackupFiles = async () => {
  try {
    if (!(await RNFS.exists(WORK_DIR))) return;
    const items = await RNFS.readDir(WORK_DIR);
    await Promise.all(items.filter(i => i.name.endsWith(TMP)).map(i => removeQuietly(i.path)));
  } catch (_) {}
};

// Old finished files are only copies already saved or shared; keep the cache small.
const clearWorkDir = async () => {
  try {
    if (!(await RNFS.exists(WORK_DIR))) return;
    const items = await RNFS.readDir(WORK_DIR);
    await Promise.all(items.map(i => removeQuietly(i.path)));
  } catch (_) {}
};

const downloadPhoto = async url => {
  const tmp = `${WORK_DIR}/photo-${Date.now()}-${Math.random().toString(36).slice(2)}${TMP}`;
  try {
    const { promise } = RNFS.downloadFile({
      fromUrl: url,
      toFile: tmp,
      connectionTimeout: PHOTO_TIMEOUT_MS,
      readTimeout: PHOTO_TIMEOUT_MS,
    });
    const res = await promise;
    if (res.statusCode < 200 || res.statusCode >= 300) return { ok: false, gone: res.statusCode === 404 };
    // The checksum is worked out natively on the file; in JS it took tens of
    // seconds for a single camera photo and froze the progress text.
    const [b64, sha256] = await Promise.all([
      RNFS.readFile(tmp, 'base64'),
      RNFS.hash ? RNFS.hash(tmp, 'sha256').catch(() => null) : null,
    ]);
    return { ok: true, bytes: base64ToBytes(b64), sha256: sha256 ? String(sha256).toLowerCase() : null };
  } catch {
    return { ok: false, gone: false };
  } finally {
    removeQuietly(tmp);
  }
};

/** Writes bytes under a temporary name, then renames it when complete (R2). */
const writeAtomically = async (name, bytes) => {
  const final = `${WORK_DIR}/${name}`;
  const tmp = `${final}${TMP}`;
  try {
    await RNFS.writeFile(tmp, bytesToBase64(bytes), 'base64');
    await removeQuietly(final);
    await RNFS.moveFile(tmp, final);
    return final;
  } catch (e) {
    await removeQuietly(tmp);
    throw new BackupProblem('write-failed', tr('The backup file couldn\'t be written. Free some space and try again.'), { cause: e });
  }
};

const checkSpace = async neededBytes => {
  try {
    const { freeSpace } = await RNFS.getFSInfo();
    // Room for the file under its temporary name plus the finished copy.
    if (freeSpace < neededBytes * 2 + 5 * 1024 * 1024) {
      const mb = Math.max(1, Math.ceil((neededBytes * 2) / (1024 * 1024)));
      throw new BackupProblem('no-space', tr('Not enough space (needs about {0} MB). Free some space and try again.', { 0: mb }));
    }
  } catch (e) {
    if (e instanceof BackupProblem) throw e;
  }
};

const counts = data => ({
  vehicles: data.vehicles.length,
  servicesAndSchedules: data.services.length + data.schedules.length,
  fuelLogs: data.fuelLogs.length,
  documents: data.documents.length,
});

/**
 * Back up now. `withPhotos: false` skips photos that can't be fetched
 * ("Create without photos", R3). Resolves to
 * { path, name, size, counts, photos, missingPhotos }.
 */
export const createBackup = async (email, { withPhotos = true, onStep } = {}) => {
  onStep?.(tr('Reading your records…'));
  const data = await collectUserData(email);
  if (!data.vehicles.length) throw new BackupProblem('no-vehicles', tr('Add a vehicle first.'));

  await ensureDir(WORK_DIR);
  await clearWorkDir();

  // R3: photos that live only on the server are fetched.
  const refs = listPhotoRefs(data);
  const photos = {};
  const photoChecksums = {};
  let missing = 0;
  let unreachable = 0;
  // A few downloads at a time: one by one, each slow photo held up the rest.
  let next = 0;
  let done = 0;
  if (refs.length) onStep?.(tr('Getting photos… 0 of {0}', { 0: refs.length }));
  const worker = async () => {
    while (next < refs.length) {
      const ref = refs[next++];
      const res = await downloadPhoto(ref.url);
      if (res.ok) {
        photos[ref.path] = res.bytes;
        if (res.sha256) photoChecksums[ref.path] = res.sha256;
      }
      else if (res.gone) missing += 1; // deleted from the server: nothing to fetch
      else unreachable += 1;
      done += 1;
      onStep?.(tr('Getting photos… {0} of {1}', { 0: done, 1: refs.length }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PHOTO_CONCURRENCY, refs.length) }, worker));
  if (unreachable > 0 && withPhotos) {
    throw new BackupProblem(
      'photos-offline',
      (unreachable === 1 ? tr("1 photo couldn't be downloaded. You may be offline.") : tr("{0} photos couldn't be downloaded. You may be offline.", { 0: unreachable })),
      { unreachable },
    );
  }

  const photoBytes = Object.values(photos).reduce((s, b) => s + b.length, 0);
  await checkSpace(photoBytes + 1024 * 1024);

  onStep?.(tr('Building the file…'));
  // Let the screen show "Building the file…" before the zip work starts.
  await new Promise(resolve => setTimeout(resolve, 50));
  const createdAt = new Date();
  const { bytes } = buildBackup({
    data,
    settings: await readSettings(),
    photos,
    photoChecksums,
    appVersion,
    currency: BASE_CURRENCY,
    createdAt,
  });
  const name = backupFileName(createdAt);
  const path = await writeAtomically(name, bytes);

  // R5: set when the file is created (the app can't know it was saved).
  await AsyncStorage.setItem(LAST_BACKUP_KEY, String(createdAt.getTime()));
  syncBackupReminder({ firstRecordAt: firstRecordAt(data) }).catch(() => {});

  return {
    path,
    name,
    size: bytes.length,
    counts: counts(data),
    photos: Object.keys(photos).length,
    missingPhotos: missing + unreachable,
  };
};

/** When the oldest vehicle was added (every record belongs to a vehicle). */
export const firstRecordAt = data => {
  const times = (data.vehicles || []).map(v => toMs(v.createdAt)).filter(Boolean);
  return times.length ? Math.min(...times) : null;
};

/** "Save to phone or Drive": Android's own save sheet; no permission needed. */
export const saveFileToDevice = async ({ path, name, mimeType = BACKUP_MIME }) => {
  try {
    const [res] = await saveDocuments({ sourceUris: [`file://${path}`], mimeType, fileName: name });
    return !!res?.uri && !res?.error;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return false;
    throw e;
  }
};

// Loaded on use (its native module isn't there in tests).
export const shareFile = ({ path, name, mimeType = BACKUP_MIME }) =>
  require('react-native-share').default.open({
    url: `file://${path}`,
    type: mimeType,
    filename: name,
    failOnCancel: false,
  });

export const CSV_MIME = 'application/zip';

// Reading records waits on the network when Firestore has nothing cached;
// past this the export stops with a clear message instead of spinning.
export const EXPORT_TIMEOUT_MS = 40 * 1000;

const withTimeout = (promise, ms, problem) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(problem), ms); }),
  ]).finally(() => clearTimeout(timer));
};

/**
 * Export spreadsheet: builds the CSV zip in the cache folder. The screen then
 * shows the result and offers Save / Share, so the user always sees an
 * outcome even if a share sheet is dismissed or can't open.
 * `onStep(text)` reports progress. Resolves to { path, name, size, counts }.
 */
export const exportSpreadsheet = async (email, { onStep } = {}) => {
  onStep?.(tr('Reading your records…'));
  const data = await withTimeout(
    collectUserData(email),
    EXPORT_TIMEOUT_MS,
    new BackupProblem('timeout', tr('Your records couldn\'t be loaded in time. Check your connection and try again.')),
  );
  onStep?.(tr('Making the file…'));
  if (!data.vehicles.length) throw new BackupProblem('no-vehicles', tr('Add a vehicle first.'));
  await ensureDir(WORK_DIR);
  const { bytes } = buildCsvExport(data, BASE_CURRENCY);
  const name = csvFileName();
  const path = await writeAtomically(name, bytes);
  return { path, name, size: bytes.length, counts: counts(data) };
};

/**
 * R6–R10: the owner picks a file; it is opened and fully checked before
 * anything is shown. Resolves to null when the picker is cancelled,
 * otherwise { fileName, backup } — or throws BackupError naming the problem.
 */
export const pickAndCheckBackup = async () => {
  let picked;
  try {
    [picked] = await pick({ type: [types.allFiles] });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
  if (!picked?.uri) return null;

  await ensureDir(WORK_DIR);
  const [copy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: `restore-${Date.now()}.vhbackup` }],
    destination: 'cachesDirectory',
  });
  if (copy.status !== 'success') throw new Error(copy.copyError || "The file couldn't be opened.");

  const localPath = decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
  try {
    const bytes = base64ToBytes(await RNFS.readFile(localPath, 'base64'));
    return { fileName: picked.name || 'backup', backup: readBackup(bytes) };
  } finally {
    removeQuietly(localPath);
  }
};

const urlStillWorks = async url => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const extOf = path => path.split('.').pop();

/**
 * Restore (merge only, R11–R17). Nothing on the phone is deleted and
 * settings are untouched. Every change goes in one Firestore batch, which
 * is applied all or nothing (R14).
 * Resolves to { counts, photosRestored, photosNotRestored, pendingUpload }.
 */
export const restoreBackup = async (email, backup, { onStep } = {}) => {
  onStep?.(tr('Comparing with this phone…'));
  const phone = await collectUserData(email);
  const { actions, counts: c } = planRestore(backup.data, phone);

  // Photos: a record coming back keeps its photo when the link still works;
  // otherwise the photo from the file is uploaded again.
  let photosRestored = 0;
  let photosNotRestored = 0;
  const photoJobs = [];
  actions.forEach(a => PHOTO_FIELDS.forEach(field => {
    const url = a.record[field];
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
    const path = photoPath(a.record.id, field, url);
    if (backup.photos[path]) photoJobs.push({ action: a, field, url, path });
  }));
  for (let i = 0; i < photoJobs.length; i++) {
    const job = photoJobs[i];
    onStep?.(tr('Restoring photos… {0} of {1}', { 0: i + 1, 1: photoJobs.length }));
    if (await urlStillWorks(job.url)) {
      photosRestored += 1;
      continue;
    }
    const local = `${WORK_DIR}/upload-${job.action.record.id}.${extOf(job.path)}`;
    try {
      await ensureDir(WORK_DIR);
      await RNFS.writeFile(local, bytesToBase64(backup.photos[job.path]), 'base64');
      const up = await uploadImage(`file://${local}`);
      if (up.success) {
        job.action.record = { ...job.action.record, [job.field]: up.url };
        photosRestored += 1;
      } else {
        photosNotRestored += 1;
      }
    } finally {
      removeQuietly(local);
    }
  }

  onStep?.('Saving…');
  let pendingUpload = false;
  if (actions.length) {
    const batch = writeBatch(getFirestore());
    // R13 order is kept by planRestore (vehicles first).
    actions.forEach(a => batch.set(recordDoc(email, a.kind, a.record), toFirestoreFields(a.record)));
    // The batch is applied on the phone at once; the promise settles when
    // the server has it. Offline, it uploads later, so don't wait forever.
    const result = await Promise.race([
      batch.commit().then(() => 'done'),
      new Promise(resolve => setTimeout(() => resolve('pending'), COMMIT_WAIT_MS)),
    ]);
    pendingUpload = result === 'pending';
  }

  // R16: service and document reminders for their next dates, at 09:00.
  onStep?.(tr('Setting reminders…'));
  await rescheduleAllReminders(email).catch(() => {});
  await resyncScheduleReminders(email).catch(() => {});

  return { counts: c, photosRestored, photosNotRestored, pendingUpload, kinds: KINDS };
};
