import { accent } from '../theme/accent';

export const Colors = {
  // User-chosen accent (Settings → App Color)
  get primary() { return accent.primary; },
  white: '#FFFFFF', //white
  //whiteGray: '#F8F7F7', //Off-White
  whiteGray:'#eef1f5',
  darkBlue: '#041933', //Deep Navy Blue
  textinput:'#04193380',
  get richBlue() { return accent.alpha(0.5); },
  
};