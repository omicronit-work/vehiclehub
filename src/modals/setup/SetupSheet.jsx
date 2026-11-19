import React, { useContext, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaInsetsContext, initialWindowMetrics } from 'react-native-safe-area-context';
import Text from '../../components/ui/AppText';
import PrimaryButton from '../../components/ui/PrimaryButton';
import Currency from '../../assets/svg/Currency.jsx';
import { Typography } from '../../styles/typography.js';
import { useAppTheme } from '../../theme/useAppTheme';
import { accent } from '../../theme/accent';
import { LANGUAGES, languageInfo } from '../../i18n/languages';
import { COUNTRIES, findCountry } from '../../util/countries';
import { findCurrency, getCurrencies, useCurrencies } from '../../util/currencies';
import { useHideAdsWhile } from '../../util/ads';
import { t, useLanguage } from '../../i18n';

const LanguageIcon = ({ color }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <Path d="M4 5h9M8.5 3v2M6 5c.6 3.6 3 6.4 6 8M11 5c-.6 3.4-3 6.6-7 8.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12.5 21l4-9.5 4 9.5M14 17.5h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

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

const BackIcon = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const matches = (q, ...values) => values.some(v => String(v || '').toLowerCase().includes(q));

// What each step shows. Rows: { key, title, sub, badge, translateTitle }.
const STEP_VIEW = {
  language: {
    Icon: LanguageIcon,
    title: () => t('Choose your language'),
    subtitle: () => t('The app is shown in this language. You can change it any time in Settings.'),
    // Each language in its own script (never translated), so people find theirs.
    rows: () => LANGUAGES.map(l => ({ key: l.code, title: l.native, sub: l.native !== l.name ? l.name : null, own: true })),
    continueLabel: code => t('Continue with {0}', { 0: languageInfo(code).native }),
  },
  country: {
    Icon: GlobeIcon,
    title: () => t('Choose your country'),
    subtitle: () => t('Fuel types and vehicle documents are shown for this country. You can change it any time in Settings.'),
    search: () => t('Search country...'),
    empty: () => t('No country found'),
    rows: q => COUNTRIES
      .filter(c => !q || matches(q, t(c.name), c.name, c.code))
      .map(c => ({ key: c.code, title: t(c.name), sub: c.code, badge: c.flag, emoji: true })),
    continueLabel: code => {
      const c = findCountry(code);
      return t('Continue with {0}', { 0: `${c.flag} ${t(c.name)}` });
    },
  },
  currency: {
    Icon: ({ color }) => <Currency width={26} height={26} color={color} />,
    title: () => t('cur.chooseTitle'),
    subtitle: () => t('cur.chooseSub'),
    search: () => t('cur.search'),
    empty: () => t('cur.none'),
    rows: q => getCurrencies()
      .filter(c => !q || matches(q, t(c.name), c.name, c.code, c.symbol))
      .map(c => ({ key: c.code, title: t(c.name), sub: c.code, badge: c.symbol })),
    continueLabel: code => {
      const c = findCurrency(code);
      return t('cur.continue', { 0: c ? `${c.symbol} ${c.code}` : code });
    },
  },
};

/**
 * First-run setup in one sheet: the `steps` still to ask (some of
 * 'language' → 'country' → 'currency'), one after another inside the same
 * sheet, with Back between them. It can't be dismissed.
 *
 *   initial     { language } pre-picked on the language step; country and
 *               currency start with nothing picked
 *   onLanguage  a language was tapped (the app switches to it at once)
 *   onFinish    { language, country, currency } once the last step is
 *               confirmed; the sheet then closes
 *   onHidden    the sheet has finished closing
 */
const SetupSheet = ({ visible, steps, initial, onLanguage, onFinish, onHidden }) => {
  const th = useAppTheme();
  useLanguage(); // re-render in a language picked on the first step
  // Shown above the navigator (App.jsx), outside its safe-area provider.
  const insets = useContext(SafeAreaInsetsContext) ?? initialWindowMetrics?.insets ?? { bottom: 0 };
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState({});
  const [search, setSearch] = useState('');
  useHideAdsWhile(visible);
  // The currency step lists the database's currencies; re-render when they load.
  useCurrencies(visible && steps.includes('currency'));

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setSearch('');
    setPicks({ language: initial?.language || null, country: null, currency: null });
  }, [visible, initial]);

  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const view = STEP_VIEW[step];
  const picked = picks[step];
  const isLast = index >= steps.length - 1;
  const q = search.trim().toLowerCase();
  const rows = view.rows(q);
  const tall = steps.some(s => s !== 'language');

  const accentFg = th.isDark ? accent.light : accent.primary;
  const tint = th.isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08);
  const fieldBg = th.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB';
  const badgeBg = th.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';

  const pick = key => {
    setPicks(prev => ({ ...prev, [step]: key }));
    if (step === 'language') onLanguage?.(key);
  };

  const goTo = next => {
    setIndex(next);
    setSearch('');
  };

  const next = () => {
    if (!picked) return;
    if (isLast) onFinish?.(picks);
    else goTo(index + 1);
  };

  const back = () => {
    if (index > 0) goTo(index - 1);
  };

  const renderItem = ({ item }) => {
    const selected = picked === item.key;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => pick(item.key)}
        style={[styles.row, selected && { backgroundColor: tint }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={item.sub ? `${item.title}, ${item.sub}` : item.title}
      >
        {item.badge != null && (
          <View
            style={[
              styles.badge,
              { backgroundColor: selected ? (item.emoji ? accent.alpha(0.18) : accent.primary) : badgeBg },
            ]}
          >
            <Text
              translate={false}
              style={[item.emoji ? styles.flag : styles.symbol, { color: selected ? '#FFFFFF' : th.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.badge}
            </Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text translate={item.own ? false : undefined} style={[styles.name, { color: th.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {!!item.sub && (
            <Text translate={item.own ? false : undefined} style={[styles.sub, { color: th.textMuted }]}>{item.sub}</Text>
          )}
        </View>
        <View
          style={[
            styles.radio,
            selected ? { backgroundColor: accent.primary, borderColor: accent.primary } : { borderColor: th.border },
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
      onBackButtonPress={back}
      onModalHide={onHidden}
      style={styles.modal}
    >
      <View
        style={[
          styles.sheet,
          tall && styles.sheetTall,
          { backgroundColor: th.surface, paddingBottom: 16 + (insets?.bottom || 0) },
        ]}
      >
        {steps.length > 1 && (
          <View style={styles.topBar}>
            {index > 0 ? (
              <TouchableOpacity
                onPress={back}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={t('Back')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <BackIcon color={accentFg} />
                <Text style={[styles.backText, { color: accentFg }]}>{t('Back')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <View style={styles.dots} accessibilityLabel={t('Step {0} of {1}', { 0: index + 1, 1: steps.length })}>
              {steps.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    { backgroundColor: i <= index ? accent.primary : th.border },
                    i === index && styles.dotCurrent,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.stepText, { color: th.textMuted }]}>
              {t('Step {0} of {1}', { 0: index + 1, 1: steps.length })}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={[styles.iconWell, { backgroundColor: tint }]}>
            <view.Icon color={accentFg} />
          </View>
          <Text style={[styles.title, { color: th.text }]}>{view.title()}</Text>
          <Text style={[styles.subtitle, { color: th.textMuted }]}>{view.subtitle()}</Text>
        </View>

        {view.search && (
          <View style={[styles.search, { backgroundColor: fieldBg }]}>
            <SearchIcon color={th.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={view.search()}
              placeholderTextColor={th.placeholder}
              accessibilityLabel={view.search()}
              style={[styles.searchInput, { color: th.text }]}
              autoCorrect={false}
            />
          </View>
        )}

        <FlatList
          key={step}
          data={rows}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          extraData={picked}
          style={tall ? styles.listTall : null}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            view.empty ? <Text style={[styles.empty, { color: th.textMuted }]}>{view.empty()}</Text> : null
          }
        />

        <View style={[styles.footer, { borderTopColor: th.border }]}>
          <PrimaryButton
            title={!picked ? view.title() : isLast ? view.continueLabel(picked) : t('Next')}
            onPress={next}
            disabled={!picked}
          />
        </View>
      </View>
    </Modal>
  );
};

export default SetupSheet;

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    overflow: 'hidden',
  },
  // Same height on every step, so the sheet doesn't jump between them.
  sheetTall: { height: '88%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    minHeight: 28,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 72 },
  backText: { fontFamily: Typography.font.medium, fontSize: 14 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCurrent: { width: 20 },
  stepText: { fontFamily: Typography.font.regular, fontSize: 12, minWidth: 72, textAlign: 'right' },
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
  listTall: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
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
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  flag: { fontSize: 22 },
  symbol: { fontFamily: Typography.font.medium, fontSize: 17, fontWeight: '600' },
  rowText: { flex: 1 },
  name: { fontFamily: Typography.font.medium, fontSize: Typography.textsize.small },
  sub: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 2 },
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
