import {
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Text from '../components/ui/AppText';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

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
const LanguageModal = ({ visible, onClose, selected, onSelect }) => {
  useHideAdsWhile(visible);
  const { theme } = useSelector(store => store.theme);
  const [search, setSearch] = useState('');

  const isDark = theme === 'dark';
  const currentBg = isDark ? themecolors.darkBlue : themecolors.white;
  const currentText = isDark ? themecolors.white : Colors.darkBlue;
  const subText = isDark ? themecolors.white : themecolors.deepBlue;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code === q)
    : LANGUAGES;

  const close = () => {
    setSearch('');
    onClose();
  };

  const renderItem = ({ item }) => {
    const isSelected = selected === item.code;
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => { close(); if (!isSelected) onSelect(item.code); }}
        accessibilityRole="button"
        accessibilityLabel={`${item.native}, ${item.name}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View>
          <Text style={[styles.name, { color: currentText }]}>{item.native}</Text>
          {item.native !== item.name && (
            <Text style={[styles.sub, { color: subText }]}>{item.name}</Text>
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

      <View style={[styles.sheet, { backgroundColor: currentBg }]}>
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

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('lang.search')}
          accessibilityLabel={t('lang.search')}
          placeholderTextColor={subText}
          style={[
            styles.search,
            { color: currentText, borderColor: search ? (isDark ? accent.light : accent.primary) : '#EEF1F5' },
          ]}
        />

        <FlatList
          data={filtered}
          keyExtractor={item => item.code}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
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
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
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
  search: {
    height: 42,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
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
  name: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  sub: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 2 },
  check: { get color() { return accent.primary; }, fontSize: 16, fontWeight: 'bold' },
});
