import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * On-device translation with Google ML Kit, implemented natively on Android
 * (android/app/src/main/java/com/vehiclehub/translate). Nothing leaves the
 * phone; each language needs its model (~30 MB) downloaded once.
 */
export interface Spec extends TurboModule {
  /**
   * The language `text` is written in, as a BCP-47 tag ("en", "bn"), or "und"
   * when ML Kit isn't confident.
   */
  identifyLanguage(text: string): Promise<string>;
  /**
   * `text` from `source` to `target` (BCP-47 tags), on the phone, offline.
   * Never downloads: rejects at once with "MODEL_MISSING" when a model isn't
   * on the phone yet (downloadModels gets it), "UNSUPPORTED" for a language
   * ML Kit can't translate. `wifiOnly` is unused (kept for compatibility).
   */
  translate(text: string, source: string, target: string, wifiOnly: boolean): Promise<string>;
  /**
   * Downloads the translation models for these languages (BCP-47 tags) so
   * translate() works offline. Resolves once all are on the phone (at once
   * when they already are); only on Wi-Fi when `wifiOnly`.
   */
  downloadModels(languages: ReadonlyArray<string>, wifiOnly: boolean): Promise<boolean>;
  /**
   * `text` written by sound in another script with an ICU transform
   * ("Latin-Bengali": "rego" → "রেগো"). Rejects with "UNSUPPORTED" before
   * Android 10 or for a transform the device doesn't have.
   */
  transliterate(text: string, transformId: string): Promise<string>;
}

// `get`, not `getEnforcing`: the module only exists on Android.
export default TurboModuleRegistry.get<Spec>('TextTranslator');
