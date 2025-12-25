package com.isparta

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class StepCounter(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

    override fun getName(): String {
        return "StepCounter"
    }

    private var sensorManager: SensorManager? = null
    private var stepCounterSensor: Sensor? = null
    private var isListening = false
    private var initialSteps: Float = -1f

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // Required methods for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for NativeEventEmitter
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        if (isListening) {
            promise.resolve(true)
            return
        }

        try {
            val context: Context = reactApplicationContext
            sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            stepCounterSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

            if (stepCounterSensor == null) {
                promise.reject("SENSOR_NOT_AVAILABLE", "Step counter sensor is not available on this device")
                return
            }

            sensorManager?.registerListener(
                this,
                stepCounterSensor,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            isListening = true

            Log.d("StepCounter", "Started listening to step counter")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("StepCounter", "Error starting step counter", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            if (isListening && sensorManager != null) {
                sensorManager?.unregisterListener(this)
                isListening = false
                Log.d("StepCounter", "Stopped listening to step counter")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("StepCounter", "Error stopping step counter", e)
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            val context: Context = reactApplicationContext
            val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            promise.resolve(sensor != null)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
            val totalSteps = event.values[0]
            
            // Initialize baseline on first reading
            if (initialSteps < 0) {
                initialSteps = totalSteps
            }

            val params = Arguments.createMap()
            params.putDouble("totalSteps", totalSteps.toDouble())
            params.putDouble("initialSteps", initialSteps.toDouble())
            params.putDouble("sessionSteps", (totalSteps - initialSteps).toDouble())

            sendEvent("onStepCountChanged", params)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not used for step counter
    }

    @ReactMethod
    fun resetSessionSteps() {
        initialSteps = -1f
        Log.d("StepCounter", "Session steps reset")
    }

    @ReactMethod
    fun getCurrentSteps(promise: Promise) {
        try {
            val context: Context = reactApplicationContext
            val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            
            if (sensor == null) {
                promise.reject("SENSOR_NOT_AVAILABLE", "Step counter not available")
                return
            }

            // Create a one-time listener to get current value
            val listener = object : SensorEventListener {
                override fun onSensorChanged(event: SensorEvent?) {
                    if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
                        val totalSteps = event.values[0]
                        Log.d("StepCounter", "getCurrentSteps: $totalSteps")
                        sm.unregisterListener(this)
                        promise.resolve(totalSteps.toDouble())
                    }
                }
                override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
            }

            sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_FASTEST)
            
            // Timeout after 5 seconds
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                sm.unregisterListener(listener)
                // Return 0 if no event received
                promise.resolve(0.0)
            }, 5000)
        } catch (e: Exception) {
            Log.e("StepCounter", "Error getting current steps", e)
            promise.reject("GET_ERROR", e.message)
        }
    }
}
