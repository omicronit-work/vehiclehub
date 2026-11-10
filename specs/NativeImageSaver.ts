import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Saves a remote image into the phone's gallery (Pictures/VehicleHub),
 * implemented natively on Android (android/app/src/main/java/com/vehiclehub/media).
 * Uses MediaStore, so no storage/media permission is needed. Rejects with
 * code "UNSUPPORTED" below Android 10, where that would need a permission;
 * the JS side then falls back to the share sheet.
 */
export interface Spec extends TurboModule {
  /** Resolves to the saved image's content:// URI. */
  saveImage(url: string, fileName: string): Promise<string>;
}

// `get`, not `getEnforcing`: the module only exists on Android.
export default TurboModuleRegistry.get<Spec>('ImageSaver');
