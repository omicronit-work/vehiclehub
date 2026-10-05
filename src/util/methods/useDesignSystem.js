import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { accent } from '../../theme/accent';

export const useDesignSystem = (isDark, ui, form) =>
  useMemo(
    () => ({
      textColor:       { color: isDark ? '#fff' : '#041933' },
      placeholderColor: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(4,25,51,0.38)',
      backgroundColor: isDark ? '#041933' : '#fff',
      dropdownBg:      isDark ? '#0d2240' : '#fff',
      dropdownBorder:  isDark ? '#1e3d60' : '#E2E6EC',
      firstItemBg:     isDark ? accent.alpha(0.22) : accent.alpha(0.06),
      getBorder: (field) => {
        if (ui.touched[field] && ui.errors[field]) return fieldStyles.inputError;
        if (ui.focusedField === field)             return fieldStyles.inputFocused;
        if (form[field])                           return fieldStyles.inputFilled;
        return { borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#EEF1F5' };
      },
    }),
    [isDark, ui, form],
  );

const fieldStyles = StyleSheet.create({
  inputFocused: { get borderColor() { return accent.primary; }, borderWidth: 1.5 },
  inputFilled:  { get borderColor() { return accent.primary; }, borderWidth: 1 },
  inputError:   { borderColor: '#FF3B30', borderWidth: 1 },
});
