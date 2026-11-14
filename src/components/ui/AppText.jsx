import React, { forwardRef } from 'react';
import { Text as RNText } from 'react-native';
import { localizeChildren, localizesFigures } from '../../i18n/localizeText';

/*
 * The app's Text. Same props as react-native's Text; in languages that write
 * their own digits or units, figures are shown that way (১০,১৭০ কিমি) —
 * amounts, dates, odometer readings, model years and anything typed by the
 * user alike. Stored data and text inputs are not touched.
 *
 * Changing the language remounts the navigator, so this re-renders with it.
 */
const AppText = forwardRef(({ children, ...props }, ref) => (
  <RNText ref={ref} {...props}>
    {localizesFigures() ? localizeChildren(children) : children}
  </RNText>
));

AppText.displayName = 'AppText';

export default AppText;
