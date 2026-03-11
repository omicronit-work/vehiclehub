import { StyleSheet, Text, View, StatusBar } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../styles/colors.js';
import Wheels from '../assets/svg/Wheels.jsx'

const Header = () => {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.container}>
         <Wheels/>

         <View style={{
          height:24,
          width:24,
          backgroundColor:'#fff',
          borderRadius:30
         }}>

         </View>
      </View>
    </SafeAreaView>
  );
};

export default Header;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.primary,
  },
  container: {
    justifyContent:'space-between',
    marginHorizontal:22,
    paddingBottom:15,
    flexDirection:'row'
  },
});
