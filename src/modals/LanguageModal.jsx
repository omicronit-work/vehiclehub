import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Text from '../components/ui/AppText';
import React from 'react';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import CloseX from '../assets/svg/CloseX.jsx';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { LANGUAGES } from '../i18n/languages';
import { t } from '../i18n';

// Settings → Language. Each row shows the language in its own script (so
// people can find theirs whatever the app is in) with the English name below.
// The sheet is as tall as its few rows (up to 75% of the screen).
const LanguageModal = ({ visible, onClose, selected, onSelect }) => {
  useHideAdsWhile(visible);
  const { theme } = useSelector(store => store.theme);
  const insets = useSafeAreaInsets();

  const isDark = theme === 'dark';
  const currentBg = isDark ? themecolors.darkBlue : themecolors.white;
  const currentText = isDark ? themecolors.white : Colors.darkBlue;
  const subText = isDark ? themecolors.white : themecolors.deepBlue;

  const close = onClose;

  // Names are shown exactly as listed (never translated), so people can find
  // their own language whatever the app is in.
  const renderItem = ({ item, last }) => {
    const isSelected = selected === item.code;
    return (
      <TouchableOpacity
        key={item.code}
        style={[styles.item, last && styles.itemLast]}
        onPress={() => { close(); if (!isSelected) onSelect(item.code); }}
        accessibilityRole="button"
        accessibilityLabel={`${item.native}, ${item.name}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View>
          <Text translate={false} style={[styles.name, { color: currentText }]}>{item.native}</Text>
          {item.native !== item.name && (
            <Text translate={false} style={[styles.sub, { color: subText }]}>{item.name}</Text>
          )}
        </View>
        {isSelected && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <TouchableWithoutFeedback onPress={close} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: currentBg, paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: currentText }]}>{t('lang.title')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={close}
            style={[
              styles.closeButton,
              { backgroundColor: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08) },
            ]}
          >
            <CloseX size={12} color={isDark ? accent.light : accent.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} bounces={false}>
          {LANGUAGES.map((item, index) => renderItem({ item, last: index === LANGUAGES.length - 1 }))}
        </ScrollView>
      </View>
    </Modal>
  );
};

export default LanguageModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  list: { marginTop: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: Typography.font.regular, fontSize: 18 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    minHeight: 56,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLast: { borderBottomWidth: 0 },
  name: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  sub: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 2 },
  check: { get color() { return accent.primary; }, fontSize: 16, fontWeight: 'bold' },
});
