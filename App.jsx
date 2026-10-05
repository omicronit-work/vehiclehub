import { LogBox } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import SplashScreen from './src/components/SplashScreen';
import StackNavigation from './src/navigation/StackNavigation';
import SignIn from './src/components/SignIn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import store from './src/store/store';
import { setTheme, setAccent } from './src/store/themeSlice';
import { setAccentHex, normalizeHex } from './src/theme/accent';
import ToastManager from 'toastify-react-native';
import { setUserEmail, clearUser } from './src/store/userSlice';
import { rescheduleAllReminders } from './src/util/reminderSync';

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

  // Sync the module every screen reads the accent from before anything below
  // renders. Navigation state is kept so a colour change remounts the screens
  // (picking up the new colour everywhere) without leaving Settings.
  setAccentHex(accentHex);
  const navState = useRef(undefined);

  // Firebase auth listener. "Keep me signed in" is only honoured when
  // restoring a session at cold start; sign-ins during this session are
  // driven by the sign-in screens, so this never races with them.
  const isColdStart = useRef(true);
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      const restoring = isColdStart.current;
      isColdStart.current = false;

      if (!user) {
        dispatch(clearUser());
        setIsLoggedIn(false);
        setAuthChecked(true);
        return;
      }

      dispatch(setUserEmail(user.email));

      if (restoring) {
        const keepSignedIn = await AsyncStorage.getItem('keepSignedIn');
        if (keepSignedIn === 'true') {
          setIsLoggedIn(true);
        } else {
          // The session wasn't meant to persist: end it for real rather
          // than leaving Firebase signed in behind the sign-in screen.
          await auth().signOut();
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

  // Logout cancels every device reminder; rebuild them once someone is signed
  // in. Notification permission is NOT requested here — that happens the first
  // time the user saves a reminder, so the prompt has context.
  useEffect(() => {
    if (!isLoggedIn || !userEmail) return;
    rescheduleAllReminders(userEmail).catch(err => console.log('Reminder resync failed:', err));
  }, [isLoggedIn, userEmail]);

  // ⏳ Splash screen
  if (isSplash) return <SplashScreen />;

  return (
    <NavigationContainer
      key={accentHex}
      initialState={navState.current}
      onStateChange={state => { navState.current = state; }}
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