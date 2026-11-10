import { StyleSheet, Text, View, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import React from 'react';
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import CloseX from '../assets/svg/CloseX.jsx';
import { reminderStatus, formatReminderDate } from '../util/useUpcomingReminders.js';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';

const VehicleRemindersModal = ({ visible, onClose, vehicle, items = [] }) => {
  useHideAdsWhile(visible);
  const { theme } = useSelector(store => store.theme);
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const bg = isDark ? themecolors.darkBlue : themecolors.white;
  const titleColor = isDark ? themecolors.white : Colors.darkBlue;
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : '#5A6B82';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F5';
  const rowBg = isDark ? 'rgba(255,255,255,0.05)' : accent.alpha(0.05);

  const vehicleName = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ');

  return (
    <Modal
      statusBarTranslucent
 
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriverForBackdrop
      backdropOpacity={0.5}
      style={styles.modal}
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: bg,
            maxHeight: windowHeight * 0.75,
            paddingBottom: 16 + insets.bottom,
          },
        ]}
      >
        <View style={[styles.header, { borderColor: borderCol }]}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: titleColor }]}>Needs attention</Text>
            {!!vehicleName && (
              <Text numberOfLines={1} style={[styles.headerSub, { color: mutedColor }]}>
                {vehicleName}
              </Text>
            )}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.closeButton,
              { backgroundColor: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08) },
            ]}
          >
            <CloseX size={12} color={isDark ? accent.light : accent.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {items.map(item => {
            const status = reminderStatus(item.dueDate);
            return (
              <View key={`${item.kind}-${item.id}`} style={[styles.row, { backgroundColor: rowBg }]}>
                <View style={[styles.stripe, { backgroundColor: status.color }]} />
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: titleColor }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: mutedColor }]}>
                    {item.kind === 'service' ? 'Service due' : 'Expires'}{' '}
                    {formatReminderDate(item.dueDate)}
                  </Text>
                </View>
                <Text style={[styles.rowStatus, { color: status.color }]}>{status.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

export default VehicleRemindersModal;

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  header: {
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 0.9,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: Typography.font.regular,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    marginTop: 16,
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingRight: 14,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderRadius: 2,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: Typography.font.regular,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
  },
  rowStatus: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
});
