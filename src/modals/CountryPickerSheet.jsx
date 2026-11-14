import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import Svg, { Circle, Path } from 'react-native-svg';
import Text from '../components/ui/AppText';
import PrimaryButton from '../components/ui/PrimaryButton';
import CloseX from '../assets/svg/CloseX.jsx';
import { Typography } from '../styles/typography.js';
import { useAppTheme } from '../theme/useAppTheme';
import { accent } from '../theme/accent';
import { COUNTRIES, findCountry } from '../util/countries';
import { useHideAdsWhile } from '../util/ads';
import { t } from '../i18n';

const GlobeIcon = ({ color }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
    <Path d="M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z"
      stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = ({ color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
    <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const CheckIcon = ({ color }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Bottom sheet listing the 20 supported countries. The user taps one and
 * confirms with the button. Without `onClose` it can't be dismissed (first
 * run); with it, it shows a close button and closes on back / backdrop tap.
 * `onHidden` runs once the sheet has finished closing.
 */
const CountryPickerSheet = ({ visible, selected, onConfirm, onClose, onHidden }) => {
  const th = useAppTheme();
  const [picked, setPicked] = useState(null);
  const [search, setSearch] = useState('');
  useHideAdsWhile(visible);

  useEffect(() => {
    if (visible) {
      setPicked(findCountry(selected));
      setSearch('');
    }
  }, [visible, selected]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [search]);

  const accentFg = th.isDark ? accent.light : accent.primary;
  const tint = th.isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08);
  const fieldBg = th.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB';
  const flagBg = th.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';

  const renderItem = ({ item }) => {
    const isPicked = picked?.code === item.code;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setPicked(item)}
        style={[styles.row, isPicked && { backgroundColor: tint }]}
        accessibilityRole="radio"
        accessibilityState={{ selected: isPicked }}
        accessibilityLabel={t(item.name)}
      >
        <View style={[styles.flagWell, { backgroundColor: isPicked ? accent.alpha(0.18) : flagBg }]}>
          <Text style={styles.flag}>{item.flag}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: th.text }]} numberOfLines={1}>{t(item.name)}</Text>
          <Text style={[styles.code, { color: th.textMuted }]}>{item.code}</Text>
        </View>
        <View
          style={[
            styles.radio,
            isPicked ? { backgroundColor: accent.primary, borderColor: accent.primary } : { borderColor: th.border },
          ]}
        >
          {isPicked && <CheckIcon color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      isVisible={visible}
      statusBarTranslucent
      backdropOpacity={0.55}
      useNativeDriverForBackdrop
      avoidKeyboard
      onBackButtonPress={onClose}
      onBackdropPress={onClose}
      onModalHide={onHidden}
      style={styles.modal}
    >
      <View style={[styles.sheet, { backgroundColor: th.surface }]}>
        {onClose && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: tint }]}
          >
            <CloseX size={12} color={accentFg} />
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <View style={[styles.iconWell, { backgroundColor: tint }]}>
            <GlobeIcon color={accentFg} />
          </View>
          <Text style={[styles.title, { color: th.text }]}>{t('Choose your country')}</Text>
          <Text style={[styles.subtitle, { color: th.textMuted }]}>
            {t('Fuel types and vehicle documents are shown for this country. You can change it any time in Settings.')}
          </Text>
        </View>

        <View style={[styles.search, { backgroundColor: fieldBg }]}>
          <SearchIcon color={th.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('Search country...')}
            placeholderTextColor={th.placeholder}
            accessibilityLabel={t('Search country...')}
            style={[styles.searchInput, { color: th.text }]}
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={list}
          keyExtractor={item => item.code}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: th.textMuted }]}>{t('No country found')}</Text>
          }
        />

        <View style={[styles.footer, { borderTopColor: th.border }]}>
          <PrimaryButton
            title={picked ? t('Continue with {0}', { 0: `${picked.flag} ${t(picked.name)}` }) : t('Choose your country')}
            onPress={() => picked && onConfirm(picked)}
            disabled={!picked}
          />
        </View>
      </View>
    </Modal>
  );
};

export default CountryPickerSheet;

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: { alignItems: 'center', paddingHorizontal: 24 },
  iconWell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.large,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Typography.font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    padding: 0,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 4,
  },
  flagWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 24 },
  rowText: { flex: 1 },
  name: { fontFamily: Typography.font.medium, fontSize: Typography.textsize.small },
  code: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', marginTop: 24, fontFamily: Typography.font.regular },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
