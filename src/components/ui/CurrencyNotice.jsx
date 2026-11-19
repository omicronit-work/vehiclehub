import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../../theme/useAppTheme';
import { Typography } from '../../styles/typography';
import { t as tr } from '../../i18n';
import { currentCurrency, formatMoney, isInCurrentCurrency, recordCurrencyInfo, symbolFor } from '../../util/methods/useCurrency';

// Amber warning box for records saved in another currency than the one
// selected in Settings (edit forms, vehicle overview).
const CurrencyNotice = ({ title, message, style }) => {
  const { isDark } = useAppTheme();
  const text = isDark ? '#FFD180' : '#A66200';
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.wrap,
        { backgroundColor: isDark ? 'rgba(245,165,36,0.16)' : 'rgba(245,165,36,0.10)' },
        style,
      ]}
    >
      <View style={styles.bar} />
      <View style={styles.body}>
        {!!title && <Text style={[styles.title, { color: text }]}>{title}</Text>}
        {!!message && <Text style={[styles.message, { color: text }]}>{message}</Text>}
      </View>
    </View>
  );
};

export default CurrencyNotice;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  bar: { width: 4, backgroundColor: '#F5A524' },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  title: { fontFamily: Typography.font.medium, fontSize: 14 },
  message: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
});

/**
 * Warning at the top of a vehicle's records when some cost records (services,
 * fuel logs) were saved in another currency than the one selected now.
 * Renders nothing when there are none. Pass the selected currency's code so
 * it updates when the currency changes.
 */
export const OtherCurrencyWarning = ({ records, currencyCode, style }) => {
  const others = (records || []).filter(r => !isInCurrentCurrency(r));
  if (!others.length) return null;
  const labels = [...new Set(others.map(r => {
    const info = recordCurrencyInfo(r);
    return `${info.symbol} ${info.code}`.trim();
  }))].join(', ');
  return (
    <CurrencyNotice
      style={style}
      title={others.length === 1
        ? tr('1 cost record is in another currency ({0})', { 0: labels })
        : tr('{0} cost records are in another currency ({1})', { 0: others.length, 1: labels })}
      message={tr('They are left out of cost totals. Edit each one and update its amount to {0} {1}.', { 0: symbolFor(currencyCode), 1: currencyCode })}
    />
  );
};

/**
 * Warning on a record's detail view when its amounts were saved in another
 * currency than the one selected now: they are shown in their own currency,
 * left out of cost totals, and updated by editing the record. Renders nothing
 * for a record in the selected currency, or one with no amounts.
 * Lists the saved amounts with their currency; `unit` (fuel logs: 'L', 'kg',
 * 'kWh') labels the price per unit.
 */
export const RecordCurrencyNotice = ({ record, unit = 'L', style }) => {
  const hasAmount = Number(record?.totalCost) > 0 || Number(record?.pricePerLiter) > 0;
  if (!record || !hasAmount || isInCurrentCurrency(record)) return null;
  const saved = recordCurrencyInfo(record);
  const now = currentCurrency();
  return (
    <CurrencyNotice
      style={style}
      title={tr('Saved in another currency ({0} {1})', { 0: saved.symbol, 1: saved.code })}
      message={[
        Number(record.totalCost) > 0
          ? tr('Total cost: {0}', { 0: `${formatMoney(record.totalCost, saved.symbol)} ${saved.code}` }) : null,
        Number(record.pricePerLiter) > 0
          ? tr('Price / {0}: {1}', { 0: unit, 1: `${formatMoney(record.pricePerLiter, saved.symbol)} ${saved.code}` }) : null,
        tr('Not counted in cost totals. Edit it to enter the amount in {0} {1}.', { 0: now.symbol, 1: now.code }),
      ].filter(Boolean).join('\n')}
    />
  );
};
