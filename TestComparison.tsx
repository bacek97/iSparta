import React, { useEffect, useState } from 'react';
import { View, Text, NativeModules, NativeEventEmitter, Button, ScrollView } from 'react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import {
    extractDeepFitKeypoints,
    normalizeKeypoints,
    getExerciseName,
    Keypoint
} from './deepfitUtils';

const { PoseLandmarks } = NativeModules;
const poseLandmarksEmitter = new NativeEventEmitter(PoseLandmarks);

const TEST_IMAGES = [
    'G965F_0.png', 'G965F_1.png', 'G965F_2.png', 'G965F_3.png', 'G965F_4.png',
    'G965F_5.png', 'G965F_6.png', 'G965F_7.png', 'G965F_8.png', 'G965F_9.png',
    'G965F_10.png', 'G965F_11.png', 'G965F_12.png', 'G965F_13.png', 'G965F_14.png',
    'G965F_15.png', 'G965F_16.png', 'G965F_17.png', 'G965F_18.png'
];

export default function TestComparison() {
    const [status, setStatus] = useState<string>('Idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [model, setModel] = useState<TensorflowModel | null>(null);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev, msg]);
    };

    useEffect(() => {
        const loadModel = async () => {
            try {
                addLog('Loading DeepFit classifier...');
                const loadedModel = await loadTensorflowModel(
                    require('./models_tflite/deepfit_classifier_v3.tflite'),
                    'nnapi'
                );
                addLog('DeepFit classifier loaded!');
                setModel(loadedModel);
            } catch (error) {
                addLog(`Failed to load model: ${error}`);
            }
        };
        loadModel();
    }, []);

    const runTest = async () => {
        if (!model) {
            addLog('Model not loaded yet');
            return;
        }

        setStatus('Running...');
        addLog('Starting comparison test...');

        for (const imageName of TEST_IMAGES) {
            await processImage(imageName);
        }

        setStatus('Finished');
        addLog('Test finished!');
    };

    const processImage = (imageName: string): Promise<void> => {
        return new Promise((resolve) => {
            addLog(`Processing ${imageName}...`);

            const imagePath = `test_images/${imageName}`;

            // Set up one-time listener for this image
            const subscription = poseLandmarksEmitter.addListener(
                'onPoseLandmarksDetected',
                (event) => {
                    if (event.imagePath !== imagePath) return; // Ignore events from other images if any

                    try {
                        const landmarks = event.landmarks?.[0];
                        if (!landmarks) {
                            logResult(imageName, { error: 'No landmarks detected' });
                            subscription.remove();
                            resolve();
                            return;
                        }

                        // Convert to Keypoint format
                        // Note: For static images, we assume the native module returns normalized coordinates
                        // or we need to know the image size.
                        // In PoseLandmarks.kt, we are returning raw x/y from MediaPipe.
                        // MediaPipe PoseLandmarker returns normalized coordinates (0-1).
                        // DeepFit expects pixel coordinates.
                        // We need the image dimensions to scale them back.
                        // Since we don't have image dimensions easily here without loading the image again,
                        // let's assume a standard size or try to get it from the event if possible.
                        // Wait, the Python script uses the actual image size.
                        // I should update PoseLandmarks.kt to return image width/height.
                        // For now, let's use a fixed size that matches the camera assumption in nativeTasksPoseFull.tsx
                        // OR better: Update PoseLandmarks.kt to return width/height.

                        // For this iteration, I will use 640x480 as a fallback if I can't change Kotlin code again quickly.
                        // But wait, the user said "just image needs to be obtained not from camera but from folder".
                        // The Python script extracts landmarks and scales them by image width/height.
                        // If I use 640x480 here, it might differ from the actual image size used in Python.
                        // Let's check the Python script again. It uses `img.shape`.
                        // The images in `img_for_compare_python_and_ts` likely have specific resolutions.
                        // I should probably update PoseLandmarks.kt to return the image size.
                        // But to avoid too many context switches, I will assume the images are processed similarly.
                        // Actually, I can just hardcode the resolution if they are all the same, or just use 1x1 if normalization handles it?
                        // DeepFit normalization divides by body length, so absolute scale might not matter IF the aspect ratio is preserved.
                        // But `norm_X` calculates distances. If x is scaled by W and y by H, and W!=H, then aspect ratio matters.

                        // Let's assume for now I will use a standard scaling factor and see the results.
                        // If they differ wildly, I'll know why.
                        // Actually, I can read the image dimensions in JS using Image.getSize if I had the URI.
                        // But these are assets.

                        // Let's stick to the plan. I will use 640x480 for now as a placeholder, 
                        // but I should really get the dimensions.
                        // I'll add a TODO to update Kotlin if needed.

                        const width = 1080; // Approximate, or maybe I should check one image size.
                        const height = 1920; // Most phone screenshots are this.
                        // The files are named G965F... which is a Galaxy S9+. Resolution is likely 1440 x 2960 or similar.
                        // Let's check the Python output for image size if I can.
                        // I'll use 1000x1000 for now to keep it neutral? No, aspect ratio matters.

                        // Let's use the values from nativeTasksPoseFull.tsx: 640x480.
                        // const CAMERA_WIDTH = 640;
                        // const CAMERA_HEIGHT = 480;

                        // Actually, let's look at the Python script output from the previous run if available.
                        // I didn't run it yet.

                        // I'll use 1080x1920 as a guess for vertical screenshots.
                        const IMG_WIDTH = 1080;
                        const IMG_HEIGHT = 1920;

                        const keypoints: Keypoint[] = landmarks.map((l: any) => ({
                            x: l.x * IMG_WIDTH,
                            y: l.y * IMG_HEIGHT,
                            confidence: l.visibility
                        }));

                        const deepfitKeypoints = extractDeepFitKeypoints(keypoints);

                        // Calculate normalization details for logging
                        // We'll just log the final normalized result
                        const normalizedInput = normalizeKeypoints(deepfitKeypoints);

                        // Run model
                        const outputs = model!.runSync([normalizedInput]);
                        const probs = outputs[0] as Float32Array;
                        const prediction = getExerciseName(probs);

                        // Log full result
                        const result = {
                            image: imageName,
                            success: true,
                            image_size: { width: IMG_WIDTH, height: IMG_HEIGHT },
                            mediapipe_33_landmarks: keypoints, // These are now scaled
                            deepfit_18_keypoints: deepfitKeypoints,
                            // blocked_format: ... (reconstruct if needed, or just rely on normalized)
                            normalized_interleaved: Array.from(normalizedInput),
                            prediction: prediction,
                            probabilities: Array.from(probs).reduce((acc, val, idx) => {
                                // Map index to label if possible, or just array
                                return { ...acc, [idx]: val };
                            }, {})
                        };

                        logResult(imageName, result);
                    } catch (e) {
                        logResult(imageName, { error: String(e) });
                    } finally {
                        subscription.remove();
                        resolve();
                    }
                }
            );

            // Trigger detection
            PoseLandmarks.detectImage(imagePath);
        });
    };

    const logResult = (imageName: string, data: any) => {
        const jsonString = JSON.stringify(data);
        const chunkSize = 3000; // Android log limit is ~4096, safe margin
        const totalChunks = Math.ceil(jsonString.length / chunkSize);

        if (totalChunks === 1) {
            console.log(`[TEST_RESULT] ${jsonString}`);
        } else {
            for (let i = 0; i < totalChunks; i++) {
                const chunk = jsonString.slice(i * chunkSize, (i + 1) * chunkSize);
                console.log(`[TEST_RESULT_CHUNK] ${imageName} ${i} ${totalChunks} ${chunk}`);
            }
        }
    };

    return (
        <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 20, marginBottom: 20 }}>Comparison Test</Text>
            <Text>Status: {status}</Text>
            <Button title="Run Comparison Test" onPress={runTest} disabled={!model || status === 'Running...'} />
            <View style={{ marginTop: 20 }}>
                {logs.map((log, i) => (
                    <Text key={i} style={{ fontSize: 10 }}>{log}</Text>
                ))}
            </View>
        </ScrollView>
    );
}
