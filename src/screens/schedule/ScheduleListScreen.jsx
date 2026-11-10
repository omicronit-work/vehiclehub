import React from 'react';
import { ScreenShell, PrimaryAction } from '../../components/schedule/ScheduleParts';
import ScheduleList from '../../components/schedule/ScheduleList';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';

// Screen 2 on its own, opened from Home's "Service schedule · View all".
const ScheduleListScreen = ({ navigation, route }) => {
  const { vehicleId } = route.params || {};
  const schedule = useVehicleSchedules(vehicleId);
  const v = schedule.data?.vehicle;
  const title = [v?.brand, v?.model].filter(Boolean).join(' ') || 'Service schedule';

  return (
    <ScreenShell
      title={title}
      left={{ label: 'Back', chevron: true, onPress: () => navigation.goBack() }}
      right={{ label: 'Alerts', onPress: () => navigation.navigate('ServiceAlerts', { vehicleId }) }}
      footer={
        schedule.evaluations.length > 0 ? (
          <PrimaryAction title="+ Schedule" onPress={() => navigation.navigate('ScheduleForm', { vehicleId })} />
        ) : null
      }
    >
      <ScheduleList vehicleId={vehicleId} schedule={schedule} />
    </ScreenShell>
  );
};

export default ScheduleListScreen;
