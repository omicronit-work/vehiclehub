package com.vehiclehub.translate

import android.icu.text.Transliterator
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import com.vehiclehub.specs.NativeTextTranslatorSpec
import java.util.concurrent.ConcurrentHashMap

/**
 * TurboModule backing specs/NativeTextTranslator.ts: ML Kit language ID and
 * on-device translation. Translators are kept open per language pair (opening
 * one loads its model) and closed with the module.
 */
class TextTranslatorModule(reactContext: ReactApplicationContext) :
    NativeTextTranslatorSpec(reactContext) {

  private val identifier by lazy {
    LanguageIdentification.getClient(
        LanguageIdentificationOptions.Builder().setConfidenceThreshold(CONFIDENCE).build())
  }
  private val modelManager by lazy { RemoteModelManager.getInstance() }
  private val translators = ConcurrentHashMap<String, Translator>()
  private val transliterators = ConcurrentHashMap<String, Transliterator>()

  override fun getName() = NAME

  override fun identifyLanguage(text: String, promise: Promise) {
    identifier
        .identifyLanguage(text)
        .addOnSuccessListener { tag -> promise.resolve(tag ?: UNDETERMINED) }
        .addOnFailureListener { e -> promise.reject("IDENTIFY_FAILED", e) }
  }

  override fun translate(
      text: String,
      source: String,
      target: String,
      wifiOnly: Boolean,
      promise: Promise,
  ) {
    val from = TranslateLanguage.fromLanguageTag(source)
    val to = TranslateLanguage.fromLanguageTag(target)
    if (from == null || to == null) {
      promise.reject("UNSUPPORTED", "Can't translate $source → $target")
      return
    }
    if (from == to) {
      promise.resolve(text)
      return
    }
    // Only models already on the phone are used: a download started here
    // would wait for a connection while offline and hold the text up.
    Tasks.whenAllSuccess<Boolean>(isDownloaded(from), isDownloaded(to))
        .addOnSuccessListener { present ->
          if (!present.all { it }) {
            promise.reject(MODEL_MISSING, "Translation model for $source → $target isn't on the phone")
            return@addOnSuccessListener
          }
          val translator =
              translators.getOrPut("$from>$to") {
                Translation.getClient(
                    TranslatorOptions.Builder().setSourceLanguage(from).setTargetLanguage(to).build())
              }
          translator
              .translate(text)
              .addOnSuccessListener { result -> promise.resolve(result) }
              .addOnFailureListener { e -> promise.reject("TRANSLATE_FAILED", e) }
        }
        .addOnFailureListener { e -> promise.reject("TRANSLATE_FAILED", e) }
  }

  override fun downloadModels(languages: ReadableArray, wifiOnly: Boolean, promise: Promise) {
    val conditions = DownloadConditions.Builder().apply { if (wifiOnly) requireWifi() }.build()
    val tasks =
        (0 until languages.size())
            .mapNotNull { languages.getString(it)?.let(TranslateLanguage::fromLanguageTag) }
            .filter { it != TranslateLanguage.ENGLISH }
            .map { modelManager.download(TranslateRemoteModel.Builder(it).build(), conditions) }
    Tasks.whenAll(tasks)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e -> promise.reject("DOWNLOAD_FAILED", e) }
  }

  // English ships with ML Kit; every other language is a downloaded model.
  private fun isDownloaded(language: String): Task<Boolean> =
      if (language == TranslateLanguage.ENGLISH) Tasks.forResult(true)
      else modelManager.isModelDownloaded(TranslateRemoteModel.Builder(language).build())

  override fun transliterate(text: String, transformId: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED", "ICU transliteration needs Android 10")
      return
    }
    try {
      val transform = transliterators.getOrPut(transformId) { Transliterator.getInstance(transformId) }
      // A Transliterator isn't thread-safe.
      promise.resolve(synchronized(transform) { transform.transliterate(text) })
    } catch (e: IllegalArgumentException) {
      promise.reject("UNSUPPORTED", e)
    }
  }

  override fun invalidate() {
    translators.values.forEach { it.close() }
    translators.clear()
    super.invalidate()
  }

  companion object {
    const val NAME = "TextTranslator"
    private const val UNDETERMINED = "und"
    private const val MODEL_MISSING = "MODEL_MISSING"
    // Below this ML Kit answers "und": short or mixed text is left as typed.
    private const val CONFIDENCE = 0.6f
  }
}
