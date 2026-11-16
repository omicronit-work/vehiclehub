import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firestore from '@react-native-firebase/firestore';

/*
 * Fast Firestore reads. A plain getDocs()/getDoc() waits for a round trip to
 * the server whenever the phone is online — seconds on a slow connection —
 * even though Firestore already keeps the same data on the phone. Here a read
 * returns the phone's copy at once and refreshes from the server in the
 * background:
 *
 *   readDocs(ref) / readDoc(ref)
 *     1. the phone's copy, when this data has been loaded before → instant
 *     2. otherwise (fresh install, never opened) → waits for the server once
 *     3. once the screen has loaded, the server is asked again (at most every
 *        30 s per path, two at a time); when it differs from what was shown (an edit made on another
 *        phone), useRemoteDataVersion() changes so screens read it again.
 *
 * Writes made on this phone land in the phone's copy immediately, so the user
 * always sees their own changes without waiting.
 */

const SYNCED_KEY = 'fastRead:synced';
const REFRESH_EVERY_MS = 30 * 1000;

let synced = null; // paths read from the server at least once (kept across starts)
let syncedLoad = null;
let saveTimer = null;
const lastRefresh = new Map(); // path → ms of the last background refresh
let version = 0;
const listeners = new Set();

let generation = 0; // bumped by resetFastRead, so a load begun before it is ignored

const loadSynced = () => {
  if (!syncedLoad) {
    const gen = generation;
    syncedLoad = AsyncStorage.getItem(SYNCED_KEY)
      .then(raw => { if (gen === generation) synced = new Set(raw ? JSON.parse(raw) : []); })
      .catch(() => { if (gen === generation) synced = new Set(); });
  }
  return syncedLoad;
};

const markSynced = path => {
  if (!synced || synced.has(path)) return;
  synced.add(path);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(SYNCED_KEY, JSON.stringify([...synced])).catch(() => {});
  }, 1000);
};

const bump = () => {
  version += 1;
  listeners.forEach(fn => fn());
};

// What a snapshot holds, to tell whether the server's copy differs.
const docsPrint = snap => snap.docs.map(d => `${d.id}:${JSON.stringify(d.data())}`).sort().join('|');
const docPrint = snap => (snap.exists() ? JSON.stringify(snap.data()) : '∅');

// Background refreshes wait until the screen has finished loading (no read for
// a moment), then run a couple at a time: dozens of server answers arriving at
// once would otherwise hold up the reads the screen is waiting for.
const IDLE_BEFORE_REFRESH_MS = 3000;
const REFRESH_AT_ONCE = 2;
const refreshQueue = new Map(); // path → { fetchServer, print, shownPrint }
let refreshTimer = null;
let refreshing = 0;

const pumpRefreshes = () => {
  while (refreshing < REFRESH_AT_ONCE && refreshQueue.size) {
    const [path, job] = refreshQueue.entries().next().value;
    refreshQueue.delete(path);
    refreshing += 1;
    job.fetchServer()
      .then(fresh => {
        markSynced(path);
        if (job.print(fresh) !== job.shownPrint) bump();
      })
      .catch(() => {}) // offline: the phone's copy stays, try again later
      .finally(() => {
        refreshing -= 1;
        pumpRefreshes();
      });
  }
};

// Called on every read: pushes the start of the refreshes back while the app
// is still busy loading.
const holdRefreshes = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(pumpRefreshes, IDLE_BEFORE_REFRESH_MS);
};

const refreshLater = (path, fetchServer, print, shown) => {
  const last = lastRefresh.get(path) || 0;
  if (Date.now() - last < REFRESH_EVERY_MS) return;
  lastRefresh.set(path, Date.now());
  refreshQueue.set(path, { fetchServer, print, shownPrint: print(shown) });
};

// The same path read again while a read is under way shares it (Home, the
// garage cards and the reminders all ask for a vehicle's services at start).
const inflight = new Map();
const shared = (key, read) => {
  if (!inflight.has(key)) {
    inflight.set(key, read().finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
};

/** A collection or query, from the phone at once when it has been loaded before. */
export const readDocs = ref => {
  holdRefreshes();
  return shared(`docs:${ref.path}`, async () => {
    await loadSynced();
    const path = ref.path;
    let cached = null;
    try {
      cached = await firestore.getDocsFromCache(ref);
    } catch {}
    if (cached && (!cached.empty || synced.has(path))) {
      refreshLater(path, () => firestore.getDocs(ref), docsPrint, cached);
      return cached;
    }
    const snap = await firestore.getDocs(ref);
    markSynced(path);
    lastRefresh.set(path, Date.now());
    return snap;
  });
};

/** A single document, the same way. */
export const readDoc = ref => {
  holdRefreshes();
  return shared(`doc:${ref.path}`, async () => {
    await loadSynced();
    const path = ref.path;
    let cached = null;
    if (typeof firestore.getDocFromCache === 'function') {
      try {
        cached = await firestore.getDocFromCache(ref);
      } catch {}
    }
    if (cached && (cached.exists() || synced.has(path))) {
      refreshLater(path, () => firestore.getDoc(ref), docPrint, cached);
      return cached;
    }
    const snap = await firestore.getDoc(ref);
    markSynced(path);
    lastRefresh.set(path, Date.now());
    return snap;
  });
};

const subscribe = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getVersion = () => version;

/**
 * Changes when a background refresh brings different data from the server.
 * Put it in a loading effect's dependencies to show those changes.
 */
export const useRemoteDataVersion = () => useSyncExternalStore(subscribe, getVersion);

/**
 * Pull-to-refresh: the next reads still return the phone's copy at once, but
 * ask the server straight away instead of waiting for the 30-second gap.
 */
export const refreshFromServerSoon = () => {
  lastRefresh.clear();
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(pumpRefreshes, 0);
};

/**
 * Forget what was loaded (sign-out / account deletion), including background
 * refreshes still queued for the previous account's paths.
 */
export const resetFastRead = () => {
  generation += 1;
  synced = new Set();
  // A load of the saved list still under way must not bring it back.
  syncedLoad = Promise.resolve();
  clearTimeout(saveTimer);
  lastRefresh.clear();
  refreshQueue.clear();
  clearTimeout(refreshTimer);
  AsyncStorage.removeItem(SYNCED_KEY).catch(() => {});
};
