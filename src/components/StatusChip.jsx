import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// The due / expiry chip from Home's service and document rows. `colors` is
// one entry of statusTones(isDark) (theme/statusTones.js).
const StatusChip = ({ label, colors, style, maxWidth = 150 }) => (
  <View style={[styles.chip, { backgroundColor: colors.bg, maxWidth }, style]}>
    <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.text, { color: colors.text }]}>
      {label}
    </Text>
  </View>
);

export default StatusChip;

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  text: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
});
