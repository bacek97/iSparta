package com.isparta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat

/**
 * Foreground service that monitors app launches and blocks tracked apps
 * Shows a full-screen overlay when blocked app is detected
 */
class AppBlockerService : Service() {

    companion object {
        private const val TAG = "AppBlockerService"
        private const val CHANNEL_ID = "app_blocker_channel"
        private const val NOTIFICATION_ID = 1001
        private const val CHECK_INTERVAL_MS = 1000L // Check every second
        private const val PREFS_NAME = "iSparta_AppLock"
        
        private var isRunning = false
        private var trackedPackages = mutableSetOf<String>()
        
        fun isServiceRunning() = isRunning
        
        fun updateTrackedPackages(packages: List<String>) {
            trackedPackages.clear()
            trackedPackages.addAll(packages)
            Log.d(TAG, "Updated tracked packages: $trackedPackages")
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var lastForegroundApp: String? = null
    private var currentTrackedApp: String? = null
    private var usageStartTime: Long = 0
    private var accumulatedSeconds: Int = 0
    private var lastBlockerLaunchTime: Long = 0
    private var lastDismissTime: Long = 0
    private val BLOCKER_COOLDOWN_MS = 3000L // 3 seconds cooldown after launching blocker
    private val DISMISS_COOLDOWN_MS = 5000L // 5 seconds grace period after manual dismissal
    
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShowing = false
    private var isClosing = false

    
    private val checkRunnable = object : Runnable {
        override fun run() {
            checkForegroundApp()
            handler.postDelayed(this, CHECK_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started with intent: ${intent?.action}")
        
        when (intent?.action) {
            "START" -> {
                val packages = intent.getStringArrayListExtra("packages") ?: arrayListOf()
                trackedPackages.clear()
                trackedPackages.addAll(packages)
                Log.d(TAG, "Starting with tracked packages: $trackedPackages")
                
                startForeground(NOTIFICATION_ID, createNotification())
                startMonitoring()
                isRunning = true
            }
            "STOP" -> {
                stopMonitoring()
                hideOverlay()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                isRunning = false
            }
            "UPDATE_PACKAGES" -> {
                val packages = intent.getStringArrayListExtra("packages") ?: arrayListOf()
                trackedPackages.clear()
                trackedPackages.addAll(packages)
                Log.d(TAG, "Updated tracked packages: $trackedPackages")
            }
        }
        
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopMonitoring()
        hideOverlay()
        isRunning = false
        Log.d(TAG, "Service destroyed")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "App Lock Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors app usage for time limits"
                setShowBadge(false)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        // Add stop action
        val stopIntent = Intent(this, AppBlockerService::class.java).apply {
            action = "STOP"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("iSparta App Lock")
            .setContentText("Monitoring ${trackedPackages.size} apps")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Blocking", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startMonitoring() {
        handler.post(checkRunnable)
        Log.d(TAG, "Monitoring started")
    }

    private fun stopMonitoring() {
        handler.removeCallbacks(checkRunnable)
        // Save any accumulated usage when stopping
        if (currentTrackedApp != null && accumulatedSeconds > 0) {
            saveUsageTime(accumulatedSeconds)
        }
        Log.d(TAG, "Monitoring stopped")
    }

    private var blockingPausedUntil: Long = 0
    private val BLOCKER_PAUSE_MS = 5000L // Pause blocking for 5 seconds after dismissal

    private fun checkForegroundApp() {
        try {
            // Check if blocking is temporarily paused
            if (System.currentTimeMillis() < blockingPausedUntil) {
                return
            }

            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 1000 * 60 // Look back 1 minute for better accuracy

            val events = usageStatsManager.queryEvents(startTime, endTime)
            var currentApp: String? = null
            
            // Get the very latest event
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                    currentApp = event.packageName
                }
            }

            // If we couldn't detect app, keep the last known one or return
            if (currentApp == null) {
                currentApp = lastForegroundApp
            }

            // Handle app change logic
            if (currentApp != null && currentApp != lastForegroundApp) {
                onAppChanged(lastForegroundApp, currentApp)
                lastForegroundApp = currentApp
            }
            
            // Safety: If iSparta is foreground, always ensuring overlay is hidden
            if (currentApp == packageName) {
                if (isOverlayShowing) {
                    dismissOverlay(null)
                }
                return
            }
            
            // BLOCKING LOGIC
            if (currentApp != null && trackedPackages.contains(currentApp)) {
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val availableMinutes = prefs.getInt("availableMinutes", 0)
                
                if (availableMinutes <= 0) {
                     // Check if we are already showing overlay for this app
                     if (!isOverlayShowing) {
                         showBlockingOverlay(currentApp)
                     }
                } else if (isOverlayShowing) {
                    // Time is available, hide overlay
                    dismissOverlay(null)
                }
                
                // Track usage if allowed
                if (availableMinutes > 0 && currentTrackedApp == currentApp) {
                    trackUsageTime()
                }
            } else if (isOverlayShowing) {
                 // Not a tracked app, hide overlay
                 dismissOverlay(null)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error checking foreground app", e)
        }
    }
    
    private fun onAppChanged(previousApp: String?, newApp: String) {
        // If leaving a tracked app, save usage
        if (previousApp != null && trackedPackages.contains(previousApp) && accumulatedSeconds > 0) {
            Log.d(TAG, "Left tracked app $previousApp, saving ${accumulatedSeconds}s usage")
            saveUsageTime(accumulatedSeconds)
            currentTrackedApp = null
            accumulatedSeconds = 0
        }
        
        // If entering a tracked app
        if (trackedPackages.contains(newApp) && newApp != packageName) {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val availableMinutes = prefs.getInt("availableMinutes", 0)
            
            Log.d(TAG, "Entering tracked app $newApp, available: ${availableMinutes}min")
            
            if (availableMinutes <= 0) {
                // No time available, block immediately
                Log.d(TAG, "No time available, blocking $newApp")
                showBlockingOverlay(newApp)
            } else {
                // Start tracking usage
                currentTrackedApp = newApp
                usageStartTime = System.currentTimeMillis()
                accumulatedSeconds = 0
                Log.d(TAG, "Started tracking usage for $newApp")
            }
        }
    }
    
    private fun trackUsageTime() {
        accumulatedSeconds++
        
        // Every 60 seconds (1 minute), decrement available time
        if (accumulatedSeconds >= 60) {
            val minutesUsed = accumulatedSeconds / 60
            accumulatedSeconds %= 60
            
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var availableMinutes = prefs.getInt("availableMinutes", 0)
            
            availableMinutes -= minutesUsed
            
            Log.d(TAG, "Spent ${minutesUsed}min on $currentTrackedApp, remaining: ${availableMinutes}min")
            
            // Save updated available time
            prefs.edit().putInt("availableMinutes", availableMinutes.coerceAtLeast(0)).apply()
            
            // Also update spent minutes counter
            var spentMinutes = prefs.getInt("spentMinutes", 0)
            spentMinutes += minutesUsed
            prefs.edit().putInt("spentMinutes", spentMinutes).apply()
            
            // Check if time ran out
            if (availableMinutes <= 0) {
                Log.d(TAG, "Time ran out! Blocking $currentTrackedApp")
                showBlockingOverlay(currentTrackedApp!!)
                currentTrackedApp = null
            }
        }
    }
    
    private fun saveUsageTime(seconds: Int) {
        if (seconds < 60) return // Only save full minutes
        
        val minutes = seconds / 60
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Update spent minutes
        var spentMinutes = prefs.getInt("spentMinutes", 0)
        spentMinutes += minutes
        prefs.edit().putInt("spentMinutes", spentMinutes).apply()
        
        // Update available minutes
        var availableMinutes = prefs.getInt("availableMinutes", 0)
        availableMinutes -= minutes
        prefs.edit().putInt("availableMinutes", availableMinutes.coerceAtLeast(0)).apply()
        
        Log.d(TAG, "Saved ${minutes}min usage, new available: ${availableMinutes}")
    }
    
    private fun showBlockingOverlay(blockedPackage: String) {
        if (isClosing) return
        if (System.currentTimeMillis() < blockingPausedUntil) return
        
        // Check overlay permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && 
            !Settings.canDrawOverlays(this)) {
            performHomeRedirect()
            Toast.makeText(this, "⏰ $blockedPackage заблокировано!", Toast.LENGTH_SHORT).show()
            return
        }
        
        handler.post {
            try {
                if (isOverlayShowing) return@post
                createAndShowOverlay(blockedPackage)
            } catch (e: Exception) {
                Log.e(TAG, "Error showing overlay", e)
                performHomeRedirect()
            }
        }
    }
    
    private fun createAndShowOverlay(blockedPackage: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF1a1a2e.toInt()) // Deep Dark Blue
            isClickable = true
            isFocusable = true
        }
        
        val iconText = TextView(this).apply {
            text = "⏰"
            textSize = 72f
            gravity = Gravity.CENTER
        }
        
        val titleText = TextView(this).apply {
            text = "Доступ ограничен"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 50, 0, 20)
        }
        
        val messageText = TextView(this).apply {
            text = "У вас нет доступного времени.\nВыполните тренировку!"
            textSize = 16f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
            setPadding(40, 0, 40, 60)
        }
        
        val matchParent = LinearLayout.LayoutParams.MATCH_PARENT
        
        val workoutButton = Button(this).apply {
            text = "💪 НАЧАТЬ ТРЕНИРОВКУ"
            textSize = 16f
            setBackgroundColor(0xFF4CAF50.toInt())
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(matchParent, dpToPx(60)).apply {
                setMargins(dpToPx(24), dpToPx(12), dpToPx(24), dpToPx(12))
            }
            setOnClickListener {
                Log.d(TAG, "BTN: Workout clicked")
                performOpenApp()
            }
        }
        
        val homeButton = Button(this).apply {
            text = "🏠 НА ГЛАВНЫЙ ЭКРАН"
            textSize = 16f
            setBackgroundColor(0xFF555555.toInt())
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(matchParent, dpToPx(50)).apply {
                setMargins(dpToPx(24), dpToPx(12), dpToPx(24), dpToPx(24))
            }
            setOnClickListener {
                Log.d(TAG, "BTN: Home clicked")
                performHomeRedirect()
            }
        }
        
        layout.addView(iconText)
        layout.addView(titleText)
        layout.addView(messageText)
        layout.addView(workoutButton)
        layout.addView(homeButton)
        
        // STANDARD FLAGS: FLAG_NOT_FOCUSABLE allows system keys to work
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) 
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY 
            else WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.CENTER

