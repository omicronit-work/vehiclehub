import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Typography } from '../styles/typography.js'
import { Colors } from '../styles/colors.js'
import { GlobalStyles } from '../styles/globalStyles'
import Header from '../components/Header.jsx'
const Settings = () => {
  return (
    <View style={GlobalStyles.screen}>
    <Header/>
     
     <View style={GlobalStyles.BodyContainer}>
         <Text>Settings</Text>
     </View>
   </View>
  )
}

export default Settings

const styles = StyleSheet.create({})