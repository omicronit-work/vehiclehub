import React, { useEffect, useRef } from 'react';
import { BackHandler, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './ui/AppText';
import CurrencyNotice from './ui/CurrencyNotice';
import { useAppTheme } from '../theme/useAppTheme';
import { SectionLabel, useSchedulePalette } from './schedule/ScheduleParts';
import Arrow from '../assets/svg/Arrow.jsx';
import { FUEL_COLORS, SERVICE_COLOR } from '../util/runningCost';
import { resolveServiceType, serviceLabel } from '../util/serviceFields';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import { t as tr } from '../i18n';
import { monthNames } from '../i18n';
import { localDate } from '../i18n';

const MONTHS = monthNames('short');
const BAR_AREA = 220;

const shortDay = ms => localDate(new Date(ms), { day: 'numeric', month: 'short' });
const longDay = ms => localDate(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' });
const rangeShort = ({ start, end }) =>
  new Date(start).getFullYear() === new Date(end).getFullYear()
    ? `${shortDay(start)} – ${longDay(end)}`
    : `${longDay(start)} – ${longDay(end)}`;

const serviceName = name => {
  const type = resolveServiceType(name);
  return (type ? serviceLabel(type.name) : String(name || '').trim()) || tr('Service');
};

// "24", "12.5", "1,204.3": one decimal at most, grouped like money.
const formatQuantity = q => q.toLocaleString('en-US', { maximumFractionDigits: 1 });

const monthsWord = m => {
  const n = Math.round(m);
  return Math.abs(m - n) < 0.05 ? (n === 1 ? tr('1 month') : tr('{0} months', { 0: n })) : tr('{0} months', { 0: m.toFixed(1) });
};

/**
 * Spec screen 2, shown inside the Dashboard tab (Dashboard swaps its content
 * for this; the app header and tab bar stay): the period's spending by
 * calendar month (fuel and services stacked; the bars add up to "Total
 * spent"), then where it went. `money(value, decimals)` formats a stored
 * amount for display. Back, or Android back, returns to the Dashboard.
 */
// `active`: the Dashboard tab is on screen (Android back only applies then).
// `others` / `otherDetail`: records saved in another currency (in no figure
// here, never converted), from otherCurrencySpent / otherCurrencyDetail.
// `otherMoney(o)` formats an amount in o's currency; `currencyLabel` is the
// selected one ("¥ JPY").
const NO_OTHERS = { byFuel: {}, services: [] };
const SpendingByMonth = ({
  onBack, active = true, result: r, vehicleName, money, c,
  others = [], otherDetail = NO_OTHERS, otherMoney, currencyLabel = '',
}) => {
  const p = useSchedulePalette();
  const { isDark } = useAppTheme();
  const warn = isDark ? '#FFD180' : '#A66200';
  const otherCount = others.reduce((n, o) => n + o.count, 0);
  const otherServices = otherMoney ? otherDetail.services : [];
  // "฿ 12,000.00 + RM 300.00": what a fuel type cost in other currencies.
  const fuelOthers = name => (otherMoney ? (otherDetail.byFuel[name] || []) : [])
    .map(o => otherMoney(o)(o.total)).join(' + ');
  const chartScroll = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, active]);
  const card = [styles.card, shadowSoft(1.5), { backgroundColor: c.cardBg }];
  // One colour per fuel type, biggest spend first; the first is the accent.
  const fuelTypes = r.fuelBreakdown.map((t, i) => ({
    ...t,
    color: i === 0 ? c.line : FUEL_COLORS[i % FUEL_COLORS.length],
  }));
  const peak = Math.max(0, ...r.monthly.map(m => m.fuel + m.service));
  const multiYear = r.monthly.length > 0 && r.monthly[0].year !== r.monthly[r.monthly.length - 1].year;
  const monthName = m => `${MONTHS[m.month]}${multiYear ? ` ${String(m.year).slice(2)}` : ''}`;
  // Long periods ('All') scroll sideways so bars stay readable.
  const wide = r.monthly.length > 6;
  const plain = v => money(v, 0).replace(/^[^\d-]+/, ''); // bar labels: whole number only

  const bars = (
    <View style={[styles.bars, wide && { width: r.monthly.length * 64 }]}>
      {r.monthly.map(m => {
        const total = m.fuel + m.service;
        const h = peak > 0 ? (total / peak) * (BAR_AREA - 28) : 0;
        return (
          <View
            key={`${m.year}-${m.month}`}
            style={styles.barCol}
            accessible
            accessibilityLabel={`${MONTHS[m.month]} ${m.year}: ${money(total)}. ${[
              ...fuelTypes.filter(t => m.byFuel[t.name]).map(t => `${t.name} ${money(m.byFuel[t.name])}`),
              tr('services {0}', { 0: money(m.service) }),
            ].join(', ')}`}
          >
            <View style={[styles.barArea, { height: BAR_AREA }]}>
              {total > 0 && <Text style={[styles.barValue, { color: p.text }]}>{plain(total)}</Text>}
              <View style={[styles.bar, { height: Math.max(h, total > 0 ? 3 : 0) }]}>
                <View style={{ flex: m.service, backgroundColor: SERVICE_COLOR }} />
                {/* Fuel types stacked under services, the biggest at the bottom. */}
                {[...fuelTypes].reverse().map(t => (
                  <View key={t.name} style={{ flex: m.byFuel[t.name] || 0, backgroundColor: t.color }} />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
  const labels = (
    <View style={[styles.labelsRow, { borderTopColor: p.cardBorder }, wide && { width: r.monthly.length * 64 }]}>
      {r.monthly.map(m => (
        <Text key={`${m.year}-${m.month}`} style={[styles.barLabel, { color: p.muted }]} numberOfLines={1}>
          {monthName(m)}
        </Text>
      ))}
    </View>
  );

  // Fuel type comes from the fill-ups (vehicles don't store one).
  const fuelTypeNames = r.fuelNames.join(', ');

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tr('Back to Dashboard')}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <Arrow color={c.link} style={styles.backChevron} />
          <Text style={[styles.backText, { color: c.link }]}>{tr('Back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.titleText }]} accessibilityRole="header">{tr('Spending')}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.total, { color: p.text }]} accessibilityRole="header">
          {money(r.totalSpent)}
          <Text style={[styles.totalUnit, { color: p.muted }]}>{' '}{tr('spent in {0}', { 0: monthsWord(r.months) })}</Text>
        </Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          {[tr('About {0} a month', { 0: money(r.perMonth) }), r.range && rangeShort(r.range)].filter(Boolean).join(' · ')}
          {vehicleName || fuelTypeNames ? `\n${[vehicleName, fuelTypeNames].filter(Boolean).join(' · ')}` : ''}
        </Text>

        {otherCount > 0 && otherMoney && (
          <CurrencyNotice
            style={styles.notice}
            title={otherCount === 1
              ? tr('1 record in this period is in another currency')
              : tr('{0} records in this period are in another currency', { 0: otherCount })}
            message={[
              ...others.map(o => tr('{0}: fuel {1} + services {2}', {
                0: o.code,
                1: otherMoney(o)(o.fuel),
                2: otherMoney(o)(o.service),
              })),
              tr('Not counted in the totals above. Edit them to enter their amounts in {0}.', { 0: currencyLabel }),
            ].join('\n')}
          />
        )}

        <View style={card}>
          {peak > 0 ? (
            wide ? (
              // Opens on the latest month: recent spending is what you came for,
              // and starting at the oldest month hid every bar off-screen.
              <ScrollView
                ref={chartScroll}
                horizontal
                showsHorizontalScrollIndicator
                onContentSizeChange={() => chartScroll.current?.scrollToEnd({ animated: false })}
              >
                <View>
                  {bars}
                  {labels}
                </View>
              </ScrollView>
            ) : (
              <>
                {bars}
                {labels}
              </>
            )
          ) : (
            <Text style={[styles.empty, { color: otherCount > 0 ? warn : p.muted }]}>
              {otherCount > 0
                ? tr('Nothing spent in {0} in this period. The amounts are in another currency (see above).', { 0: currencyLabel })
                : tr('Nothing spent in this period yet.')}
            </Text>
          )}
          <View style={styles.legend}>
            {fuelTypes.length > 0 ? (
              fuelTypes.map(t => (
                <View key={t.name} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: t.color }]} />
                  <Text style={[styles.legendText, { color: p.muted }]}>{t.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: c.line }]} />
                <Text style={[styles.legendText, { color: p.muted }]}>{tr('Fuel')}</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: SERVICE_COLOR }]} />
              <Text style={[styles.legendText, { color: p.muted }]}>{tr('Services')}</Text>
            </View>
          </View>
        </View>

        <SectionLabel style={styles.section}>{tr('WHERE IT WENT')}</SectionLabel>
        <View style={[styles.list, shadowSoft(1.5), { backgroundColor: c.cardBg }]}>
          {/* One row per fuel type, coloured like its part of the bars. */}
          {fuelTypes.map((t, i) => (
            <View
              key={t.name}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.cardBorder }]}
            >
              <View style={[styles.rowDot, { backgroundColor: t.color }]} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: p.text }]}>{t.name}</Text>
                <Text style={[styles.rowSub, { color: p.muted }]}>
                  {[
                    (t.count === 1 ? tr('1 fill-up') : tr('{0} fill-ups', { 0: t.count })),
                    t.quantity > 0 && `${formatQuantity(t.quantity)} ${t.unit}`,
                  ].filter(Boolean).join(' · ')}
                </Text>
                {!!fuelOthers(t.name) && (
                  <Text style={[styles.rowSub, { color: warn }]}>
                    {tr('{0} in another currency, not counted', { 0: fuelOthers(t.name) })}
                  </Text>
                )}
              </View>
              <Text style={[styles.rowValue, { color: p.text }]}>{money(t.spent)}</Text>
            </View>
          ))}
          {r.servicesInPeriod.map((s, i) => (
            <View
              key={`${s.ms}-${i}`}
              style={[styles.row, (i > 0 || r.fuelLogCount > 0) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.cardBorder }]}
            >
              <View style={[styles.rowDot, { backgroundColor: SERVICE_COLOR }]} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: p.text }]}>{serviceName(s.name)}</Text>
                <Text style={[styles.rowSub, { color: p.muted }]}>{longDay(s.ms)}</Text>
              </View>
              <Text style={[styles.rowValue, { color: s.hasCost ? p.text : p.muted }]}>
                {s.hasCost ? money(s.cost) : tr('No cost')}
              </Text>
            </View>
          ))}
          {/* Services saved in another currency: their amount in the amber line. */}
          {otherServices.map((s, i) => (
            <View
              key={`other-${s.ms}-${i}`}
              style={[styles.row, (i > 0 || r.fuelLogCount > 0 || r.servicesInPeriod.length > 0) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.cardBorder }]}
            >
              <View style={[styles.rowDot, { backgroundColor: SERVICE_COLOR }]} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: p.text }]}>{serviceName(s.name)}</Text>
                <Text style={[styles.rowSub, { color: p.muted }]}>{longDay(s.ms)}</Text>
                {s.hasCost && (
                  <Text style={[styles.rowSub, { color: warn }]}>
                    {tr('{0} in another currency, not counted', { 0: otherMoney(s)(s.cost) })}
                  </Text>
                )}
              </View>
              {/* Same as the fuel rows: nothing counted in the selected currency. */}
              <Text style={[styles.rowValue, { color: s.hasCost ? p.text : p.muted }]}>
                {s.hasCost ? money(0) : tr('No cost')}
              </Text>
            </View>
          ))}
          {r.fuelLogCount === 0 && r.servicesInPeriod.length === 0 && otherServices.length === 0 && (
            <Text style={[styles.empty, styles.emptyList, { color: p.muted }]}>
              {tr('No fuel logs or services in this period. Log a fill-up to see which fuel this vehicle uses.')}
            </Text>
          )}
        </View>

        {r.enoughData && r.startCost > 0 && (
          <Text style={[styles.foot, { color: p.muted }]}>
            {tr('Spending counts every log. The per-km figure on the Dashboard leaves out the first fuel log ({0}), so the two totals differ.', { 0: money(r.startCost) })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default SpendingByMonth;

const styles = StyleSheet.create({
  notice: { marginTop: 14, marginBottom: 0 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: -14 },
  backButton: { minHeight: MIN_TOUCH, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backChevron: { transform: [{ rotate: '180deg' }] },
  backText: { fontFamily: 'RobotoCondensed500', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontFamily: 'RobotoCondensed500', fontWeight: '700', fontSize: 20 },
  // Reaches into the page padding so card shadows aren't clipped.
  scroll: { marginHorizontal: -16 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  total: { fontFamily: 'RobotoCondensed500', fontSize: 44, marginTop: 4 },
  totalUnit: { fontFamily: 'RobotoCondensed400', fontSize: 18 },
  sub: { fontFamily: 'RobotoCondensed400', fontSize: 15, lineHeight: 21, marginTop: 6 },
  card: { borderRadius: 18, padding: 16, marginTop: 18 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  barArea: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontFamily: 'RobotoCondensed500', fontSize: 14, marginBottom: 6 },
  bar: { width: '58%', borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: 'hidden' },
  labelsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  barLabel: { flex: 1, textAlign: 'center', fontFamily: 'RobotoCondensed400', fontSize: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8, marginTop: 14 },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  legendText: { fontFamily: 'RobotoCondensed400', fontSize: 15 },
  empty: { fontFamily: 'RobotoCondensed400', fontSize: 14, paddingVertical: 12 },
  emptyList: { paddingHorizontal: 16, lineHeight: 20 },
  section: { marginTop: 22 },
  list: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 16, paddingVertical: 10 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: 'RobotoCondensed500', fontSize: 17 },
  rowSub: { fontFamily: 'RobotoCondensed400', fontSize: 14, marginTop: 2 },
  rowValue: { fontFamily: 'RobotoCondensed500', fontSize: 17 },
  foot: { fontFamily: 'RobotoCondensed400', fontSize: 14, lineHeight: 20, marginTop: 14 },
});
