import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import Svg, { Path } from 'react-native-svg';
import { MIN_TOUCH } from '../../theme/tokens';
import { t as tr } from '../../i18n';

/**
 * Optional fields (station or shop, notes, photo…) folded under one
 * "More details" row, so a form asks only for what's needed by default.
 * Opens by itself when `hasValue` is true (e.g. an edit form whose record
 * already has a note), and closes again whenever `resetKey` changes (the
 * sheet was reopened). `onOpen` fires when the user taps it open, once the
 * new fields are laid out, so the form can scroll them into view.
 */
const MoreDetails = ({ summary, hasValue = false, resetKey, color, mutedColor, onOpen, children }) => {
  const [open, setOpen] = useState(hasValue);

  useEffect(() => {
    setOpen(hasValue);
    // Only when the sheet is reopened, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (hasValue) setOpen(true);
  }, [hasValue]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => !o);
    if (!open && onOpen) {
      // Let the expand animation (~300 ms) finish so the new height is known.
      setTimeout(onOpen, 320);
    }
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary ? `${tr('More details')}: ${summary}` : tr('More details')}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.textCol}>
          <Text style={[styles.title, { color }]}>{tr('More details')}</Text>
          {!!summary && <Text style={[styles.summary, { color: mutedColor }]}>{summary}</Text>}
        </View>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        >
          <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
};

export default MoreDetails;

const styles = StyleSheet.create({
  header: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  textCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 12, marginTop: 2 },
  body: { marginTop: 6 },
});
