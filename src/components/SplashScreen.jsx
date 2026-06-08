import { StyleSheet, View, Image, Animated } from 'react-native'
import React, { useEffect, useRef } from 'react'
import LinearGradient from 'react-native-linear-gradient'
import { GlobalStyles } from '../styles/globalStyles'

const SplashScreen = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current // start slightly below

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <LinearGradient
      colors={['#0057C8', '#004EAB']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 1 }}
      style={[GlobalStyles.container, GlobalStyles.center]}
    >
      {/* Animated Logo */}
      <Animated.Image
        style={[
          styles.logo,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
        source={require('../assets/logo/logo.png')}
      />

      {/* Animated Wheels */}
      <Animated.Image
        style={[
          styles.wheels,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateY.interpolate({
              inputRange: [0, 50],
              outputRange: [0, 30], // slight separate movement
            }) }],
          },
        ]}
        source={require('../assets/logo/wheels.png')}
      />
    </LinearGradient>
  )
}

export default SplashScreen

const styles = StyleSheet.create({
  logo: {
    width: 230,
    height: 44,
    resizeMode: 'contain',
  },
  wheels: {
    position: 'absolute',
    bottom: 0,
    left: 40,
    width: 430,
    height: 420,
    resizeMode: 'contain',
    opacity: 0.4,
  },
})