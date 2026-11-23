import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './ui/AppText';
import { useSelector } from 'react-redux';
import { shadowSoft } from '../theme/tokens';
import { accent } from '../theme/accent';
import { themecolors } from '../styles/themecolors.js';
import EditIcon from '../assets/svg/EditIcon.jsx';
import TrashIcon from '../assets/svg/TrashIcon.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';
import { fuelBadge, fuelUnit } from '../util/fuelEfficiency.js';
import { fuelDisplayName } from '../util/fuelTypes';
import { currentCurrency, formatMoney, isInCurrentCurrency } from '../util/methods/useCurrency';
import { localNumber, t as tr } from '../i18n';

const cardShadow = shadowSoft(1.5);

/**
 * One fuel log row — shared by Home's Fuel tab and the vehicle detail Fuel
 * tab so a fill-up looks the same on both screens. Kept to the fuel, the
 * amount paid, the quantity and the mileage (economy); everything else is in
 * the details view.
 */
const FuelLogCard = ({ item, money, distUnit, selected, busy, onPress, onEdit, onDelete }) => {
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  const c = useMemo(
    () => ({
      cardBg: isDark ? 'rgba(4, 25, 51, 1)' : '#fff',
      cardBorder: isDark ? accent.lightAlpha(0.20) : 'rgba(15,31,61,0.06)',
      selectedBorder: accent.primary,
      text: isDark ? themecolors.white : '#0F1F3D',
      muted: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
      editBg: isDark ? accent.lightAlpha(0.16) : accent.tint,
      deleteBg: isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA',
      deleteIcon: isDark ? '#FF9C90' : '#C62828',
      // An amount saved in another currency than the selected one.
      warning: isDark ? '#FFD180' : '#A66200',
      success: {
        text: isDark ? '#9CE6B0' : '#15803D',
        bg: isDark ? 'rgba(43,170,109,0.16)' : '#E6F6EC',
        well: isDark ? 'rgba(43,170,109,0.16)' : '#E9F7EF',
      },
      neutral: {
        text: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
        bg: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
        well: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
      },
    }),
    [isDark],
  );

  const title = fuelDisplayName(item);
  const qty = Number(item.liters) || 0;
  const qtyText = qty > 0 ? `${localNumber(qty, { maximumFractionDigits: 2 })} ${fuelUnit(item.fuelType)}` : null;
  // Saved in another currency: 0 in the selected currency (it counts for
  // nothing until edited), then the old amount with its own symbol, in the
  // warning colour.
  const otherCurrency = !isInCurrentCurrency(item);
  const oldAmount = otherCurrency && Number(item.totalCost) > 0 ? money(item.totalCost) : null;
  const zeroAmount = otherCurrency ? formatMoney(0, currentCurrency().symbol) : null;
  const amountLine = otherCurrency
    ? [zeroAmount, oldAmount, qtyText].filter(Boolean).join(' · ')
    : [Number(item.totalCost) > 0 ? money(item.totalCost) : null, qtyText].filter(Boolean).join(' · ');
  const tone = item.efficiency != null ? c.success : c.neutral;
  const badge = fuelBadge(item, distUnit);
  const a11yLabel = [title, amountLine, badge].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={tr('Opens details')}
      accessibilityState={{ selected: !!selected, busy: !!busy }}
      onPress={onPress}
      style={[
        styles.card,
        cardShadow,
        {
          opacity: busy ? 0.5 : 1,
          backgroundColor: c.cardBg,
          borderColor: selected ? c.selectedBorder : c.cardBorder,
        },
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: tone.well }]}>
        <FuelIcon color={tone.text} size={22} />
      </View>

      <View style={styles.textBlock}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>
          {title}
        </Text>
        {otherCurrency ? (
          <Text numberOfLines={2} style={[styles.date, { color: c.muted }]}>
            {zeroAmount}
            {!!oldAmount && (
              <>
                {' · '}
                <Text style={{ color: c.warning }}>{oldAmount}</Text>
              </>
            )}
            {qtyText ? ` · ${qtyText}` : ''}
          </Text>
        ) : !!amountLine && (
          <Text numberOfLines={2} style={[styles.date, { color: c.muted }]}>
            {amountLine}
          </Text>
        )}
        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.5} style={[styles.statusText, { color: tone.text }]}>
            {badge}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={onEdit}
          disabled={busy}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={tr('Edit {0}', { 0: title })}
          style={[styles.actionButton, { backgroundColor: c.editBg }]}
        >
          <EditIcon />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          disabled={busy}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={tr('Delete {0}', { 0: title })}
          style={[styles.actionButton, { backgroundColor: c.deleteBg }]}
        >
          <TrashIcon color={c.deleteIcon} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(FuelLogCard);

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Amount and badge wrap to a second line rather than cut off: Thai and
  // other longer unit words don't fit one line on narrow phones.
  textBlock: {
    gap: 3,
    flex: 1,
    minWidth: 0, // long titles truncate instead of pushing the actions off-screen
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  date: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
  statusBadge: {
    marginTop: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: '100%',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'RobotoCondensed400',
    flexShrink: 1,
  },
  // 44pt targets, spaced apart so Delete isn't hit when aiming for Edit.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
