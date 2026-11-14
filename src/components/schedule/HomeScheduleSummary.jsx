import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HistoryStatIcon, ScheduleSummaryCard, SectionLabel, UpcomingRow, UpcomingStatIcon } from './ScheduleParts';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { useDistanceUnit } from '../../util/schedule/scheduleSettings';
import { requestVehicleOpen } from '../../util/schedule/scheduleNav';
import { useScheduleHost } from '../../util/schedule/scheduleHostContext';
import ScheduleFormModal from '../../modals/ScheduleFormModal';
import { t as tr } from '../../i18n';

const MAX_UPCOMING = 3;

/**
 * Screen 1, Home → Services: schedule summary, then the next schedules
 * (most urgent first). "View all" opens this vehicle in the Vehicle tab on
 * its Schedule tab. The existing service list follows as
 * History. `reloadKey` changes whenever a service is saved on Home.
 */
// `historyCount`: this vehicle's service records (null while they load).
const HomeScheduleSummary = ({ vehicleId, reloadKey, historyCount }) => {
  const navigation = useNavigation();
  // Home's ScheduleHost: a schedule's page opens inside Home.
  const host = useScheduleHost();
  const unit = useDistanceUnit();
  const { evaluations, counts, data, loading, reload } = useVehicleSchedules(vehicleId);
  const [formOpen, setFormOpen] = useState(false);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
  }, [reloadKey, reload]);

  useEffect(() => {
    setFormOpen(false);
  }, [vehicleId]);

  if (!vehicleId) return null;

  // Nothing until this vehicle's schedules are known (they come from the
  // session cache on a revisit, so this is only a first load). No skeleton
  // here: Home is already fully drawn, and a failed load must not leave
  // placeholder bars on screen.
  if (loading || !data) return null;

  // Most urgent first; schedules that aren't due yet still show, so the
  // section is always there once a vehicle has any schedule.
  const upcoming = evaluations.slice(0, MAX_UPCOMING);
  const openDetail = ruleId => (host || navigation).navigate('ScheduleDetail', { vehicleId, ruleId });
  const viewAll = () => {
    requestVehicleOpen(vehicleId, 'Schedule');
    navigation.navigate('Vehicle');
  };

  return (
    <View style={styles.wrap}>
      <ScheduleSummaryCard
        counts={counts}
        total={evaluations.length}
        stats={[
          {
            key: 'upcoming',
            label: tr('filter.upcoming'),
            value: evaluations.length,
            icon: color => <UpcomingStatIcon color={color} />,
          },
          {
            key: 'history',
            label: tr('st.completed'),
            value: historyCount ?? '–',
            icon: color => <HistoryStatIcon color={color} />,
          },
        ]}
        onPress={() => (evaluations.length ? viewAll() : setFormOpen(true))}
      />

      {upcoming.length > 0 && (
        <>
          <SectionLabel>{tr('sched.upcomingSection')}</SectionLabel>
          {upcoming.map(e => (
            <UpcomingRow key={e.rule.id} evaluation={e} unit={unit} onPress={() => openDetail(e.rule.id)} />
          ))}
        </>
      )}
      <SectionLabel>{tr('sched.completedSection')}</SectionLabel>

      {/* Add schedule opens over Home, not as a separate screen. */}
      <ScheduleFormModal
        visible={formOpen}
        vehicleId={vehicleId}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
    </View>
  );
};

export default HomeScheduleSummary;

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 14 },
});
