import { AppState, Linking, LogBox } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import SplashScreen from './src/components/SplashScreen';
import StackNavigation from './src/navigation/StackNavigation';
import SignIn from './src/components/SignIn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from '@react-native-firebase/auth';
import store from './src/store/store';
import { setTheme, setAccent } from './src/store/themeSlice';
import { setAccentHex, normalizeHex } from './src/theme/accent';
import ToastManager from 'toastify-react-native';
import { UndoSnackbarHost } from './src/components/ui/UndoSnackbar';
import { setUserEmail, clearUser } from './src/store/userSlice';
import { rescheduleAllReminders, resyncScheduleReminders } from './src/util/reminderSync';
import { navigationRef, openScheduleDetail, openHome } from './src/util/schedule/scheduleNav';
import { parseScheduleNotificationId } from './src/util/schedule/scheduleReminders';
import PhotoAccessModal from './src/modals/PhotoAccessModal';
import ForceUpdateModal from './src/modals/ForceUpdateModal';
import FirstCurrencyPrompt from './src/modals/FirstCurrencyPrompt';
import { fetchVehicleByEmail } from './src/store/fetchSlice';
import { cleanupBackupFiles, firstRecordAt } from './src/util/backup/backupService';
import { isBackupReminderId, syncBackupReminder } from './src/util/backup/backupReminder';
import { EVENTS, activeRouteName, identifyUser, track, trackScreen } from './src/util/analytics';
import { loadSavedLanguage, useLanguage } from './src/i18n';

// Backup reminder tap: opens Settings → Backup once the signed-in navigator is up.
const openBackupScreen = (attempt = 0) => {
  if (navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes('Backup')) {
    navigationRef.navigate('Backup');
  } else if (attempt < 25) {
    setTimeout(() => openBackupScreen(attempt + 1), 200);
  }
};

LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);

