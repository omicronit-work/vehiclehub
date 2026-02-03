import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { Typography } from './typography';

export const GlobalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    fontSize:Typography.textsize.large
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  button:{
    padding :10,
    minHeight:40,
    width:100,
    backgroundColor:Colors.primary,
    borderRadius:10
  },
  btnFull:{
    width:'100%'
  }

});
