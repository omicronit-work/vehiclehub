import React, { forwardRef } from 'react';
import { Text as RNText } from 'react-native';
import { localizeChildren, localizesFigures } from '../../i18n/localizeText';
import { translateChildren, useTranslatedText } from '../../i18n/userText';

/*
 * The app's Text. Same props as react-native's Text, plus:
 *   - text in another language than the app's (what the user typed: service
 *     and document names, notes, shop names…) is shown translated, on the
 *     phone (i18n/userText). Pass `translate={false}` for text that must stay
 *     exactly as written.
 *   - in languages that write their own digits or units, figures are shown
 *     that way (১০,১৭০ কিমি).
 * Stored data and text inputs are not touched.
 *
 * Changing the language remounts the navigator, so this re-renders with it.
 */
const AppText = forwardRef(({ children, translate = true, ...props }, ref) => {
  useTranslatedText();
  const text = translate ? translateChildren(children) : children;
  return (
    <RNText ref={ref} {...props}>
      {localizesFigures() ? localizeChildren(text) : text}
    </RNText>
  );
});

AppText.displayName = 'AppText';

export default AppText;
