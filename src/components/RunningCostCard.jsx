import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './ui/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllVehiclesCostRecords, getVehicleCostRecords } from '../store/userSlice.js';
import { computeFleetRunningCost, computeRunningCost, perKmParts, PERIODS, roundHalfUp, SERVICE_COLOR } from '../util/runningCost';
import { effToUnit, kmToUnit } from '../util/distance';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import SkeletonBlock from './ui/SkeletonBlock.jsx';
import { symbolFor } from '../util/methods/useCurrency';
import { t as tr } from '../i18n';
import { localDate } from '../i18n';

const PERIOD_KEY = 'dashboard:runningCostPeriod';
const ALL = '__all__';
const cardShadow = shadowSoft(1.5);

const dayLabel = ms => localDate(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' });
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
 * Dashboard (spec screen 1): what a vehicle really costs to run, from the
 * fuel logs and services already saved. With no `vehicleId` ("All vehicles")
 * it covers every vehicle together (computeFleetRunningCost).
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

  // null = every vehicle; kept apart from a real id in `records`.
  const scopeKey = vehicleId || ALL;

  useEffect(() => {
    if (!userEmail || !currencyReady) return;
    let cancelled = false;
    setStatus(s => (records?.scopeKey === scopeKey ? s : 'loading'));
    // Every record counts, in the app currency (never converted).
    (vehicleId
      ? getVehicleCostRecords(userEmail, vehicleId, { currency })
      : getAllVehiclesCostRecords(userEmail, { currency }))
      .then(res => {
        if (cancelled) return;
        setRecords({ ...res, scopeKey });
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

  const result = useMemo(() => {
    if (!records || records.scopeKey !== scopeKey) return null;
    return records.vehicles
      ? computeFleetRunningCost({ vehicles: records.vehicles, period })
      : computeRunningCost({ fuelLogs: records.fuelLogs, services: records.services, period });
  }, [records, scopeKey, period]);

  // Follows the selected currency at once (amounts are never converted).
  const symbol = symbolFor(currency);
  const money = moneyFormatter(symbol);
  const perUnit = distUnit === 'mi' ? 'mile' : 'km';
  const card = [styles.card, cardShadow, { backgroundColor: c.cardBg }];
  const heroBg = isDark ? 'rgba(255,255,255,0.06)' : c.pillBg;

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
            <Text style={[styles.body, { color: c.muted }]}>{tr('Couldn\'t load the running cost. Pull down to try again.')}</Text>
          ) : (
            <View accessibilityLabel={tr('Loading running cost')}>
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
  const fleet = !!records.vehicles;
  const notes = [
    fleet && r.enoughData && r.vehiclesCounted < r.vehicleCount && {
      text: tr('Cost per {0} covers {1} of {2} vehicles; the others need two fuel logs in this period. Total spent covers every vehicle.', { 0: perUnit, 1: r.vehiclesCounted, 2: r.vehicleCount }),
    },
    r.odometerWarning && { warn: true, text: tr('Check your odometer entries: one reading is lower than the one before.') },
    r.servicesWithoutCost > 0 && {
      text: r.servicesWithoutCost === 1
        ? tr('1 service has no cost, so it counts as 0.')
        : tr('{0} services have no cost, so they count as 0.', { 0: r.servicesWithoutCost }),
    },
  ].filter(Boolean);
  const p2 = v => `${symbol}\u00A0${v.toFixed(2)}`;

  return (
    <View>
      {chips}
      {r.range && (
        <Text style={[styles.caption, styles.rangeLine, { color: c.muted }]}>
          {rangeLabel(r.range)}
          {r.enoughData ? tr('· {0} {1} driven', { 0: km.toLocaleString('en-US'), 1: distUnit }) : ''}
        </Text>
      )}

      {/* Running cost */}
      <View style={[card, styles.gap, { backgroundColor: heroBg }]}>
        <Text style={[styles.label, { color: c.link }]}>{tr('RUNNING COST')}</Text>
        {parts ? (
          <>
            <Text style={[styles.big, { color: c.text }]} accessibilityLabel={tr('{0} per {1}', { 0: p2(parts.total), 1: perUnit })}>
              {p2(parts.total)}
              <Text style={[styles.bigUnit, { color: c.muted }]}>{' '}{tr('per {0}', { 0: perUnit })}</Text>
            </Text>
            <Text style={[styles.body, { color: c.muted }]}>
              {tr('Fuel {0} + services {1}', { 0: p2(parts.fuel), 1: p2(parts.service) })}
            </Text>
            {r.fuelShare != null && (
              <>
                <View style={[styles.shareBar, { backgroundColor: c.donutTrack }]}>
                  <View style={{ flex: r.fuelShare, backgroundColor: c.line }} />
                  <View style={{ flex: 100 - r.fuelShare, backgroundColor: SERVICE_COLOR }} />
                </View>
                <View style={styles.legend}>
                  <Text style={[styles.caption, { color: c.muted }]}>{tr('Fuel')}{' '}{r.fuelShare}%</Text>
                  <Text style={[styles.caption, { color: c.muted }]}>{tr('Services')}{' '}{100 - r.fuelShare}%</Text>
                </View>
              </>
            )}
          </>
        ) : (
          <Text style={[styles.body, styles.gapSmall, { color: c.text }]}>{fleet ? tr('Add two fuel logs to a vehicle to see the running cost.') : tr('Add two fuel logs to see your running cost.')}</Text>
        )}
      </View>

      {/* Fuel economy · Total spent */}
      <View style={styles.tiles}>
        <View style={[card, styles.tile]}>
          <Text style={[styles.caption, { color: c.muted }]}>{tr('Fuel economy')}</Text>
          {economy != null ? (
            <>
              <Text style={[styles.tileValue, { color: c.text }]}>{economy.toFixed(1)}</Text>
              <Text style={[styles.tileHint, { color: c.muted }]}>
                {distUnit === 'mi' ? 'miles' : 'km'}{' '}{tr('per litre, average')}
              </Text>
              <Text style={[styles.tileHint, { color: c.muted }]}>
                {r.fuelNames.length > 1 ? tr('All fuel types together') : tr('{0} L used', { 0: r.litresUsed.toFixed(1) })}
              </Text>
            </>
          ) : (
            <Text style={[styles.tileHint, styles.gapSmall, { color: c.muted }]}>
              {r.enoughData && r.nonLitreFuel
                ? tr('Shown for fuel sold in litres only.')
                : tr('Needs two fuel logs in this period.')}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => onOpenByMonth?.({ result: r, vehicleName, money })}
          accessibilityRole="button"
          accessibilityLabel={tr('Total spent {0}. See spending by month', { 0: money(r.totalSpent) })}
          style={({ pressed }) => [card, styles.tile, pressed && styles.pressed]}
        >
          <Text style={[styles.caption, { color: c.muted }]}>{tr('Total spent')}</Text>
          <Text style={[styles.tileValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(r.totalSpent)}
          </Text>
          <Text style={[styles.tileHint, { color: c.muted }]} numberOfLines={1}>{tr('Fuel')}{' '}{money(r.fuelSpent)}</Text>
          <Text style={[styles.tileHint, { color: c.muted }]} numberOfLines={1}>{tr('Services')}{' '}{money(r.serviceSpent)}</Text>
          <Text style={[styles.tileLink, { color: c.link }]}>{tr('By month ›')}</Text>
        </Pressable>
      </View>

      {/* How this is worked out */}
      <View style={[card, styles.gap]}>
        <Text style={[styles.caption, { color: c.muted }]}>{tr('How this is worked out')}</Text>
        <Text style={[styles.body, styles.gapSmall, { color: c.text }]}>
          {fleet
            ? (r.enoughData
              ? tr("All vehicles together: each vehicle's first fuel log is only a starting point, so {0} is left out. Cost per {1} is the fuel and services of every vehicle over the distance they drove between their first and last fuel log.", { 0: money(r.startCost), 1: perUnit })
              : tr('Running cost needs two fuel logs for at least one vehicle in this period. Each vehicle is worked out from its own odometer, then the figures are added together.'))
            : r.enoughData
            ? tr('The first fuel log is only a starting point, so its {0} is left out. Averages use the distance you drove between your first and last fuel log.', { 0: money(r.startCost) })
            : tr('Running cost needs two fuel logs in this period. The first is only a starting point; averages use the distance you drove between the first and the last.')}
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
