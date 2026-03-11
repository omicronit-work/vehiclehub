import { StyleSheet, StatusBar, View } from 'react-native';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import SplashScreen from './src/components/SplashScreen';
import StackNavigation from './src/navigation/StackNavigation';
import SignIn from './src/components/SignIn';

const App = () => {
  const [isSplash, setIsSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Show splash screen
  if (isSplash) return <SplashScreen />;

  // 🔥 CRITICAL: Conditional rendering based on auth state
  return (
    <NavigationContainer>
      
      {isLoggedIn ? (
        <StackNavigation />
      ) : (
        
        <SignIn setIsLoggedIn={setIsLoggedIn} />
       
      )}
    </NavigationContainer>
  );
};

export default App;