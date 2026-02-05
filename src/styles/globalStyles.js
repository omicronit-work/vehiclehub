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
    width:'100%',
    height:40,
    padding:9,
    borderRadius:12,
  },
  btnFull:{
    width:'100%'
  }

});
