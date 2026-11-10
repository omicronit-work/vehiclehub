import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EyeSvg from '../../assets/svg/EyeSvg';
import CloseEye from '../../assets/svg/CloseEye';
import CheckBox from '../../assets/svg/CheckBox';
import TickBox from '../../assets/svg/TickBox';
import { Typography } from '../../styles/typography';
import { MIN_TOUCH } from '../../theme/tokens';

// Pieces shared by Sign in / Sign up / Reset so contrast, touch targets and
// screen-reader labels are fixed once. `c` is the palette from useAppTheme().

const borderFor = (c, error, value) =>
  error ? c.danger : value ? c.inputBorderFilled : c.inputBorder;

export const AuthField = React.forwardRef(
  ({ c, label, error, style, ...inputProps }, ref) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={c.placeholder}
        style={[
          styles.input,
          { borderColor: borderFor(c, error, inputProps.value), color: c.text },
          style,
        ]}
        {...inputProps}
      />
      {!!error && (
        <Text style={[styles.errorText, { color: c.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  ),
);

export const PasswordField = React.forwardRef(({ c, label = 'Password', error, ...inputProps }, ref) => {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {/* Toggle is centred on the input row, so it stays aligned at any font size. */}
      <View style={styles.passwordRow}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={c.placeholder}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            styles.passwordInput,
            { borderColor: borderFor(c, error, inputProps.value), color: c.text },
          ]}
          {...inputProps}
        />
        <TouchableOpacity
          onPress={() => setHidden(h => !h)}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          style={styles.eyeButton}
        >
          {hidden ? <CloseEye color={c.textMuted} /> : <EyeSvg color={c.textMuted} />}
        </TouchableOpacity>
      </View>
      {!!error && (
        <Text style={[styles.errorText, { color: c.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
});

// The whole row (box + label) is one >=44pt checkbox target.
export const CheckboxRow = ({ c, checked, onToggle, label, error }) => (
  <TouchableOpacity
    onPress={onToggle}
    activeOpacity={0.7}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    accessibilityLabel={label}
    style={styles.checkboxRow}
  >
    {checked ? (
      <TickBox height={20} width={20} />
    ) : (
      <CheckBox color={error ? c.danger : c.inputBorder} height={20} width={20} />
    )}
    <Text style={[styles.checkboxLabel, { color: error ? c.danger : c.text }]}>{label}</Text>
  </TouchableOpacity>
);

export const TextLink = ({ c, title, onPress, accessibilityLabel }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="link"
    accessibilityLabel={accessibilityLabel || title}
    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
  >
    <Text style={[styles.link, { color: c.isDark ? c.link : c.text }]}>{title}</Text>
  </TouchableOpacity>
);

export const OrDivider = ({ c }) => (
  <View style={styles.divider} accessible={false} importantForAccessibility="no-hide-descendants">
    <View style={[styles.line, { backgroundColor: c.divider }]} />
    <Text style={[styles.dividerText, { color: c.textMuted }]}>OR</Text>
    <View style={[styles.line, { backgroundColor: c.divider }]} />
  </View>
);

export const FormError = ({ c, message }) =>
  message ? (
    <View
      style={[styles.formError, { backgroundColor: c.dangerBg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Text style={[styles.formErrorText, { color: c.danger }]}>{message}</Text>
    </View>
  ) : null;

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  input: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: Typography.textsize.small,
  },
  passwordRow: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: MIN_TOUCH + 4,
  },
  eyeButton: {
    position: 'absolute',
    right: 2,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.Extrasmall,
    marginLeft: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TOUCH,
    flexShrink: 1,
  },
  checkboxLabel: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    flexShrink: 1,
  },
  link: {
    textDecorationLine: 'underline',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.Extrasmall,
  },
  formError: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  formErrorText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
});
