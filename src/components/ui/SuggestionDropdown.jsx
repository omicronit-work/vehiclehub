import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Text from './AppText';
import PlusStroke from '../../assets/svg/PlusStroke';
import { useTheme } from '../../util/methods/useTheme';
import { accent } from '../../theme/accent';
import { t as tr } from '../../i18n';

const NAVY = 'rgba(4, 25, 51, 1)';

// Autocomplete list shown under a text field (vehicle brand/model/year,
// service detail fields). Sits in the layout flow, not absolute: Android only
// delivers touches inside a parent's bounds, so an overlay hanging below the
// field couldn't scroll.
//
// items    suggestions to show (already filtered)
// query    the field's current text
// known    the full list — typed text with no match in it offers
//          "+ Add This <addLabel>" (only when `onAdd` is given)
// hint     text shown instead of the list (e.g. "Choose a brand first")
// selected item to highlight (a picker's current value); otherwise the
//          first match is highlighted while typing
// display  item → text shown for it (e.g. the brand in the app language);
//          onSelect still gets the item itself
const SuggestionDropdown = ({ items = [], query = '', known = [], onSelect, onAdd, addLabel, hint, selected, display }) => {
  const isDark = useTheme();
  const c = {
    bg: isDark ? '#0F2C52' : '#fff',
    border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.08)',
    highlight: isDark ? accent.lightAlpha(0.18) : accent.alpha(0.06),
    text: isDark ? '#fff' : NAVY,
    muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
    accent: isDark ? accent.light : accent.primary,
  };
  const box = [styles.dropdown, { backgroundColor: c.bg, borderColor: c.border }];

  if (hint) {
    return (
      <View style={box}>
        <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>
      </View>
    );
  }

  const inputClean = query.trim();
  const exactMatch = known.some(item =>
    [item, display ? display(item) : item].some(name => String(name).toLowerCase() === inputClean.toLowerCase()));

  if (onAdd && inputClean.length > 0 && items.length === 0 && !exactMatch) {
    return (
      <View style={box}>
        <TouchableOpacity activeOpacity={0.7} onPress={onAdd} style={styles.addRow}>
          <Text style={[styles.itemText, styles.addQuery, { color: c.text }]} numberOfLines={1}>
            {query}
          </Text>
          <View style={styles.addAction}>
            <PlusStroke size={14} strokeWidth={2.4} color={c.accent} />
            <Text style={[styles.addActionText, { color: c.accent }]}>{tr('Add This')}{' '}{addLabel}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={box}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        style={styles.scroll}
      >
        {items.map((item, index) => {
          const highlighted = selected != null ? item === selected : index === 0 && !!inputClean;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.item, highlighted && { backgroundColor: c.highlight }]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.itemText,
                  { color: c.text, fontFamily: highlighted ? 'RobotoCondensed500' : 'RobotoCondensed400' },
                ]}
              >
                {display ? display(item) : item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default SuggestionDropdown;

const styles = StyleSheet.create({
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 1000,
    boxShadow: '0px 4px 10px rgba(10, 42, 85, 0.15)',
    overflow: 'hidden',
  },
  scroll: { maxHeight: 176 },
  item: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  itemText: { fontSize: 14 },
  hint: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addQuery: { flexShrink: 1 },
  addAction: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  addActionText: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 13,
  },
});
