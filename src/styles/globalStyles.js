import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { Typography } from './typography';
import { accent } from '../theme/accent';

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
    minHeight:44,
    padding:10,
    borderRadius:12,
  },
  btnFull:{
    width:'100%'
  },
  screen: {
    flex: 1,
    get backgroundColor() { return accent.primary; }
  },
  BodyContainer: {
    flex: 1,
    
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth:0,
    marginTop: 5, // creates a slight overlap effect with header
    padding: 24
  },


});
