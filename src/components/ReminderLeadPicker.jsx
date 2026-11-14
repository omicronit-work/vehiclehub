import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './ui/AppText';
import { REMINDER_LEAD_OPTIONS } from '../util/notifications.js';
import { accent } from '../theme/accent';
import { t as tr } from '../i18n';
import { localDate, localTime } from '../i18n';

// "Remind me 1 / 7 / 14 / 30 days before" chips under a reminder toggle.
// `t` is the sheet's theme tokens (text, muted, inputBg, inputBorder).
const ReminderLeadPicker = ({ t, value, onChange, disabled }) => (
  <View style={styles.wrap}>
    <Text style={[styles.label, { color: t.muted }]}>{tr('Remind me')}</Text>
    <View style={styles.row}>
      {REMINDER_LEAD_OPTIONS.map(days => {
        const selected = value === days;
        return (
          <TouchableOpacity
            key={days}
            disabled={disabled}
            onPress={() => onChange(days)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={days === 1 ? tr('1 day before') : tr('{0} days before', { 0: days })}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: accent.primary, borderColor: accent.primary }
                : { backgroundColor: t.inputBg, borderColor: t.inputBorder },
            ]}
          >
            <Text style={[styles.chipText, { color: selected ? '#fff' : t.text }]}>
              {days === 1 ? tr('1 day') : tr('{0} days', { 0: days })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    <Text style={[styles.label, { color: t.muted }]}>{tr('before, at 9:00')}</Text>
  </View>
);

export default ReminderLeadPicker;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'RobotoCondensed500' },
});

// "Reminder 24 Oct 2026, 09:00", noting when the chosen notice period has
// already passed and the reminder comes sooner instead.
export const describeReminder = (slot, daysBefore) => {
  if (!slot) return '';
  const at = new Date(slot.fireAt);
  const when = `${localDate(at, { day: 'numeric', month: 'short', year: 'numeric' })}, ${localTime(at, { hour: '2-digit', minute: '2-digit' })}`;
  return slot.daysLeft < daysBefore
    ? tr('Reminder {0} (too late for {1} days\' notice)', { 0: when, 1: daysBefore })
    : tr('Reminder {0}', { 0: when });
};
