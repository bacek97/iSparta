import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, NativeModules, Dimensions } from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    VisionCameraProxy,
} from 'react-native-vision-camera';
import { NativeEventEmitter, View } from 'react-native';
import { Svg, Circle, Line, Text as SvgText } from 'react-native-svg';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import {
    extractDeepFitKeypoints,
    normalizeKeypoints,
    getExerciseName,
    updateExerciseState,
    createExerciseState,
    type Keypoint,
    type ExerciseState
} from './deepfitUtils';

const { PoseLandmarks } = NativeModules;

console.log('[PoseLandmarks] PoseLandmarks module:', PoseLandmarks);

const poseLandmarksEmitter = new NativeEventEmitter(PoseLandmarks);

// Define pose landmark connections (MediaPipe pose model has 33 landmarks)
// Based on MediaPipe Pose topology
const lines: [number, number][] = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],

    // Torso
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24],

    // Left leg
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],

    // Right leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

// Initialize the frame processor plugin 'poseLandmarks'
const poseLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin(
    'poseLandmarks',
    {},
);

console.log('[PoseLandmarks] poseLandMarkPlugin initialized:', poseLandMarkPlugin);

type PoseLandmark = {
    x: number;
    y: number;
    z: number;
    visibility: number;
    keypoint: number;
};

interface PoseCameraDemoProps {
    modelPath?: string;
}

