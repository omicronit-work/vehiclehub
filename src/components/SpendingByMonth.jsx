import React, { useEffect, useRef } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SectionLabel, useSchedulePalette } from './schedule/ScheduleParts';
import Arrow from '../assets/svg/Arrow.jsx';
import { FUEL_COLORS, SERVICE_COLOR } from '../util/runningCost';
import { resolveServiceType, serviceLabel } from '../util/serviceFields';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_AREA = 220;

const shortDay = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDay = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const rangeShort = ({ start, end }) =>
  new Date(start).getFullYear() === new Date(end).getFullYear()
    ? `${shortDay(start)} to ${longDay(end)}`
    : `${longDay(start)} to ${longDay(end)}`;

const serviceName = name => {
  const type = resolveServiceType(name);
  return (type ? serviceLabel(type.name) : String(name || '').trim()) || 'Service';
};

// "24", "12.5", "1,204.3": one decimal at most, grouped like money.
const formatQuantity = q => q.toLocaleString('en-US', { maximumFractionDigits: 1 });

const monthsWord = m => {
  const n = Math.round(m);
  return Math.abs(m - n) < 0.05 ? `${n} month${n === 1 ? '' : 's'}` : `${m.toFixed(1)} months`;
};

/**
 * Spec screen 2, shown inside the Dashboard tab (Dashboard swaps its content
 * for this; the app header and tab bar stay): the period's spending by
 * calendar month (fuel and services stacked; the bars add up to "Total
 * spent"), then where it went. `money(value, decimals)` formats a stored
 * amount for display. Back, or Android back, returns to the Dashboard.
 */
// `active`: the Dashboard tab is on screen (Android back only applies then).
const SpendingByMonth = ({ onBack, active = true, result: r, vehicleName, money, c }) => {
  const p = useSchedulePalette();
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
              `services ${money(m.service)}`,
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
          accessibilityLabel="Back to Dashboard"
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <Arrow color={c.link} style={styles.backChevron} />
          <Text style={[styles.backText, { color: c.link }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.titleText }]} accessibilityRole="header">Spending</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.total, { color: p.text }]} accessibilityRole="header">
          {money(r.totalSpent)}
          <Text style={[styles.totalUnit, { color: p.muted }]}> spent in {monthsWord(r.months)}</Text>
        </Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          {[`About ${money(r.perMonth)} a month`, r.range && rangeShort(r.range)].filter(Boolean).join(' · ')}
          {vehicleName || fuelTypeNames ? `\n${[vehicleName, fuelTypeNames].filter(Boolean).join(' · ')}` : ''}
        </Text>

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
            <Text style={[styles.empty, { color: p.muted }]}>Nothing spent in this period yet.</Text>
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
                <Text style={[styles.legendText, { color: p.muted }]}>Fuel</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: SERVICE_COLOR }]} />
              <Text style={[styles.legendText, { color: p.muted }]}>Services</Text>
            </View>
          </View>
        </View>

        <SectionLabel style={styles.section}>WHERE IT WENT</SectionLabel>
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
                    `${t.count} fill-up${t.count === 1 ? '' : 's'}`,
                    t.quantity > 0 && `${formatQuantity(t.quantity)} ${t.unit}`,
                  ].filter(Boolean).join(' · ')}
                </Text>
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
                {s.hasCost ? money(s.cost) : 'No cost'}
              </Text>
            </View>
          ))}
          {r.fuelLogCount === 0 && r.servicesInPeriod.length === 0 && (
            <Text style={[styles.empty, styles.emptyList, { color: p.muted }]}>
              No fuel logs or services in this period. Log a fill-up to see which fuel this vehicle uses.
            </Text>
          )}
        </View>

        {r.enoughData && r.startCost > 0 && (
          <Text style={[styles.foot, { color: p.muted }]}>
            Spending counts every log. The per-km figure on the Dashboard leaves out the first fuel log (
            {money(r.startCost)}), so the two totals differ.
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default SpendingByMonth;

const styles = StyleSheet.create({
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
