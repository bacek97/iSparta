package com.isparta

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Accessibility Service that blocks tracked apps by detecting window changes
 * and showing a full-screen overlay when a blocked app is detected
 */
class AppBlockerAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "AppBlockerA11yService"
        private const val PREFS_NAME = "iSparta_AppLock"
        private const val TRACKED_APPS_KEY = "tracked_packages"
        
        private var instance: AppBlockerAccessibilityService? = null
        
        fun isServiceEnabled(context: Context): Boolean {
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            
            return enabledServices.contains(context.packageName)
        }
        
        fun openAccessibilitySettings(context: Context) {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShowing = false
    private var currentBlockedPackage: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
        serviceInfo = info
        
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        
        Log.d(TAG, "Accessibility Service connected")
    }

    private var blockingPausedUntil: Long = 0
    private val BLOCKER_PAUSE_MS = 5000L // Pause blocking for 5 seconds after dismissal

    // Unified check in onAccessibilityEvent
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        
        // Check if blocking is temporarily paused
        if (System.currentTimeMillis() < blockingPausedUntil) {
            return
        }
        
        val packageName = event.packageName?.toString() ?: return
        
        // Ignore our own app and system UI
        if (packageName == this.packageName || 
            packageName.startsWith("com.android.systemui") ||
            packageName == "com.android.launcher" ||
            packageName.contains("launcher")) {
            
            // Safety: If iSparta is foreground, always ensuring overlay is hidden
            if (packageName == this.packageName && isOverlayShowing) {
                 dismissOverlay(null)
            }
            return
        }
        
        // Check if this is a tracked app
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val trackedAppsJson = prefs.getString(TRACKED_APPS_KEY, "[]") ?: "[]"
        
        // Simple check - look for package name in the JSON
        if (!trackedAppsJson.contains(packageName)) {
            // Not a tracked app, hide overlay if showing
            if (isOverlayShowing) {
                dismissOverlay(null)
            }
            return
        }
        
        // Check available time
        val availableMinutes = prefs.getInt("availableMinutes", 0)
        
        Log.d(TAG, "Tracked app detected: $packageName, available: $availableMinutes")
        
        if (availableMinutes <= 0) {
            // No time available - show blocking overlay
            if (!isOverlayShowing) {
                currentBlockedPackage = packageName
                showBlockingOverlay(packageName)
            }
        } else {
            // Time available - hide overlay if showing
            if (isOverlayShowing) {
                dismissOverlay(null)
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted")
        dismissOverlay(null)
    }

    override fun onDestroy() {
        super.onDestroy()
        dismissOverlay(null)
        instance = null
        Log.d(TAG, "Accessibility Service destroyed")
    }

    private fun showBlockingOverlay(blockedPackage: String) {
        if (isClosing) return
        if (System.currentTimeMillis() < blockingPausedUntil) return
        
        // Check overlay permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && 
            !Settings.canDrawOverlays(this)) {
            performHomeRedirect()
            return
        }
        
        if (isOverlayShowing) return
        
        try {
            // Create overlay layout programmatically
            val layout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundColor(0xFF1a1a2e.toInt()) // Deep Dark Blue
                isClickable = true
                isFocusable = true
            }
            
            val titleText = TextView(this).apply {
                text = "Доступ ограничен"
                textSize = 28f
                setTextColor(0xFFFFFFFF.toInt())
                gravity = Gravity.CENTER
                setPadding(0, 50, 0, 20)
            }
            
            val messageText = TextView(this).apply {
                text = "У вас нет доступного времени.\nВыполните тренировку!"
                textSize = 16f
                setTextColor(0xFFCCCCCC.toInt())
                gravity = Gravity.CENTER
                setPadding(40, 0, 40, 60)
            }
            
            val matchParent = LinearLayout.LayoutParams.MATCH_PARENT
            
            val workoutButton = Button(this).apply {
                text = "💪 НАЧАТЬ ТРЕНИРОВКУ"
                textSize = 16f
                setBackgroundColor(0xFF4CAF50.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(matchParent, dpToPx(60)).apply {
                    setMargins(dpToPx(24), dpToPx(12), dpToPx(24), dpToPx(12))
                }
                setOnClickListener {
                    performOpenApp()
                }
            }
            
            val homeButton = Button(this).apply {
                text = "🏠 НА ГЛАВНЫЙ ЭКРАН"
                textSize = 16f
                setBackgroundColor(0xFF555555.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(matchParent, dpToPx(50)).apply {
                    setMargins(dpToPx(24), dpToPx(12), dpToPx(24), dpToPx(24))
                }
                setOnClickListener {
                    performHomeRedirect()
                }
            }
            
            layout.addView(titleText)
            layout.addView(messageText)
            layout.addView(workoutButton)
            layout.addView(homeButton)
            
            val params = WindowManager.LayoutParams().apply {
                width = WindowManager.LayoutParams.MATCH_PARENT
                height = WindowManager.LayoutParams.MATCH_PARENT
                type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }
                // STANDARD FLAGS: FLAG_NOT_FOCUSABLE allows system keys to work
                flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                format = PixelFormat.TRANSLUCENT
                gravity = Gravity.CENTER
            }
            
            windowManager?.addView(layout, params)
            overlayView = layout
            isOverlayShowing = true
            
            Log.d(TAG, "Blocking overlay shown for: $blockedPackage")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error showing overlay", e)
            performHomeRedirect()
        }
    }

    private var isClosing = false
    
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

        // Remove view immediately if possible, but safely
        try {
            if (view != null && view.isAttachedToWindow) {
                windowManager?.removeViewImmediate(view)
            } else if (view != null) {
                windowManager?.removeView(view)
            }
        } catch (e: Exception) {
             Log.e(TAG, "Error removing overlay", e)
        } finally {
            overlayView = null
            isOverlayShowing = false
            currentBlockedPackage = null
            isClosing = false
            onComplete?.invoke()
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
        if (intent != null) {
            startActivity(intent)
        }
    }
    
    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }
}
