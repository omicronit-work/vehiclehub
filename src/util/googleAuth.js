import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ensureUserDocument } from '../store/userSlice';

let configured = false;
const ensureConfigured = () => {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: '277905798436-ocl93blcfve1ch1likgs13icikq39ocr.apps.googleusercontent.com',
  });
  configured = true;
};

// Runs the Google account picker and returns a Firebase credential for it.
// Also used to re-authenticate before sensitive actions (account deletion).
export const getGoogleCredential = async () => {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  if (signInResult?.type === 'cancelled') {
    const error = new Error('Google sign-in was cancelled');
    error.code = 'cancelled';
    throw error;
  }

  let idToken = signInResult.data?.idToken || signInResult.idToken;
  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }
  if (!idToken) throw new Error('No ID token found');

  return {
    credential: GoogleAuthProvider.credential(idToken),
    googleUser: signInResult.data?.user,
  };
};

// Shared by the Sign in and Sign up screens. Creates the Firestore profile on
// first sign-in only, so later sign-ins never reset a name/photo the user has
// changed, and always keeps the session (Google users have no checkbox).
export const signInWithGoogle = async () => {
  const { credential, googleUser } = await getGoogleCredential();
  const { user: firebaseUser } = await signInWithCredential(getAuth(), credential);

  await AsyncStorage.setItem('keepSignedIn', 'true');

  const profile = await ensureUserDocument({
    email: firebaseUser.email,
    name: firebaseUser.displayName || googleUser?.name || '',
    photo: firebaseUser.photoURL || googleUser?.photo || '',
    termCondition: false,
  });

  return {
    email: firebaseUser.email,
    name: profile?.name || '',
    photo: profile?.photo || '',
    termCondition: profile?.termCondition ?? false,
  };
};

// Signs out of the Google account too, so the next Google sign-in shows the
// account picker instead of silently reusing the previous user.
export const signOutOfGoogle = async () => {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch (_) {}
};
