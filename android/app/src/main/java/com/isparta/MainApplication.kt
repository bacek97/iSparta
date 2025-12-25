package com.isparta

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.isparta.handlandmarksframeprocessor.HandLandmarksFrameProcessorPluginPackage
import com.isparta.HandLandmarksPackage
import com.isparta.poselandmarksframeprocessor.PoseLandmarksFrameProcessorPluginPackage
import com.isparta.PoseLandmarksPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(HandLandmarksFrameProcessorPluginPackage())
          add(HandLandmarksPackage())
          add(PoseLandmarksFrameProcessorPluginPackage())
          add(PoseLandmarksPackage())
          add(StepCounterPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    
    // УСИЛЕННЫЙ КОСТЫЛЬ v2: Напрямую инициализируем logback-android
    // SLF4J не находит StaticLoggerBinder и использует NOP logger, поэтому делаем это вручную
    try {
      val context = org.slf4j.LoggerFactory.getILoggerFactory() as? ch.qos.logback.classic.LoggerContext
      
      if (context != null) {
        context.reset()
        
        // Настраиваем LogcatAppender
        val encoder = ch.qos.logback.classic.encoder.PatternLayoutEncoder()
        encoder.context = context
        encoder.pattern = "%msg"
        encoder.start()
        
        val logcatAppender = ch.qos.logback.classic.android.LogcatAppender()
        logcatAppender.context = context
        logcatAppender.encoder = encoder  
        logcatAppender.start()
        
        val root = org.slf4j.LoggerFactory.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME) as ch.qos.logback.classic.Logger
        root.level = ch.qos.logback.classic.Level.TRACE
        root.addAppender(logcatAppender)
        
        android.util.Log.d("MainApplication", "Logback-android configured successfully")
      } else {
        android.util.Log.e("MainApplication", "LoggerContext is null or not logback")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Failed to configure logback", e)
    }
    
    loadReactNative(this)
  }
}
