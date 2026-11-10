import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type UpdateInfo = {
  /** A newer version is published on Google Play for this device. */
  available: boolean;
  /** An immediate update was started earlier and hasn't finished yet. */
  inProgress: boolean;
  /** Play allows the full-screen (immediate) update flow right now. */
  immediateAllowed: boolean;
  availableVersionCode: number;
};

/**
 * Google Play In-App Updates, implemented natively on Android
 * (android/app/src/main/java/com/vehiclehub/updates). Only works for installs
 * that came from Google Play; sideloaded/debug builds reject checkForUpdate.
 */
export interface Spec extends TurboModule {
  checkForUpdate(): Promise<UpdateInfo>;
  /**
   * Opens Play's full-screen update flow. Resolves true if the user accepted
   * (Play then installs and restarts the app), false if they backed out.
   * Rejects with "NOT_ALLOWED" when Play won't offer the immediate flow.
   */
  startUpdate(): Promise<boolean>;
  /** Opens this app's Google Play listing (fallback when startUpdate can't run). */
  openStore(): Promise<void>;
}

// `get`, not `getEnforcing`: the module only exists on Android.
export default TurboModuleRegistry.get<Spec>('AppUpdater');
