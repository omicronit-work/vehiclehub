import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { MIN_TOUCH } from '../../theme/tokens';
import { Typography } from '../../styles/typography';

// Shown when a load fails, so a network error never looks like "no data"
// (which led users to re-add records they already had).
const ErrorState = ({
  title = "Couldn't load your data",
  message = 'Check your connection and try again.',
  onRetry,
  compact = false,
  style,
}) => {
  const c = useAppTheme();
  return (
    <View
      style={[styles.wrap, compact && styles.compact, style]}
      accessibilityRole="alert"
    >
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={[styles.retry, { backgroundColor: c.primary }]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ErrorState;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  compact: {
    paddingVertical: 20,
  },
  title: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.medium,
    textAlign: 'center',
  },
  message: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    textAlign: 'center',
  },
  retry: {
    marginTop: 12,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 24,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#fff',
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.small,
  },
});
