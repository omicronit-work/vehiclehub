import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import { accent } from '../theme/accent';
import { MIN_TOUCH, shadowSoft as shadow } from '../theme/tokens';

// The everyday actions, most common first. Wording matches the rest of the
// app: a "service" is work that was done, a "schedule" is a repeating
// reminder for one.
export const QUICK_ADD_ACTIONS = [
  { key: 'fuel', label: 'Fuel', hint: 'Log a fill-up' },
  { key: 'service', label: 'Service', hint: 'Record work that was done' },
  { key: 'document', label: 'Document', hint: 'Insurance, tax, registration…' },
  { key: 'schedule', label: 'Schedule', hint: 'Get reminded when a service is due' },
];

/**
 * Home's single "+" button: one tap opens this menu, a second tap opens the
 * form. Rendered in a transparent Modal so it sits above the tab bar and a tap
 * anywhere outside closes it.
 */
const QuickAddMenu = ({ visible, onClose, onSelect, isDark, bottomOffset = 70 }) => {
  // The Modal draws under the status and navigation bars so the dim covers
  // the whole screen; the menu keeps its place above the gesture bar.
  const insets = useSafeAreaInsets();
  const c = {
    sheet: isDark ? '#0F2547' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#0F1F3D',
    muted: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
    divider: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
    iconBg: isDark ? accent.lightAlpha(0.2) : accent.tint,
    icon: isDark ? accent.light : accent.primary,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close add menu"
      >
        <View
          style={[styles.menu, { backgroundColor: c.sheet, bottom: bottomOffset + insets.bottom }, shadow(4)]}
          accessibilityRole="menu"
        >
          {QUICK_ADD_ACTIONS.map((a, i) => (
            <Pressable
              key={a.key}
              onPress={() => {
                onClose();
                onSelect(a.key);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={`Add ${a.label}. ${a.hint}`}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={[styles.iconWell, { backgroundColor: c.iconBg }]}>
                <PlusStroke color={c.icon} size={14} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.label, { color: c.text }]}>{a.label}</Text>
                <Text style={[styles.hint, { color: c.muted }]}>{a.hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
};

export default QuickAddMenu;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute',
    right: 20,
    width: 270,
    borderRadius: 16,
    paddingVertical: 4,
  },
  row: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, paddingVertical: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 2 },
});
