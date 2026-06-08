import { StyleSheet, StatusBar, View, LogBox } from 'react-native';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useDispatch } from 'react-redux';
import SplashScreen from './src/components/SplashScreen';
import StackNavigation from './src/navigation/StackNavigation';
import SignIn from './src/components/SignIn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import store from './src/store/store';
import { setTheme } from './src/store/themeSlice';
import ToastManager from 'toastify-react-native';
import { setUserEmail } from './src/store/userSlice';

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
}) => {
  const dispatch = useDispatch();

  // Firebase auth listener
  useEffect( () => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
   
        const tick =  await AsyncStorage.getItem('keepSignedIn');

        console.log('user tick::', typeof tick );

        // save email to redux
        dispatch(setUserEmail(user.email));
        if(tick === 'true'){
          setIsLoggedIn(true);
        }else{
          setIsLoggedIn(false);
        }
        
      } else {
        setIsLoggedIn(false);
      }

      setAuthChecked(true);
    });

    return unsubscribe;
  }, [dispatch]);

  // Load theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          dispatch(setTheme(savedTheme));
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      }
    };

    loadTheme();
  }, [dispatch]);

  // ⏳ Splash screen
  if (isSplash) return <SplashScreen />;

  return (
    <NavigationContainer>
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

  // splash timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const showSplash = isSplash || !authChecked;

  return (
    <Provider store={store}>
      <AppContent
        isSplash={showSplash}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        setAuthChecked={setAuthChecked}
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