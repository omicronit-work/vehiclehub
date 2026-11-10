import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVehicleCostRecords } from '../store/userSlice.js';
import { computeRunningCost, perKmParts, PERIODS, roundHalfUp, SERVICE_COLOR } from '../util/runningCost';
import { effToUnit, kmToUnit } from '../util/distance';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import SkeletonBlock from './ui/SkeletonBlock.jsx';
import { symbolFor } from '../util/methods/useCurrency';

const PERIOD_KEY = 'dashboard:runningCostPeriod';
const cardShadow = shadowSoft(1.5);

const dayLabel = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** '1 Jan 2027 to 31 Mar 2027' */
export const rangeLabel = ({ start, end }) => `${dayLabel(start)} to ${dayLabel(end)}`;

/**
 * Money for display, in the app's one format ("৳ 3,960.00", as on every
 * record card), rounded half up. `value` is already in `symbol`'s currency.
 */
export const moneyFormatter = symbol => (value, decimals = 2) =>
  // Non-breaking space: the symbol never wraps away from its number.
  `${symbol}\u00A0${roundHalfUp(value, decimals).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

/**
 * Dashboard (spec screen 1): what one vehicle really costs to run, from the
 * fuel logs and services already saved. Per vehicle; with "All vehicles"
 * selected it asks for one.
 */
// `onOpenByMonth({ result, vehicleName, money })`: the Dashboard shows the
// Spending view in its own tab (components/SpendingByMonth.jsx).
const RunningCostCard = ({ userEmail, vehicleId, vehicleName, refreshKey, currency, currencyReady, distUnit, c, isDark, onOpenByMonth }) => {
  const [period, setPeriod] = useState('year');
  const [records, setRecords] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  // Remember the period chip between visits.
  useEffect(() => {
    AsyncStorage.getItem(PERIOD_KEY)
      .then(v => { if (PERIODS.some(p => p.key === v)) setPeriod(v); })
      .catch(() => {});
  }, []);
  const pickPeriod = key => {
    setPeriod(key);
    AsyncStorage.setItem(PERIOD_KEY, key).catch(() => {});
  };

  useEffect(() => {
    if (!userEmail || !vehicleId || !currencyReady) return;
    let cancelled = false;
    setStatus(s => (records?.vehicleId === vehicleId ? s : 'loading'));
    // Amounts in `currency`: records saved in another currency are converted
    // for these figures only; the saved records never change.
    getVehicleCostRecords(userEmail, vehicleId, { currency })
      .then(res => {
        if (cancelled) return;
        setRecords({ ...res, vehicleId });
        setStatus('ready');
      })
      .catch(e => {
        console.warn('Failed to load running cost', e);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
    // records is only read to keep figures on screen during a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, vehicleId, refreshKey, currency, currencyReady]);

  const result = useMemo(
    () => (records && records.vehicleId === vehicleId
      ? computeRunningCost({ fuelLogs: records.fuelLogs, services: records.services, period })
      : null),
    [records, vehicleId, period],
  );

  const symbol = symbolFor(records?.currency || currency);
  const money = moneyFormatter(symbol);
  const perUnit = distUnit === 'mi' ? 'mile' : 'km';
  const card = [styles.card, cardShadow, { backgroundColor: c.cardBg }];
  const heroBg = isDark ? 'rgba(255,255,255,0.06)' : c.pillBg;

  if (!vehicleId) {
    return (
      <View style={[card, styles.first]}>
        <Text style={[styles.label, { color: c.link }]}>RUNNING COST</Text>
        <Text style={[styles.body, styles.gapSmall, { color: c.muted }]}>
          Running cost is worked out for one vehicle at a time. Pick a vehicle above to see it.
        </Text>
      </View>
    );
  }

  const chips = (
    <View style={[styles.chips, styles.first]} accessibilityRole="tablist">
      {PERIODS.map(p => {
        const on = p.key === period;
        return (
          <Pressable
            key={p.key}
            onPress={() => pickPeriod(p.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: on ? c.link : c.pillBg },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, { color: on ? (isDark ? '#041933' : '#FFFFFF') : c.text }, on && styles.chipOn]}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (status !== 'ready' || !result) {
    return (
      <View>
        {chips}
        <View style={[card, styles.gap]}>
          {status === 'error' ? (
            <Text style={[styles.body, { color: c.muted }]}>Couldn't load the running cost. Pull down to try again.</Text>
          ) : (
            <View accessibilityLabel="Loading running cost">
              <SkeletonBlock width={120} height={12} />
              <SkeletonBlock width={160} height={36} style={styles.gapSmall} />
              <SkeletonBlock width="100%" height={10} borderRadius={5} style={styles.gapSmall} />
            </View>
          )}
        </View>
      </View>
    );
  }

  const r = result;
  const parts = r.enoughData ? perKmParts(r.fuelCost, r.serviceCost, r.kmDriven, 1, distUnit) : null;
  const km = kmToUnit(r.kmDriven, distUnit);
  const economy = r.economy != null ? effToUnit(r.economy, distUnit) : null;
  const notes = [
    records.converted > 0 && {
      text: `${records.converted} ${records.converted === 1 ? 'record was' : 'records were'} saved in another currency and ${records.converted === 1 ? 'is' : 'are'} converted at today's rate for these figures. The records themselves are unchanged.`,
    },
    records.skipped > 0 && {
      warn: true,
      text: `${records.skipped} ${records.skipped === 1 ? 'record' : 'records'} in another currency left out: the exchange rate couldn't be loaded.`,
    },
    r.odometerWarning && { warn: true, text: 'Check your odometer entries: one reading is lower than the one before.' },
    r.servicesWithoutCost > 0 && {
      text: `${r.servicesWithoutCost} ${r.servicesWithoutCost === 1 ? 'service has' : 'services have'} no cost, so ${r.servicesWithoutCost === 1 ? 'it counts' : 'they count'} as 0.`,
    },
  ].filter(Boolean);
  const p2 = v => `${symbol}\u00A0${v.toFixed(2)}`;

  return (
    <View>
      {chips}
      {r.range && (
        <Text style={[styles.caption, styles.rangeLine, { color: c.muted }]}>
          {rangeLabel(r.range)}
          {r.enoughData ? ` · ${km.toLocaleString('en-US')} ${distUnit} driven` : ''}
        </Text>
      )}

      {/* Running cost */}
      <View style={[card, styles.gap, { backgroundColor: heroBg }]}>
        <Text style={[styles.label, { color: c.link }]}>RUNNING COST</Text>
        {parts ? (
          <>
            <Text style={[styles.big, { color: c.text }]} accessibilityLabel={`${p2(parts.total)} per ${perUnit}`}>
              {p2(parts.total)}
              <Text style={[styles.bigUnit, { color: c.muted }]}> per {perUnit}</Text>
            </Text>
            <Text style={[styles.body, { color: c.muted }]}>
              Fuel {p2(parts.fuel)} + services {p2(parts.service)}
            </Text>
            {r.fuelShare != null && (
              <>
                <View style={[styles.shareBar, { backgroundColor: c.donutTrack }]}>
                  <View style={{ flex: r.fuelShare, backgroundColor: c.line }} />
                  <View style={{ flex: 100 - r.fuelShare, backgroundColor: SERVICE_COLOR }} />
                </View>
                <View style={styles.legend}>
                  <Text style={[styles.caption, { color: c.muted }]}>Fuel {r.fuelShare}%</Text>
                  <Text style={[styles.caption, { color: c.muted }]}>Services {100 - r.fuelShare}%</Text>
                </View>
              </>
            )}
          </>
        ) : (
          <Text style={[styles.body, styles.gapSmall, { color: c.text }]}>Add two fuel logs to see your running cost.</Text>
        )}
      </View>

      {/* Fuel economy · Total spent */}
      <View style={styles.tiles}>
        <View style={[card, styles.tile]}>
          <Text style={[styles.caption, { color: c.muted }]}>Fuel economy</Text>
          {economy != null ? (
            <>
              <Text style={[styles.tileValue, { color: c.text }]}>{economy.toFixed(1)}</Text>
              <Text style={[styles.tileHint, { color: c.muted }]}>
                {distUnit === 'mi' ? 'miles' : 'km'} per litre, average
              </Text>
              <Text style={[styles.tileHint, { color: c.muted }]}>
                {r.fuelNames.length > 1 ? 'All fuel types together' : `${r.litresUsed.toFixed(1)} L used`}
              </Text>
            </>
          ) : (
            <Text style={[styles.tileHint, styles.gapSmall, { color: c.muted }]}>
              {r.enoughData && r.nonLitreFuel
                ? 'Shown for fuel sold in litres only.'
                : 'Needs two fuel logs in this period.'}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => onOpenByMonth?.({ result: r, vehicleName, money })}
          accessibilityRole="button"
          accessibilityLabel={`Total spent ${money(r.totalSpent)}. See spending by month`}
          style={({ pressed }) => [card, styles.tile, pressed && styles.pressed]}
        >
          <Text style={[styles.caption, { color: c.muted }]}>Total spent</Text>
          <Text style={[styles.tileValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(r.totalSpent)}
          </Text>
          <Text style={[styles.tileHint, { color: c.muted }]} numberOfLines={1}>Fuel {money(r.fuelSpent)}</Text>
          <Text style={[styles.tileHint, { color: c.muted }]} numberOfLines={1}>Services {money(r.serviceSpent)}</Text>
          <Text style={[styles.tileLink, { color: c.link }]}>By month ›</Text>
        </Pressable>
      </View>

      {/* How this is worked out */}
      <View style={[card, styles.gap]}>
        <Text style={[styles.caption, { color: c.muted }]}>How this is worked out</Text>
        <Text style={[styles.body, styles.gapSmall, { color: c.text }]}>
          {r.enoughData
            ? `The first fuel log is only a starting point, so its ${money(r.startCost)} is left out. Averages use the ${distUnit === 'mi' ? 'miles' : 'km'} you drove between your first and last fuel log.`
            : 'Running cost needs two fuel logs in this period. The first is only a starting point; averages use the distance you drove between the first and the last.'}
        </Text>
        {/* Notes, not errors: amber for a likely typo, muted otherwise. */}
        {notes.map(n => (
          <Text key={n.text} style={[styles.note, { color: n.warn ? '#B45309' : c.muted }]}>{n.text}</Text>
        ))}
      </View>

    </View>
  );
};

export default RunningCostCard;

const styles = StyleSheet.create({
  first: { marginTop: 14 },
  gap: { marginTop: 14 },
  gapSmall: { marginTop: 8 },
  pressed: { opacity: 0.7 },
  card: { width: '100%', padding: 16, borderRadius: 18 },
  label: { fontFamily: 'RobotoCondensed500', fontSize: 13, letterSpacing: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TOUCH - 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
  },
  chipText: { fontFamily: 'RobotoCondensed400', fontSize: 14 },
  chipOn: { fontFamily: 'RobotoCondensed500' },
  rangeLine: { marginTop: 10 },
  caption: { fontFamily: 'RobotoCondensed400', fontSize: 13 },
  body: { fontFamily: 'RobotoCondensed400', fontSize: 14, lineHeight: 20 },
  big: { fontFamily: 'RobotoCondensed500', fontSize: 40, marginTop: 6 },
  bigUnit: { fontFamily: 'RobotoCondensed400', fontSize: 16 },
  shareBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 12 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 14 },
  tile: { flex: 1, minHeight: 120 },
  tileValue: { fontFamily: 'RobotoCondensed500', fontSize: 26, marginTop: 4 },
  tileHint: { fontFamily: 'RobotoCondensed400', fontSize: 12, lineHeight: 17, marginTop: 2 },
  tileLink: { fontFamily: 'RobotoCondensed500', fontSize: 14, marginTop: 8 },
  note: { fontFamily: 'RobotoCondensed400', fontSize: 12, lineHeight: 17, marginTop: 8 },
});
