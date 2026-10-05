import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { brand, MIN_TOUCH } from '../../theme/tokens';
import { Typography } from '../../styles/typography';

// Shared filled / outline button: >=48pt tall (grows with font scaling),
// disabled + spinner while `loading`, and announced as busy to screen readers.
const PrimaryButton = ({
  title,
  loadingTitle,
  onPress,
  loading = false,
  disabled = false,
  variant = 'filled',
  icon,
  color = brand.primary,
  style,
  accessibilityLabel,
}) => {
  const isOutline = variant === 'outline';
  const inactive = disabled || loading;
  const fg = isOutline ? color : '#fff';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        isOutline
          ? { borderWidth: 1, borderColor: color, backgroundColor: 'transparent' }
          : { backgroundColor: color },
        inactive && { opacity: 0.6 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
        <Text style={[styles.text, { color: fg }]}>
          {loading && loadingTitle ? loadingTitle : title}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default PrimaryButton;

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: Math.max(48, MIN_TOUCH),
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
  },
});
