import { StyleSheet, StatusBar } from 'react-native';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import SplashScreen from './src/components/SplashScreen';
import StackNavigation from './src/navigation/StackNavigation'; // Your Stack + Tabs
import SignIn from './src/components/SignIn'
const App = () => {
  const [isSplash, setIsSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Show splash screen
  if (isSplash) return <SplashScreen />;

  // Main app with navigation
  return (
    <NavigationContainer>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SignIn/>
      {/* <StackNavigation /> */}
      
    </NavigationContainer>
  );
};

export default App;