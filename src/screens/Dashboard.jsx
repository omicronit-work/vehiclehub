import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Typography } from '../styles/typography.js'
import { Colors } from '../styles/colors.js'
import { GlobalStyles } from '../styles/globalStyles'
import Header from '../components/Header'
const Dashboard = () => {
  return (
    <View style={GlobalStyles.screen}>
     <Header/>
      
      <View style={GlobalStyles.BodyContainer}>
          <Text>DashBoard</Text>
      </View>
    </View>
  )
}

export default Dashboard

const styles = StyleSheet.create({})