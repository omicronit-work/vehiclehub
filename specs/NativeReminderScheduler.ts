import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Local reminder notifications, implemented natively on Android
 * (android/app/src/main/java/com/vehiclehub/reminders). Alarms are owned by
 * the OS and the notification is posted from a native BroadcastReceiver, so
 * reminders fire even when the app isn't running. Boot / app-update restores
 * them from native storage.
 */
export interface Spec extends TurboModule {
  areNotificationsEnabled(): Promise<boolean>;
  /** Shows the Android 13+ runtime prompt if it can still be shown. */
  requestPermission(): Promise<boolean>;
  /** Android 12+: whether "Alarms & reminders" is granted for this app. */
  canScheduleExactAlarms(): boolean;
  /** Replaces any reminder with the same id. Resolves to whether an exact alarm was used. */
  schedule(id: string, title: string, body: string, fireAt: number): Promise<boolean>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openAlarmSettings(): Promise<void>;
}

// `get`, not `getEnforcing`: the module only exists on Android.
export default TurboModuleRegistry.get<Spec>('ReminderScheduler');
