package com.vehiclehub.media

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.vehiclehub.specs.NativeImageSaverSpec
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** TurboModule backing specs/NativeImageSaver.ts. */
class ImageSaverModule(reactContext: ReactApplicationContext) :
    NativeImageSaverSpec(reactContext) {

  override fun getName() = NAME

  override fun saveImage(url: String, fileName: String, promise: Promise) {
    // Below Android 10 writing to shared storage needs WRITE_EXTERNAL_STORAGE,
    // which the manifest strips; JS falls back to the share sheet.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED", "Saving to the gallery needs Android 10 or newer")
      return
    }

    executor.execute {
      val resolver = reactApplicationContext.contentResolver
      var connection: HttpURLConnection? = null
      var itemUri: android.net.Uri? = null
      try {
        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 15_000
          readTimeout = 30_000
        }
        if (connection.responseCode !in 200..299) {
          throw IllegalStateException("Download failed (HTTP ${connection.responseCode})")
        }

        val mimeType = connection.contentType?.substringBefore(';')?.trim()
            ?.takeIf { it.startsWith("image/") } ?: "image/jpeg"
        val extension = when (mimeType) {
          "image/png" -> "png"
          "image/webp" -> "webp"
          "image/gif" -> "gif"
          else -> "jpg"
        }

        val values = ContentValues().apply {
          put(MediaStore.Images.Media.DISPLAY_NAME, "$fileName.$extension")
          put(MediaStore.Images.Media.MIME_TYPE, mimeType)
          put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/VehicleHub")
          put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        itemUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Could not create the gallery entry")

        resolver.openOutputStream(itemUri)?.use { out ->
          connection.inputStream.use { it.copyTo(out) }
        } ?: throw IllegalStateException("Could not write the image")

        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(itemUri, values, null, null)
        promise.resolve(itemUri.toString())
      } catch (e: Exception) {
        // Don't leave a half-written, pending entry behind.
        itemUri?.let { runCatching { resolver.delete(it, null, null) } }
        promise.reject("SAVE_FAILED", e.message ?: "Could not save the image", e)
      } finally {
        connection?.disconnect()
      }
    }
  }

  companion object {
    const val NAME = "ImageSaver"
    private val executor = Executors.newSingleThreadExecutor()
  }
}
