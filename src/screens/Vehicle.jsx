import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Typography } from '../styles/typography.js'
import { Colors } from '../styles/colors.js'
import { GlobalStyles } from '../styles/globalStyles'
import Header from '../components/Header.jsx'
const Vehicle = () => {
  return (
    <View style={GlobalStyles.screen}>
    <Header/>
     
     <View style={GlobalStyles.BodyContainer}>
         <Text>Vehicle</Text>
     </View>
   </View>
  )
}

export default Vehicle

const styles = StyleSheet.create({})