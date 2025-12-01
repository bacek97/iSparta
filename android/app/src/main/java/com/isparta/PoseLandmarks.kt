// PoseLandmarks.kt

package com.isparta

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import android.graphics.BitmapFactory
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.OutputHandler
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

class PoseLandmarks(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PoseLandmarks"
    }

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
    fun initModel(modelPath: String) {
        // Check if the PoseLandmarker has already been initialized
        if (PoseLandmarkerHolder.poseLandmarker != null) {
            val alreadyInitializedParams = Arguments.createMap()
            alreadyInitializedParams.putString("status", "Model already initialized")
            sendEvent("onPoseLandmarksStatus", alreadyInitializedParams)
            return
        }

        // Define the result listener
        val resultListener = OutputHandler.ResultListener { result: PoseLandmarkerResult, inputImage: MPImage ->
            Log.d("PoseLandmarksFrameProcessor", "Detected ${result.landmarks().size} poses")

            // Prepare the data to be sent back to JavaScript
            val landmarksArray = Arguments.createArray()

            for (poseLandmarks in result.landmarks()) {
                val poseMap = Arguments.createArray()
                for ((index, landmark) in poseLandmarks.withIndex()) {
                    val landmarkMap = Arguments.createMap()
                    landmarkMap.putInt("keypoint", index)
                    landmarkMap.putDouble("x", landmark.x().toDouble())
                    landmarkMap.putDouble("y", landmark.y().toDouble())
                    landmarkMap.putDouble("z", landmark.z().toDouble())
                    landmarkMap.putDouble("visibility", landmark.visibility().get().toDouble())
                    poseMap.pushMap(landmarkMap)
                }
                landmarksArray.pushArray(poseMap)
            }

            val params = Arguments.createMap()
            params.putArray("landmarks", landmarksArray)
            // Send the landmarks data back to JavaScript
            sendEvent("onPoseLandmarksDetected", params)
        }

        // Initialize the Pose Landmarker
        try {
            val context: Context = reactApplicationContext
            val baseOptions = BaseOptions.builder()
                    .setModelAssetPath(modelPath)
                    .build()

            val poseLandmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
                    .setBaseOptions(baseOptions)
                    .setNumPoses(1)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setResultListener(resultListener)
                    .build()

            PoseLandmarkerHolder.poseLandmarker = PoseLandmarker.createFromOptions(context, poseLandmarkerOptions)

            // Send success event to JS
            val successParams = Arguments.createMap()
            successParams.putString("status", "Model initialized successfully")
            successParams.putString("modelPath", modelPath)
            sendEvent("onPoseLandmarksStatus", successParams)

        } catch (e: Exception) {
            Log.e("PoseLandmarksFrameProcessor", "Error initializing PoseLandmarker", e)

            // Send error event to JS
            val errorParams = Arguments.createMap()
            errorParams.putString("error", e.message)
            sendEvent("onPoseLandmarksError", errorParams)
        }
    }
    @ReactMethod
    fun detectImage(imagePath: String) {
        try {
            val context: Context = reactApplicationContext
            
            // Load image from assets
            val assetManager = context.assets
            val inputStream = assetManager.open(imagePath)
            val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
            val mpImage = BitmapImageBuilder(bitmap).build()

            // Create a dedicated PoseLandmarker for static images
            val baseOptions = BaseOptions.builder()
                    .setModelAssetPath("models_tflite/mediapipe/full/pose_landmarker_full.task")
                    .build()

            val poseLandmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
                    .setBaseOptions(baseOptions)
                    .setNumPoses(1)
                    .setRunningMode(RunningMode.IMAGE)
                    .build()

            val poseLandmarker = PoseLandmarker.createFromOptions(context, poseLandmarkerOptions)
            
            // Detect
            val result = poseLandmarker.detect(mpImage)
            
            Log.d("PoseLandmarks", "Detected ${result.landmarks().size} poses in image $imagePath")

            // Process results
            val landmarksArray = Arguments.createArray()

            for (poseLandmarks in result.landmarks()) {
                val poseMap = Arguments.createArray()
                for ((index, landmark) in poseLandmarks.withIndex()) {
                    val landmarkMap = Arguments.createMap()
                    landmarkMap.putInt("keypoint", index)
                    landmarkMap.putDouble("x", landmark.x().toDouble())
                    landmarkMap.putDouble("y", landmark.y().toDouble())
                    landmarkMap.putDouble("z", landmark.z().toDouble())
                    landmarkMap.putDouble("visibility", landmark.visibility().get().toDouble())
                    poseMap.pushMap(landmarkMap)
                }
                landmarksArray.pushArray(poseMap)
            }

            val params = Arguments.createMap()
            params.putArray("landmarks", landmarksArray)
            params.putString("imagePath", imagePath)
            
            // Send the landmarks data back to JavaScript
            sendEvent("onPoseLandmarksDetected", params)
            
            // Cleanup
            poseLandmarker.close()
            
        } catch (e: Exception) {
            Log.e("PoseLandmarks", "Error detecting image: $imagePath", e)
            val errorParams = Arguments.createMap()
            errorParams.putString("error", e.message)
            errorParams.putString("imagePath", imagePath)
            sendEvent("onPoseLandmarksError", errorParams)
        }
    }
}
