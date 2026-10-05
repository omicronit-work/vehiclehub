/* global jest */
// Native modules have no JS implementation under Jest; stub the ones this app
// imports so screens can be rendered and util logic tested in isolation.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('@react-native-firebase/auth', () => {
  const authInstance = {
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
    signOut: jest.fn(() => Promise.resolve()),
    signInWithCredential: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const auth = () => authInstance;
  auth.GoogleAuthProvider = { credential: jest.fn() };
  auth.EmailAuthProvider = { credential: jest.fn() };
  return auth;
});

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = jest.fn();
  firestore.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    delete: jest.fn(() => 'DELETE_FIELD'),
  };
  return firestore;
});

jest.mock('@react-native-firebase/storage', () => jest.fn());

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
    getTokens: jest.fn(),
  },
}));
