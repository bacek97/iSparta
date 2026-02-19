package com.isparta

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Activity that blocks tracked apps and shows options to earn time or take credit
 */
class AppBlockerActivity : Activity() {

    private var blockedPackage: String = ""
    private var blockedAppName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        blockedPackage = intent.getStringExtra("blocked_package") ?: ""
        blockedAppName = getAppName(blockedPackage)
        
        createUI()
    }

    private fun getAppName(packageName: String): String {
        return try {
            val pm = packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    private fun createUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#1C1C1E"))
            setPadding(60, 100, 60, 100)
        }

        // Icon/Emoji
        val iconText = TextView(this).apply {
            text = "⏰"
            textSize = 72f
            gravity = Gravity.CENTER
        }
        layout.addView(iconText)

        // Title
        val title = TextView(this).apply {
            text = "Время исчерпано"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 20)
        }
        layout.addView(title)

        // App name
        val appNameView = TextView(this).apply {
            text = blockedAppName
            textSize = 20f
            setTextColor(Color.parseColor("#FF14A7"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 40)
        }
        layout.addView(appNameView)

        // Description
        val description = TextView(this).apply {
            text = "У вас нет доступного времени для этого приложения.\n\nЗаработайте время через упражнения или возьмите кредит."
            textSize = 16f
            setTextColor(Color.parseColor("#8E8E93"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 60)
        }
        layout.addView(description)

        // Workout button
        val workoutButton = Button(this).apply {
            text = "💪 Выполнить упражнения"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#28A745"))
            setPadding(40, 30, 40, 30)
            setOnClickListener { goToWorkout() }
        }
        val workoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 0, 0, 20)
        }
        layout.addView(workoutButton, workoutParams)

        // Credit button
        val creditButton = Button(this).apply {
            text = "⏳ Взять время в кредит"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#FF14A7"))
            setPadding(40, 30, 40, 30)
            setOnClickListener { takeCredit() }
        }
        val creditParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 0, 0, 20)
        }
        layout.addView(creditButton, creditParams)

        // Cancel button
        val cancelButton = Button(this).apply {
            text = "Отмена"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#38383A"))
            setPadding(40, 30, 40, 30)
            setOnClickListener { goHome() }
        }
        val cancelParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        layout.addView(cancelButton, cancelParams)

        // Credit info
        val creditInfo = TextView(this).apply {
            text = "⚠️ Максимум 60 минут в кредит"
            textSize = 12f
            setTextColor(Color.parseColor("#FF9500"))
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 0)
        }
        layout.addView(creditInfo)

        setContentView(layout)
    }

    private fun goToWorkout() {
        // Open iSparta app on Workout tab
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("navigate_to", "Workout")
        }
        if (intent != null) {
            startActivity(intent)
        }
        finish()
    }

    private fun takeCredit() {
        // Open iSparta app on Apps tab to take credit
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("navigate_to", "Apps")
            putExtra("action", "take_credit")
            putExtra("blocked_package", blockedPackage)
        }
        if (intent != null) {
            startActivity(intent)
        }
        finish()
    }

    private fun goHome() {
        // Go to home screen
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(intent)
        finish()
    }

    override fun onBackPressed() {
        // Prevent going back to the blocked app
        goHome()
    }
}
