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
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
