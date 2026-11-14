import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './AppText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppTheme } from '../../theme/useAppTheme';
import { MIN_TOUCH, shadow } from '../../theme/tokens';
import { Typography } from '../../styles/typography';
import { t as tr } from '../../i18n';

// One date picker for every add/edit sheet, with the same contract as
// DateTimePicker's onChange: (event, date), where event.type is 'set' or
// 'dismissed', fired exactly once per open.
// - Android: the native dialog, unchanged.
// - iOS: a spinner in a panel pinned over the bottom of the sheet (so it never
//   renders underneath the sticky footer), committed with Done.
// Render it as the last child of the sheet container.
const AppDatePicker = ({ value, onChange, minimumDate, maximumDate }) => {
  const c = useAppTheme();
  const [draft, setDraft] = useState(value || new Date());

  useEffect(() => {
    setDraft(value || new Date());
  }, [value]);

  if (Platform.OS !== 'ios') {
    return (
      <DateTimePicker
        value={value || new Date()}
        mode="date"
        display="default"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={onChange}
      />
    );
  }

  return (
    <View
      style={[styles.panel, shadow(4), { backgroundColor: c.surface, borderColor: c.border }]}
      accessibilityViewIsModal
    >
      <View style={[styles.toolbar, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => onChange({ type: 'dismissed' }, undefined)}
          accessibilityRole="button"
          style={styles.toolbarButton}
        >
          <Text style={[styles.toolbarText, { color: c.textMuted }]}>{tr('Cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange({ type: 'set' }, draft)}
          accessibilityRole="button"
          style={styles.toolbarButton}
        >
          <Text style={[styles.toolbarText, styles.done, { color: c.link }]}>{tr('Done')}</Text>
        </TouchableOpacity>
      </View>
      <DateTimePicker
        value={draft}
        mode="date"
        display="spinner"
        themeVariant={c.isDark ? 'dark' : 'light'}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(_, d) => d && setDraft(d)}
      />
    </View>
  );
};

export default AppDatePicker;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarButton: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  toolbarText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
  },
  done: {
    fontFamily: Typography.font.medium,
  },
});
