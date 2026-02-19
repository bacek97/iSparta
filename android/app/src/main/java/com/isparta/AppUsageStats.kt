package com.isparta

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.util.*

/**
 * React Native module for Android UsageStatsManager
 * Provides access to installed apps list and app usage statistics
 */
class AppUsageStats(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "AppUsageStats"
        private const val EVENT_APP_LAUNCHED = "onAppLaunched"
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Check if usage stats permission is granted
     */
    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            val granted = checkUsageStatsPermission()
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    private fun checkUsageStatsPermission(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * Open system settings to grant usage stats permission
     */
    @ReactMethod
    fun requestUsageStatsPermission() {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            // Settings activity not found, try fallback
            val intent = Intent(Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        }
    }

    /**
     * Get list of installed apps
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val result = Arguments.createArray()

            for (appInfo in packages) {
                // Skip system apps that are not launchable
                if (pm.getLaunchIntentForPackage(appInfo.packageName) == null) {
                    continue
                }

                val app = Arguments.createMap()
                app.putString("packageName", appInfo.packageName)
                app.putString("appName", pm.getApplicationLabel(appInfo).toString())
                
                // Get app icon as base64
                try {
                    val icon = pm.getApplicationIcon(appInfo)
                    val iconBase64 = drawableToBase64(icon)
                    app.putString("icon", iconBase64)
                } catch (e: Exception) {
                    app.putNull("icon")
                }

                result.pushMap(app)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message, e)
        }
    }

    /**
     * Get app usage statistics for a time range
     */
    @ReactMethod
    fun getAppUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime.toLong(),
                endTime.toLong()
            )

            val result = Arguments.createArray()
            val pm = reactContext.packageManager

            for (usageStat in stats) {
                if (usageStat.totalTimeInForeground <= 0) continue

                val stat = Arguments.createMap()
                stat.putString("packageName", usageStat.packageName)
                
                // Get app name
                try {
                    val appInfo = pm.getApplicationInfo(usageStat.packageName, 0)
                    stat.putString("appName", pm.getApplicationLabel(appInfo).toString())
                } catch (e: Exception) {
                    stat.putString("appName", usageStat.packageName)
                }

                stat.putDouble("totalTimeInForeground", usageStat.totalTimeInForeground.toDouble())
                stat.putDouble("lastTimeUsed", usageStat.lastTimeUsed.toDouble())
                
                result.pushMap(stat)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Get usage time for specific packages today
     */
    @ReactMethod
    fun getTodayUsageForPackages(packages: ReadableArray, promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val packageSet = HashSet<String>()
            for (i in 0 until packages.size()) {
                packages.getString(i)?.let { packageSet.add(it) }
            }

            val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            // Get start of today
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            val result = Arguments.createMap()
            
            for (usageStat in stats) {
                if (packageSet.contains(usageStat.packageName)) {
                    // Convert milliseconds to minutes
                    val minutes = usageStat.totalTimeInForeground / 60000.0
                    result.putDouble(usageStat.packageName, minutes)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Get currently foreground app package name
     */
    @ReactMethod
    fun getCurrentForegroundApp(promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 10000 // Last 10 seconds

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            var recentApp: UsageStats? = null
            for (usageStat in stats) {
                if (recentApp == null || usageStat.lastTimeUsed > recentApp.lastTimeUsed) {
                    recentApp = usageStat
                }
            }

            if (recentApp != null) {
                promise.resolve(recentApp.packageName)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("FOREGROUND_APP_ERROR", e.message, e)
        }
    }

    /**
     * Start the app monitoring service
     */
    @ReactMethod
    fun startAppMonitorService(packages: ReadableArray, promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val packageList = ArrayList<String>()
            for (i in 0 until packages.size()) {
                packages.getString(i)?.let { packageList.add(it) }
            }

            val intent = Intent(reactContext, AppBlockerService::class.java).apply {
                action = "START"
                putStringArrayListExtra("packages", packageList)
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_START_ERROR", e.message, e)
        }
    }

    /**
     * Stop the app monitoring service
     */
    @ReactMethod
    fun stopAppMonitorService(promise: Promise) {
        try {
            val intent = Intent(reactContext, AppBlockerService::class.java).apply {
                action = "STOP"
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    /**
     * Update tracked packages in the running service
     */
    @ReactMethod
    fun updateMonitoredPackages(packages: ReadableArray, promise: Promise) {
        try {
            val packageList = ArrayList<String>()
            for (i in 0 until packages.size()) {
                packages.getString(i)?.let { packageList.add(it) }
            }

            val intent = Intent(reactContext, AppBlockerService::class.java).apply {
                action = "UPDATE_PACKAGES"
                putStringArrayListExtra("packages", packageList)
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_UPDATE_ERROR", e.message, e)
        }
    }

    /**
     * Check if the monitoring service is running
     */
    @ReactMethod
    fun isMonitorServiceRunning(promise: Promise) {
        try {
            promise.resolve(AppBlockerService.isServiceRunning())
        } catch (e: Exception) {
            promise.reject("SERVICE_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Update available time in SharedPreferences for native service to check
     */
    @ReactMethod
    fun updateAvailableTime(minutes: Int, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("iSparta_AppLock", Context.MODE_PRIVATE)
            prefs.edit().putInt("availableMinutes", minutes).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_TIME_ERROR", e.message, e)
        }
    }

    /**
     * Get spent minutes tracked by native service
     */
    @ReactMethod
    fun getSpentMinutesFromNative(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("iSparta_AppLock", Context.MODE_PRIVATE)
            val spentMinutes = prefs.getInt("spentMinutes", 0)
            promise.resolve(spentMinutes)
        } catch (e: Exception) {
            promise.reject("GET_SPENT_ERROR", e.message, e)
        }
    }

    /**
     * Reset native spent minutes counter (for syncing with RN)
     */
    @ReactMethod
    fun resetNativeSpentMinutes(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("iSparta_AppLock", Context.MODE_PRIVATE)
            prefs.edit().putInt("spentMinutes", 0).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESET_SPENT_ERROR", e.message, e)
        }
    }

    /**
     * Send event to React Native
     */
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * Convert drawable to base64 PNG
     */
    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = if (drawable is BitmapDrawable) {
            drawable.bitmap
        } else {
            val bitmap = Bitmap.createBitmap(
                drawable.intrinsicWidth.coerceAtLeast(1),
                drawable.intrinsicHeight.coerceAtLeast(1),
                Bitmap.Config.ARGB_8888
            )
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bitmap
        }

        // Scale down if too large
        val scaledBitmap = if (bitmap.width > 96 || bitmap.height > 96) {
            Bitmap.createScaledBitmap(bitmap, 96, 96, true)
        } else {
            bitmap
        }

        val outputStream = ByteArrayOutputStream()
        scaledBitmap.compress(Bitmap.CompressFormat.PNG, 80, outputStream)
        val byteArray = outputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    /**
     * Check if overlay (draw over apps) permission is granted
     */
    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactContext)
            } else {
                true
            }
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("OVERLAY_PERMISSION_ERROR", e.message, e)
        }
    }

    /**
     * Open overlay permission settings
     */
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OVERLAY_PERMISSION_ERROR", e.message, e)
        }
    }

    /**
     * Check if accessibility service is enabled
     */
    @ReactMethod
    fun hasAccessibilityPermission(promise: Promise) {
        try {
            val enabled = AppBlockerAccessibilityService.isServiceEnabled(reactContext)
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_PERMISSION_ERROR", e.message, e)
        }
    }

    /**
     * Open accessibility settings
     */
    @ReactMethod
    fun requestAccessibilityPermission(promise: Promise) {
        try {
            AppBlockerAccessibilityService.openAccessibilitySettings(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_PERMISSION_ERROR", e.message, e)
        }
    }
    
    /**
     * Save tracked packages to SharedPreferences for accessibility service to read
     */
    @ReactMethod
    fun saveTrackedPackagesToNative(packagesJson: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("iSparta_AppLock", Context.MODE_PRIVATE)
            prefs.edit().putString("tracked_packages", packagesJson).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_PACKAGES_ERROR", e.message, e)
        }
    }
}