function PoseCameraDemo({ modelPath = 'models_tflite/mediapipe/full/pose_landmarker_full.task' }: PoseCameraDemoProps) {
    const [landmarks, setLandmarks] = useState<PoseLandmark[][]>([]);
    const [pluginDeepFit, setPluginDeepFit] = useState<{ model: TensorflowModel | null }>({ model: null });
    const [exerciseState, setExerciseState] = useState<ExerciseState>(createExerciseState());
    const [exerciseName, setExerciseName] = useState<string>('');
    const device = useCameraDevice('front', {
        physicalDevices: ['ultra-wide-angle-camera']
    });
    const { hasPermission, requestPermission } = useCameraPermission();

    // Load DeepFit classifier model
    useEffect(() => {
        const loadModel = async () => {
            try {
                console.log('[PoseLandmarks] Loading DeepFit classifier...');
                const model = await loadTensorflowModel(
                    require('./models_tflite/deepfit_classifier_v3.tflite'),
                    'nnapi'
                );
                console.log('[PoseLandmarks] DeepFit classifier loaded successfully!');
                setPluginDeepFit({ model });
            } catch (error) {
                console.error('[PoseLandmarks] Failed to load DeepFit classifier:', error);
            }
        };
        loadModel();
    }, []);

    useEffect(() => {
        console.log('[PoseLandmarks] Setting up event listeners...');

        // Set up the event listener to listen for pose landmarks detection results
        const subscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksDetected',
            event => {
                console.log('[PoseLandmarks] onPoseLandmarksDetected event received!');
                console.log('[PoseLandmarks] Number of poses:', event.landmarks?.length);

                // Update the landmarks state to render them on the screen
                setLandmarks(event.landmarks || []);

                // Run DeepFit classification if model is loaded and we have landmarks
                if (pluginDeepFit.model && event.landmarks && event.landmarks[0]) {
                    const pose = event.landmarks[0];
                    // Convert PoseLandmark[] to Keypoint[] format expected by DeepFit
                    const keypoints: Keypoint[] = pose.map((landmark: PoseLandmark) => ({
                        x: landmark.x,
                        y: landmark.y,
                        confidence: landmark.visibility
                    }));

                    try {
                        // Extract 18 keypoints for DeepFit from 33 pose landmarks
                        const deepfitKeypoints = extractDeepFitKeypoints(keypoints);
                        const normalizedInput = normalizeKeypoints(deepfitKeypoints);

                        // Run DeepFit model
                        const deepfitOutputs = pluginDeepFit.model.runSync([normalizedInput]);
                        const exerciseProbs = deepfitOutputs[0] as Float32Array;

                        // Get exercise name
                        const detectedExercise = getExerciseName(exerciseProbs);
                        console.log(`[PoseLandmarks] Exercise: ${detectedExercise}`);
                        setExerciseName(detectedExercise);

                        // Update exercise state for rep counting
                        const newState = updateExerciseState(detectedExercise, exerciseState, keypoints);
                        setExerciseState(newState);
                    } catch (error) {
                        console.error('[PoseLandmarks] DeepFit classification error:', error);
                    }
                }
            },
        );

        const statusSubscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksStatus',
            event => {
                console.log('[PoseLandmarks] Status event:', JSON.stringify(event, null, 2));
            },
        );

        const errorSubscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksError',
            event => {
                console.error('[PoseLandmarks] ❌ ERROR EVENT ❌');
                console.error('[PoseLandmarks] Error event:', JSON.stringify(event, null, 2));
                console.error('[PoseLandmarks] Error message:', event.error);
            },
        );

        // Initialize the model with the provided model path
        console.log('[PoseLandmarks] Calling PoseLandmarks.initModel with path:', modelPath);
        PoseLandmarks.initModel(modelPath);

        // Clean up the event listener when the component is unmounted
        return () => {
            console.log('[PoseLandmarks] Cleaning up event listeners');
            subscription.remove();
            statusSubscription.remove();
            errorSubscription.remove();
        };
    }, [modelPath, pluginDeepFit, exerciseState]);

    useEffect(() => {
        // Request camera permission on component mount
        console.log('[PoseLandmarks] Requesting camera permission...');
        requestPermission()
            .then(granted => console.log('[PoseLandmarks] Camera permission granted:', granted))
            .catch(error => console.error('[PoseLandmarks] Camera permission error:', error));
    }, [requestPermission]);

    const frameProcessor = useFrameProcessor(frame => {
        'worklet';

        // Process the frame using the 'poseLandmarks' plugin
        try {
            if (poseLandMarkPlugin != null) {
                poseLandMarkPlugin.call(frame);
            }
        } catch (error) {
            console.error('[FrameProcessor] Error processing frame:', error);
        }
    }, []);

    if (!hasPermission) {
        console.log('[PoseLandmarks] No camera permission');
        return <Text>No permission</Text>;
    }

    if (device == null) {
        console.log('[PoseLandmarks] No camera device');
        return <Text>No device</Text>;
    }

    const pixelFormat = Platform.OS === 'ios' ? 'rgb' : 'yuv';
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;

    console.log('[PoseLandmarks] Rendering camera with device:', device.id);
    console.log('[PoseLandmarks] Current landmarks count:', landmarks.length);

    return (
        <View style={StyleSheet.absoluteFill}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                pixelFormat={pixelFormat}
            />
            {landmarks.length > 0 && (
                <Svg style={StyleSheet.absoluteFill}>
                    {landmarks.map((pose, poseIndex) => (
                        <React.Fragment key={`pose-${poseIndex}`}>
                            {/* Draw lines connecting landmarks */}
                            {lines.map(([from, to], lineIndex) => {
                                if (pose[from] && pose[to]) {
                                    // Only draw if both landmarks have good visibility
                                    const minVisibility = 0.5;
                                    if (pose[from].visibility > minVisibility && pose[to].visibility > minVisibility) {
                                        return (
                                            <Line
                                                key={`line-${poseIndex}-${lineIndex}`}
                                                x1={pose[from].x * screenWidth}
                                                y1={pose[from].y * screenHeight}
                                                x2={pose[to].x * screenWidth}
                                                y2={pose[to].y * screenHeight}
                                                stroke="lime"
                                                strokeWidth="3"
                                            />
                                        );
                                    }
                                }
                                return null;
                            })}

                            {/* Draw circles on landmarks */}
                            {pose.map((mark, markIndex) => {
                                // Only draw landmarks with good visibility
                                if (mark.visibility > 0.5) {
                                    return (
                                        <Circle
                                            key={`circle-${poseIndex}-${markIndex}`}
                                            cx={mark.x * screenWidth}
                                            cy={mark.y * screenHeight}
                                            r="8"
                                            fill="red"
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                    );
                                }
                                return null;
                            })}
                        </React.Fragment>
                    ))}

                    {/* Display exercise info */}
                    {exerciseName && (
                        <>
                            <SvgText
                                x={20}
                                y={50}
                                fontSize="24"
                                fontWeight="bold"
                                fill="white"
                                stroke="black"
                                strokeWidth="2"
                            >
                                {exerciseName}
                            </SvgText>
                            <SvgText
                                x={20}
                                y={80}
                                fontSize="20"
                                fill="white"
                                stroke="black"
                                strokeWidth="1.5"
                            >
                                Reps: {Math.floor(exerciseState.count)}
                            </SvgText>
                            <SvgText
                                x={20}
                                y={110}
                                fontSize="18"
                                fill={exerciseState.form === 1 ? "lime" : "red"}
                                stroke="black"
                                strokeWidth="1.5"
                            >
                                Form: {exerciseState.form === 1 ? 'Good' : 'Bad'}
                            </SvgText>
                            <SvgText
                                x={20}
                                y={140}
                                fontSize="18"
                                fill="yellow"
                                stroke="black"
                                strokeWidth="1.5"
                            >
                                {exerciseState.feedback}
                            </SvgText>
                            <SvgText
                                x={20}
                                y={170}
                                fontSize="18"
                                fill="cyan"
                                stroke="black"
                                strokeWidth="1.5"
                            >
                                Progress: {exerciseState.percentage.toFixed(1)}%
                            </SvgText>
                        </>
                    )}
                </Svg>
            )}
        </View>
    );
}

export default PoseCameraDemo;
