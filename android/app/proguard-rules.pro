# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Keep Kotlin Metadata
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.google.firebase.**$$serializer { *; }
-keepclassmembers class com.google.firebase.** {
    *** Companion;
}
-keepclasseswithmembers class com.google.firebase.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep Kotlin Metadata annotations
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# Keep Kotlin serialization
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

# Keep Firebase Auth Kotlin extensions
-keep class com.google.firebase.auth.ktx.** { *; }
-keep class com.google.firebase.ktx.** { *; }

# Keep Facebook SDK
-keep class com.facebook.** { *; }
-keepclassmembers class com.facebook.** { *; }
-keep class com.facebook.login.** { *; }
-keep class com.facebook.android.** { *; }

# Keep Facebook SDK Callbacks
-keepclassmembers class * implements com.facebook.FacebookCallback {
    <methods>;
}
