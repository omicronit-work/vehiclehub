import React from 'react';
import { ScreenShell, PrimaryAction } from '../../components/schedule/ScheduleParts';
import ScheduleList from '../../components/schedule/ScheduleList';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { t as tr } from '../../i18n';
import { vehicleName } from '../../i18n/brands';

// Screen 2 on its own, opened from Home's "Service schedule · View all".
const ScheduleListScreen = ({ navigation, route }) => {
  const { vehicleId } = route.params || {};
  const schedule = useVehicleSchedules(vehicleId);
  const v = schedule.data?.vehicle;
  const title = vehicleName(v) || tr('Service schedule');

  return (
    <ScreenShell
      title={title}
      left={{ label: tr('Back'), chevron: true, onPress: () => navigation.goBack() }}
      right={{ label: tr('Alerts'), onPress: () => navigation.navigate('ServiceAlerts', { vehicleId }) }}
      footer={
        schedule.evaluations.length > 0 ? (
          <PrimaryAction title={tr('+ Schedule')} onPress={() => navigation.navigate('ScheduleForm', { vehicleId })} />
        ) : null
      }
    >
      <ScheduleList vehicleId={vehicleId} schedule={schedule} />
    </ScreenShell>
  );
};

export default ScheduleListScreen;
