# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native / Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# App classes (MainApplication / MainActivity are referenced from the manifest
# and native code reflectively loads ReactPackages)
-keep class com.vehiclehub.** { *; }

# Firebase / Google Sign-In
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Notifee
-keep class io.invertase.notifee.** { *; }
-keep class app.notifee.core.** { *; }

# react-native-svg
-keep public class com.horcrux.svg.** { *; }

# react-native-blur
-keep class com.reactnativecommunity.blurview.** { *; }
-keep class eightbitlab.com.blurview.** { *; }

# react-native-html-to-pdf
-keep class com.christopherdro.htmltopdf.** { *; }
-keep class android.print.** { *; }

# OkHttp / Okio (used by RN networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# PdfBox-Android: optional JPEG2000 decoder isn't bundled
-dontwarn com.gemalto.jp2.**
-keep class com.tom_roush.pdfbox.** { *; }
