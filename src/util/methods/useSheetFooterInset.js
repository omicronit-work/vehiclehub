import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sheets are drawn edge-to-edge (Android 15+ enforces it), so a sticky footer
// has to pad itself above the system navigation bar or the bar covers the
// Save button. With the keyboard up the footer already sits above the bar.
export const useSheetFooterInset = () => {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardOpen ? 0 : insets.bottom;
};
