import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './ui/AppText';
import { fuelUnit } from '../util/fuelEfficiency.js';
import { formatKm, odometerLowMessage } from '../util/distance';
import SkeletonBlock from './ui/SkeletonBlock.jsx';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { t as tr } from '../i18n';
import { localDate } from '../i18n';

// Pieces shared by AddFuelLog and FuelUpdate.
//
// colors: { text, muted, inputBg, inputBorder, inputBorderFocus, accent, required, isDark }

const formatDate = ms =>
  localDate(new Date(ms), { day: '2-digit', month: 'short', year: 'numeric' });

// Last fill-up before this one: when, at what reading, and km driven since.
export const PreviousFillCard = ({ history, colors }) => {
  const distUnit = useDistanceUnit();
  const { previous, sinceKm, loading } = history;
  // Same footprint as the card while the history loads, so fields don't shift.
  if (loading) return <SkeletonBlock height={60} borderRadius={12} style={styles.previousSkeleton} />;
  if (!previous) return null;
  return (
    <View style={[styles.previousBox, { backgroundColor: colors.inputBg }]}>
      <Text style={[styles.previousTitle, { color: colors.muted }]}>{tr('PREVIOUS FILL-UP')}</Text>
      <Text style={[styles.previousText, { color: colors.text }]}>
        {formatDate(previous.ms)}
        {previous.km ? ` · ${formatKm(previous.km, distUnit)}` : ''}
        {previous.liters ? ` · ${previous.liters} ${fuelUnit(previous.fuelType)}` : ''}
      </Text>
      {sinceKm != null && (
        <Text style={[styles.previousSince, { color: colors.accent }]}>
          {tr('{0} driven since then', { 0: formatKm(sinceKm, distUnit) })}
        </Text>
      )}
    </View>
  );
};

export const OdometerWarning = ({ history, colors }) => {
  const distUnit = useDistanceUnit();
  return history.tooLow ? (
    <Text style={[styles.warning, { color: colors.warning || '#B45309' }]}>
      {odometerLowMessage(history.tooLow, distUnit)}
    </Text>
  ) : null;
};

const styles = StyleSheet.create({
  previousSkeleton: { marginBottom: 14 },
  previousBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 4, marginBottom: 14 },
  previousTitle: { fontSize: 11, fontFamily: 'RobotoCondensed500', letterSpacing: 1.2 },
  previousText: { fontSize: 14, fontFamily: 'RobotoCondensed500' },
  previousSince: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
  warning: { marginTop: 6, fontSize: 12, fontFamily: 'RobotoCondensed400', lineHeight: 16 },
});