/* =========================
   APP CONTENT (INSIDE PROVIDER)
========================= */
const AppContent = ({
  isSplash,
  isLoggedIn,
  setIsLoggedIn,
  setAuthChecked,
  setThemeLoaded,
}) => {
  const dispatch = useDispatch();
  const userEmail = useSelector(state => state.user.userEmail);
  const accentHex = useSelector(state => state.theme.accent);
  // Keys the navigator below: a new language remounts every screen in it.
  const language = useLanguage();

  // Sync the module every screen reads the accent from before anything below
  // renders. Navigation state is kept so a colour change remounts the screens
  // (picking up the new colour everywhere) without leaving Settings.
  setAccentHex(accentHex);
  const navState = useRef(undefined);

  // screen_view for every route change. The container remounts on an accent
  // change (key below), so repeats of the same screen are skipped.
  const lastScreen = useRef(null);
  const reportScreen = name => {
    if (!name || name === lastScreen.current) return;
    lastScreen.current = name;
    trackScreen(name);
  };

  // Firebase auth listener. "Keep me signed in" is only honoured when
  // restoring a session at cold start; sign-ins during this session are
  // driven by the sign-in screens, so this never races with them.
  const isColdStart = useRef(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      const restoring = isColdStart.current;
      isColdStart.current = false;

      if (!user) {
        identifyUser(null);
        dispatch(clearUser());
        setIsLoggedIn(false);
        setAuthChecked(true);
        return;
      }

      dispatch(setUserEmail(user.email));
      // Analytics is keyed on the uid, never the email address.
      identifyUser(user.uid);

      if (restoring) {
        const keepSignedIn = await AsyncStorage.getItem('keepSignedIn');
        if (keepSignedIn === 'true') {
          setIsLoggedIn(true);
        } else {
          // The session wasn't meant to persist: end it for real rather
          // than leaving Firebase signed in behind the sign-in screen.
          await signOut(getAuth());
        }
      }

      setAuthChecked(true);
    });

    return unsubscribe;
  }, [dispatch, setIsLoggedIn, setAuthChecked]);

  // Load theme into Redux before the splash hides — Redux is the only source
  // screens read, so nothing renders in the wrong theme first. With no saved
  // choice yet, stay on the light default; dark mode is opt-in from Settings.
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        await loadSavedLanguage();
        const savedAccent = normalizeHex(await AsyncStorage.getItem('accentColor'));
        if (savedAccent) {
          dispatch(setAccent(savedAccent));
        }
        if (savedTheme) {
          dispatch(setTheme(savedTheme));
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      } finally {
        setThemeLoaded(true);
      }
    };

    loadTheme();
  }, [dispatch, setThemeLoaded]);

  // A backup cut short leaves a temporary file behind (spec R2).
  useEffect(() => {
    cleanupBackupFiles();
  }, []);

  // Backup reminder (spec R18): re-queued at sign-in and on every return to
  // the app, so its 7-day repeats never run out.
  useEffect(() => {
    if (!isLoggedIn || !userEmail) return undefined;
    const sync = () =>
      fetchVehicleByEmail(userEmail)
        .then(vehicles => syncBackupReminder({ firstRecordAt: firstRecordAt({ vehicles }) }))
        .catch(err => console.log('Backup reminder sync failed:', err));
    sync();
    const sub = AppState.addEventListener('change', state => state === 'active' && sync());
    return () => sub.remove();
  }, [isLoggedIn, userEmail]);

  // Logout cancels every device reminder; rebuild them once someone is signed
  // in.
  useEffect(() => {
    if (!isLoggedIn || !userEmail) return;
    rescheduleAllReminders(userEmail).catch(err => console.log('Reminder resync failed:', err));
  }, [isLoggedIn, userEmail]);

  // Service schedules: distance alerts are checked, and timed ones re-queued,
  // at sign-in and every time the app comes back to the foreground.
  useEffect(() => {
    if (!isLoggedIn || !userEmail) return undefined;
    const sync = () =>
      resyncScheduleReminders(userEmail).catch(err => console.log('Schedule resync failed:', err));
    sync();
    const sub = AppState.addEventListener('change', state => state === 'active' && sync());
    return () => sub.remove();
  }, [isLoggedIn, userEmail]);

  // Tapping a schedule notification opens that schedule's detail (screen 3).
  // The native side launches the app with vehiclehub://reminder/<id>.
  useEffect(() => {
    const handle = url => {
      if (
        /^vehiclehub:\/\/home\/?([?#].*)?$/i.test(url || '') ||
        /^https?:\/\/(www\.)?vehiclehub\.com\/home\/?([?#].*)?$/i.test(url || '')
      ) {
        openHome();
        return;
      }
      const match = /^vehiclehub:\/\/reminder\/(.+)$/.exec(url || '');
      if (!match) return;
      const id = decodeURIComponent(match[1]);
      track(EVENTS.NOTIFICATION_OPENED, { kind: isBackupReminderId(id) ? 'backup' : 'schedule' });
      if (isBackupReminderId(id)) openBackupScreen();
      else openScheduleDetail(parseScheduleNotificationId(id));
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  // Notification permission is not asked at launch or sign-in: it is asked
  // with an explanation when the user first turns on a reminder or saves a
  // schedule (util/reminderFeedback.js askNotificationPermission).

  // The signed-out flow isn't a navigator, so its screen is reported here.
  useEffect(() => {
    if (!isSplash && !isLoggedIn) reportScreen('SignIn');
  }, [isSplash, isLoggedIn]);

  // Splash screen
  if (isSplash) return <SplashScreen />;

  return (
    <NavigationContainer
      ref={navigationRef}
      key={`${accentHex}-${language}`}
      initialState={navState.current}
      onReady={() => {
        const state = navigationRef.getRootState();
        if (state?.routes?.length) reportScreen(activeRouteName(state));
      }}
      onStateChange={state => {
        navState.current = state;
        reportScreen(activeRouteName(state));
      }}
    >
      {isLoggedIn ? (
        <StackNavigation setIsLoggedIn={setIsLoggedIn} />
      ) : (
        <SignIn setIsLoggedIn={setIsLoggedIn} />
      )}
    </NavigationContainer>
  );
};

/* =========================
   ROOT APP
========================= */
const App = () => {
  const [isSplash, setIsSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Short floor so the splash animation doesn't just flash; beyond that the
  // splash stays only as long as auth + theme actually take.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Safety net: if Firebase never reports an auth state (e.g. a hung native
  // init), fall through to Sign in rather than leaving the splash up forever.
  useEffect(() => {
    if (authChecked) return undefined;
    const timer = setTimeout(() => setAuthChecked(true), 10000);
    return () => clearTimeout(timer);
  }, [authChecked]);

  const showSplash = isSplash || !authChecked || !themeLoaded;


  return (
    <Provider store={store}>
      <AppContent
        isSplash={showSplash}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        setAuthChecked={setAuthChecked}
        setThemeLoaded={setThemeLoaded}
      />

      <PhotoAccessModal />

      {/* After the first sign-in: the user picks their currency (drives fuel types). */}
      <FirstCurrencyPrompt ready={!showSplash && isLoggedIn} />

      {/* "Deleted · Undo" bar after removing a fuel log, service or document. */}
      <UndoSnackbarHost />

      {/* Last so it sits above everything: blocks the app until updated */}
      <ForceUpdateModal />

      {/* <ToastManager topOffset={-3} showCloseIcon={false} /> */}

      <ToastManager 
      position="top"
         topOffset={-3}
         
  
        showCloseIcon={false}
        style={{
          width: '90%',
          marginHorizontal: '5%',
          borderRadius: 12,
          
        }}
      />
    </Provider>
  );
};

export default App;