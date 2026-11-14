import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import Svg, { Circle, Path } from 'react-native-svg';
import Text from '../components/ui/AppText';
import PrimaryButton from '../components/ui/PrimaryButton';
import Currency from '../assets/svg/Currency.jsx';
import { Typography } from '../styles/typography.js';
import { useAppTheme } from '../theme/useAppTheme';
import { accent } from '../theme/accent';
import { currencies } from '../util/currencies.js';
import { useHideAdsWhile } from '../util/ads';
import { applyAccountCurrency, setManualCurrency } from '../util/methods/useCurrency';
import { getUserCurrency, saveUserCurrency } from '../store/userSlice';
import { t } from '../i18n';

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
 * On every sign-in (email/password or Google) and app start, checks the
 * account's currency in the database: when it has one, that currency is used
 * here without asking; when it has none, the user is asked. Mounted in App.jsx. It can't be dismissed: the user picks a currency and taps Continue.
 */
const FirstCurrencyPrompt = ({ ready }) => {
  const th = useAppTheme();
  const [visible, setVisible] = useState(false);
  const userEmail = useSelector(state => state.user.userEmail);
  const [picked, setPicked] = useState(null);
  const [search, setSearch] = useState('');
  useHideAdsWhile(visible);

  useEffect(() => {
    // Signed out (or another account): close and check again for the next one.
    if (!ready || !userEmail) {
      setVisible(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const code = await getUserCurrency(userEmail);
        if (cancelled) return;
        // Saved on the account: use it on this phone too, no question.
        if (code && (await applyAccountCurrency(code))) return;
        if (!cancelled) {
          setPicked(null);
          setSearch('');
          setVisible(true);
        }
      } catch (e) {
        // Profile unreadable (offline, nothing cached): don't ask now; it is
        // checked again on the next start or sign-in.
        console.warn('Currency check failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, userEmail]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [search]);

  const confirm = () => {
    if (!picked) return;
    setVisible(false);
    setManualCurrency(picked).catch(e => console.warn('Saving currency failed', e));
    saveUserCurrency(userEmail, picked.code).catch(e => console.warn('Saving currency to account failed', e));
  };

  const accentFg = th.isDark ? accent.light : accent.primary;
  const tint = th.isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08);
  const fieldBg = th.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB';
  const symbolBg = th.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';

  const renderItem = ({ item }) => {
    const selected = picked?.code === item.code;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setPicked(item)}
        style={[styles.row, selected && { backgroundColor: tint }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.name}, ${item.code}`}
      >
        <View style={[styles.symbolWell, { backgroundColor: selected ? accent.primary : symbolBg }]}>
          <Text
            style={[styles.symbol, { color: selected ? '#FFFFFF' : th.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {item.symbol}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: th.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.code, { color: th.textMuted }]}>{item.code}</Text>
        </View>
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: accent.primary, borderColor: accent.primary }
              : { borderColor: th.border },
          ]}
        >
          {selected && <CheckIcon color="#FFFFFF" />}
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
      style={styles.modal}
    >
      <View style={[styles.sheet, { backgroundColor: th.surface }]}>
        <View style={styles.header}>
          <View style={[styles.iconWell, { backgroundColor: tint }]}>
            <Currency width={26} height={26} color={accentFg} />
          </View>
          <Text style={[styles.title, { color: th.text }]}>{t('cur.chooseTitle')}</Text>
          <Text style={[styles.subtitle, { color: th.textMuted }]}>{t('cur.chooseSub')}</Text>
        </View>

        <View style={[styles.search, { backgroundColor: fieldBg }]}>
          <SearchIcon color={th.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('cur.search')}
            placeholderTextColor={th.placeholder}
            accessibilityLabel={t('cur.search')}
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
            <Text style={[styles.empty, { color: th.textMuted }]}>{t('cur.none')}</Text>
          }
        />

        <View style={[styles.footer, { borderTopColor: th.border }]}>
          <PrimaryButton
            title={picked ? t('cur.continue', { 0: `${picked.symbol} ${picked.code}` }) : t('cur.chooseTitle')}
            onPress={confirm}
            disabled={!picked}
          />
        </View>
      </View>
    </Modal>
  );
};

export default FirstCurrencyPrompt;

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    overflow: 'hidden',
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
  symbolWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  symbol: { fontFamily: Typography.font.medium, fontSize: 17, fontWeight: '600' },
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
