/* global jest */
// Native modules have no JS implementation under Jest; stub the ones this app
// imports so screens can be rendered and util logic tested in isolation.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('./specs/NativeReminderScheduler', () => ({
  __esModule: true,
  default: {
    areNotificationsEnabled: jest.fn(() => Promise.resolve(true)),
    requestPermission: jest.fn(() => Promise.resolve(true)),
    canScheduleExactAlarms: jest.fn(() => true),
    schedule: jest.fn(() => Promise.resolve(true)),
    cancel: jest.fn(() => Promise.resolve()),
    cancelAll: jest.fn(() => Promise.resolve()),
    openNotificationSettings: jest.fn(() => Promise.resolve()),
    openAlarmSettings: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('./specs/NativeAppUpdater', () => ({
  __esModule: true,
  default: {
    checkForUpdate: jest.fn(() =>
      Promise.resolve({ available: false, inProgress: false, immediateAllowed: false, availableVersionCode: 0 }),
    ),
    startUpdate: jest.fn(() => Promise.resolve(false)),
    openStore: jest.fn(() => Promise.resolve()),
  },
}));

// Modular API (getAuth / getFirestore + free functions). The Firestore
// functions are bare mocks; tests that touch data give them an in-memory
// implementation (see __tests__/userData.test.js).
jest.mock('@react-native-firebase/auth', () => {
  const authInstance = { currentUser: null };
  return {
    getAuth: jest.fn(() => authInstance),
    onAuthStateChanged: jest.fn(() => jest.fn()),
    signOut: jest.fn(() => Promise.resolve()),
    signInWithCredential: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    reauthenticateWithCredential: jest.fn(),
    updatePassword: jest.fn(),
    deleteUser: jest.fn(),
    GoogleAuthProvider: { credential: jest.fn() },
    EmailAuthProvider: { credential: jest.fn() },
  };
});

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  setUserProperties: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getDocsFromCache: jest.fn(),
  addDoc: jest.fn(),
  getDocFromCache: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
}));

jest.mock('@react-native-firebase/storage', () => jest.fn());

// Backup (util/backup/backupService.js): native file system and file picker.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  readDir: jest.fn(async () => []),
  unlink: jest.fn(async () => {}),
  writeFile: jest.fn(async () => {}),
  readFile: jest.fn(async () => ''),
  moveFile: jest.fn(async () => {}),
  getFSInfo: jest.fn(async () => ({ freeSpace: 1e10 })),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  saveDocuments: jest.fn(),
  types: { allFiles: '*/*' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: jest.fn(() => false),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
    getTokens: jest.fn(),
  },
}));

// The ads SDK is a TurboModule with no JS fallback; sheets import it (via
// util/ads) to hide the banner while they're open.
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(() => Promise.resolve()) }),
  AdsConsent: {
    gatherConsent: jest.fn(() => Promise.resolve()),
    getConsentInfo: jest.fn(() => Promise.resolve({ canRequestAds: false })),
  },
  TestIds: { ADAPTIVE_BANNER: 'test-banner' },
  BannerAd: () => null,
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
}));

