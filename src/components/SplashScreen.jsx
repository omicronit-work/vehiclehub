import { StyleSheet, Animated, useWindowDimensions } from 'react-native'
import React, { useEffect, useRef } from 'react'
import LinearGradient from 'react-native-linear-gradient'
import { GlobalStyles } from '../styles/globalStyles'
import { useReduceMotion } from '../util/methods/useReduceMotion'
import { accent } from '../theme/accent';

const SplashScreen = () => {
  const { width, height } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(50)).current // start slightly below

  // Wheels art scales with the screen instead of a fixed 430x420 that clips
  // on narrow phones (source image is roughly square).
  const wheelsSize = Math.min(width * 1.1, height * 0.55)

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1)
      translateY.setValue(0)
      return
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, translateY, reduceMotion])

  return (
    <LinearGradient
      colors={[accent.primary, accent.primary]}
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
            width: wheelsSize,
            height: wheelsSize,
            left: width * 0.1,
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
    resizeMode: 'contain',
    opacity: 0.4,
  },
})