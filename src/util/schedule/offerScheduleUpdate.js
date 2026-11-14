import { Alert } from 'react-native';
import { findScheduleForService, loadVehicleScheduleData, restartSchedule } from './scheduleStore';
import { cancelRuleNotifications, syncVehicleSchedules } from './scheduleReminders';
import { formatYmd, todayYmd, toYmd, validateMarkDone } from './scheduleMath';
import { t as tr } from '../../i18n';
import { ruleName } from '../serviceFields';

/**
 * R12 — after a normal service is saved, if its type matches a schedule on
 * the vehicle, ask "Update the schedule too?". Yes restarts the rule (R9)
 * from that service's date and odometer. Never throws; the service is
 * already saved. Resolves true if the schedule was restarted.
 */
export const offerScheduleUpdate = async ({ email, vehicleId, serviceName, serviceDate, mileage }) => {
  try {
    if (!email || !vehicleId || !serviceName) return false;
    const rule = await findScheduleForService(email, vehicleId, serviceName);
    if (!rule) return false;

    const data = await loadVehicleScheduleData(email, vehicleId);
    const dateDone = toYmd(serviceDate || new Date());
    const odo = Number(mileage) > 0 ? Math.round(Number(mileage)) : data.odometer;
    // Only offer what Mark as done would accept (R8, R11).
    const check = validateMarkDone({ dateDone, odo, today: todayYmd(), rule, vehicleOdo: data.odometer });
    if (!check.ok) return false;

    const yes = await new Promise(resolve =>
      Alert.alert(
        tr('Update the schedule too?'),
        tr('"{0}" will restart from {1} at {2} km.', { 0: ruleName(rule), 1: formatYmd(dateDone), 2: odo.toLocaleString('en-US') }),
        [
          { text: tr('Not now'), style: 'cancel', onPress: () => resolve(false) },
          { text: tr('Update'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!yes) return false;

    await restartSchedule(email, vehicleId, rule.id, { dateDone, odo });
    await cancelRuleNotifications(vehicleId, rule.id, { all: true });
    await syncVehicleSchedules(email, vehicleId, { seed: true });
    return true;
  } catch (e) {
    console.log('Schedule update offer failed:', e);
    return false;
  }
};
