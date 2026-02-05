import { StyleSheet, Text, View, ScrollView } from 'react-native'
import React, { useState, useEffect } from 'react'
import SplashScreen from './src/components/SplashScreen'
import SignUp from './src/components/SignUp'
const App = () => {
  // State to control splash screen visibility
  const [isSplash, setIsSplash] = useState(true)

  // useEffect to handle splash screen timer
  useEffect(() => {
   
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 3000);

    // Cleanup function to clear timer on component unmount
    return () => clearTimeout(timer);
  }, []); 

  // Render splash screen if isSplash is true
  if (isSplash) return <SplashScreen />;

  // Main app content after splash screen
  return (
       <>
       
        <SignUp/>
        
       </>
  )
}

export default App

const styles = StyleSheet.create({})