        windowManager?.addView(layout, params)
        overlayView = layout
        isOverlayShowing = true
        Log.d(TAG, "Overlay Added for $blockedPackage")
    }
    
    // Unified dismiss logic
    private fun dismissOverlay(onComplete: (() -> Unit)?) {
        if (overlayView == null) {
            onComplete?.invoke()
            return
        }

        isClosing = true
        val view = overlayView
        
        // Make invisible first
        try { view?.visibility = View.GONE } catch (e: Exception) {}

        handler.post {
            try {
                if (view != null && view.isAttachedToWindow) {
                    windowManager?.removeViewImmediate(view)
                } else if (view != null) {
                    windowManager?.removeView(view)
                }
                Log.d(TAG, "Overlay Removed")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay", e)
            } finally {
                overlayView = null
                isOverlayShowing = false
                isClosing = false
                onComplete?.invoke()
            }
        }
    }
    
    private fun performHomeRedirect() {
        Log.d(TAG, "Action: Going Home")
        blockingPausedUntil = System.currentTimeMillis() + BLOCKER_PAUSE_MS
        dismissOverlay {
            goToHomeScreen()
        }
    }
    
    private fun performOpenApp() {
        Log.d(TAG, "Action: Opening iSparta")
        blockingPausedUntil = System.currentTimeMillis() + BLOCKER_PAUSE_MS
        dismissOverlay {
            openISparta()
        }
    }

    private fun hideOverlay() {
        dismissOverlay(null)
    }
    
    private fun goToHomeScreen() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(homeIntent)
    }
    
    private fun openISparta() {
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        if (intent != null) startActivity(intent)
    }
    
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}
