import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { ScheduleCard, useSchedulePalette, PrimaryAction, LinkRow } from './ScheduleParts';
import ErrorState from '../ui/ErrorState';
import { ScheduleListSkeleton } from './ScheduleSkeletons';
import { useDistanceUnit } from '../../util/schedule/scheduleSettings';
import { Typography } from '../../styles/typography';
import { markScheduleNavigation } from '../../util/schedule/scheduleNav';
import { useScheduleHost } from '../../util/schedule/scheduleHostContext';

/**
 * Screen 2 body: rules sorted overdue → due soon → OK. Rendered inside the
 * vehicle's tab view and on the standalone ScheduleList screen; the caller
 * owns the "+ Schedule" button. `schedule` is useVehicleSchedules' result;
 * `embedded` when shown inside the Garage tab. `hideEmpty` skips the
 * empty-state block (used when the caller already shows other content and
 * its own add button).
 */
const BellIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z M10 19a2 2 0 0 0 4 0"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ScheduleList = ({ vehicleId, schedule, embedded = false, hideEmpty = false }) => {
  const navigation = useNavigation();
  const p = useSchedulePalette();
  const unit = useDistanceUnit();
  const { evaluations, data, loading, error, reload } = schedule;

  const host = useScheduleHost();

  // Inside the Vehicle screen, pages open in place (form as a modal).
  const open = (screen, params) => {
    if (host) {
      host.navigate(screen, { vehicleId, ...params });
      return;
    }
    if (embedded) markScheduleNavigation();
    navigation.navigate(screen, { vehicleId, ...params });
  };

  if (loading && !data) {
    return <ScheduleListSkeleton />;
  }
  if (error && !data) {
    return <ErrorState title="Couldn't load the schedule" onRetry={reload} />;
  }
  // Nothing to show and the caller handles adding: take up no space.
  if (hideEmpty && evaluations.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {evaluations.length === 0 ? (
        hideEmpty ? null : (
        <View style={[styles.empty, embedded && styles.emptyEmbedded]}>
          <Text style={[styles.emptyTitle, { color: p.text }]}>No service schedule yet</Text>
          <Text style={[styles.emptyText, { color: p.muted }]}>
            Add a rule such as "engine oil every 10,000 km or 6 months" and VehicleHub tells you when it's due.
          </Text>
          {/* Embedded in the Vehicle screen, its "+ Add" button covers this. */}
          {!embedded && (
            <PrimaryAction title="+ Add schedule" onPress={() => open('ScheduleForm')} style={styles.emptyButton} />
          )}
        </View>
        )
      ) : (
        evaluations.map(e => (
          <ScheduleCard
            key={e.rule.id}
            evaluation={e}
            unit={unit}
            odometer={data?.odometer}
            onPress={() => open('ScheduleDetail', { ruleId: e.rule.id })}
          />
        ))
      )}
      {evaluations.length > 0 && (
        <LinkRow
          icon={<BellIcon color={p.accent} />}
          title="Service alerts"
          subtitle="When and how you're reminded"
          onPress={() => open('ServiceAlerts')}
        />
      )}
    </View>
  );
};

export default ScheduleList;

const styles = StyleSheet.create({
  list: { gap: 12, paddingTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 8 },
  // Inside the vehicle's Services tab, History follows right below.
  emptyEmbedded: { paddingTop: 20, paddingBottom: 4 },
  emptyTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 16 },
  emptyText: { fontFamily: Typography.font.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyButton: { flex: 0, alignSelf: 'stretch', marginTop: 10 },
});
