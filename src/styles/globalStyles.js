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
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.primary
  },
  BodyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5, // creates a slight overlap effect with header
    padding: 24
  },


});
