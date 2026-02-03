import { StyleSheet, View, Image } from 'react-native'
import React from 'react'
import LinearGradient from 'react-native-linear-gradient'
import { GlobalStyles } from '../styles/globalStyles'
import { Colors } from '../styles/colors'

const SplashScreen = () => {
  return (
    <LinearGradient
      colors={['#0057C8', '#004EAB']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 1 }}
      style={[GlobalStyles.container, GlobalStyles.center]}
    >
      {/* Logo */}
      <Image
        style={styles.logo}
        source={require('../assets/logo/logo.png')}
      />

      {/* Wheels at Bottom */}
      <Image
        style={styles.wheels}
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
    left:40,
    width: 430,
    height: 420,
    resizeMode: 'contain',
    opacity: 0.4,
  },
})
