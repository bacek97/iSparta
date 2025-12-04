import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, NativeModules, Dimensions, TouchableOpacity, Alert } from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    VisionCameraProxy,
    runAtTargetFps,
} from 'react-native-vision-camera';
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { NativeEventEmitter, View } from 'react-native';
import { Svg, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
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
import {
    startWorkoutSession,
    handleExerciseChange,
    completeWorkoutSession,
    getCurrentSession,
    incrementCurrentExerciseDuration,
} from './exerciseTrackingService';
import { updateCurrentWeekNRA } from './nraCalculationService';
import { moveToNextDay, moveToPreviousDay, getDateInfo } from './testingUtils';
import { loadUserProfile, createDefaultProfile } from './storageService';
import { getExerciseConfig } from './types';

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
    onNavigateToProfile?: () => void;
}

function WorkoutScreen({ modelPath = 'models_tflite/mediapipe/full/pose_landmarker_full.task', onNavigateToProfile }: PoseCameraDemoProps) {
    const [landmarks, setLandmarks] = useState<PoseLandmark[][]>([]);
    const [pluginDeepFit, setPluginDeepFit] = useState<{ model: TensorflowModel | null }>({ model: null });

    // Map-based exercise state management - each exercise maintains its own state
    const [exerciseStates, setExerciseStates] = useState<Map<string, ExerciseState>>(new Map());

    const [exerciseName, setExerciseName] = useState<string>('');
    const [previousExerciseName, setPreviousExerciseName] = useState<string>('');
    const [sessionActive, setSessionActive] = useState<boolean>(false);
    const [userId, setUserId] = useState<string>('');
    const [dateInfo, setDateInfo] = useState<string>('');
    const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

    // Exercise name debouncing buffer (similar to DeepFit's frame_queue)
    // DeepFit uses 250 frames, we use 45 frames (~1.5 seconds at 30 FPS)
    const [exerciseBuffer, setExerciseBuffer] = useState<string[]>([]);
    const fps = 5;
    const EXERCISE_BUFFER_SIZE = fps * 1.5;

    // Rotation angle: 0, 90, 180, or 270 degrees
    // DeepFit model expects landscape orientation (width > height)
    const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(0);

    // Flip options for mirroring coordinates
    const [flipX, setFlipX] = useState<boolean>(false);
    const [flipY, setFlipY] = useState<boolean>(false);

    const device = useCameraDevice('front', {
        physicalDevices: ['ultra-wide-angle-camera']
    });
    const { hasPermission, requestPermission } = useCameraPermission();

    // Shared value for duration tracking (incremented in worklet at 1 FPS)
    const durationTick = useSharedValue(0);

    // Initialize user profile and load DeepFit classifier model
    useEffect(() => {
        const initialize = async () => {
            try {
                // Load or create user profile
                let profile = await loadUserProfile();
                if (!profile) {
                    profile = await createDefaultProfile();
                }
                setUserId(profile.id);

                // Update date info
                const info = await getDateInfo();
                setDateInfo(info);

                console.log('[WorkoutScreen] Loading DeepFit classifier...');
                const model = await loadTensorflowModel(
                    require('./models_tflite/deepfit_classifier_v3.tflite'),
                    'nnapi'
                );
                console.log('[WorkoutScreen] DeepFit classifier loaded successfully!');
                setPluginDeepFit({ model });
            } catch (error) {
                console.error('[WorkoutScreen] Initialization error:', error);
            }
        };
        initialize();
    }, []);



    // Transform keypoints based on rotation angle and flip options
    // Applies coordinate transformation for 0°, 90°, 180°, or 270° rotation, then applies flip
    const transformKeypointsForLandscape = (keypoints: Keypoint[], width: number, height: number): Keypoint[] => {
        return keypoints.map(kp => {
            let newX: number = kp.x;
            let newY: number = kp.y;

            // Apply rotation first
            switch (rotationAngle) {
                case 90:
                    // Rotate 90° clockwise: (x, y) -> (height - y, x)
                    newX = height - kp.y;
                    newY = kp.x;
                    break;
                case 180:
                    // Rotate 180°: (x, y) -> (width - x, height - y)
                    newX = width - kp.x;
                    newY = height - kp.y;
                    break;
                case 270:
                    // Rotate 270° clockwise (90° counter-clockwise): (x, y) -> (y, width - x)
                    newX = kp.y;
                    newY = width - kp.x;
                    break;
                case 0:
                default:
                    newX = kp.x;
                    newY = kp.y;
                    break;
            }

            // Apply flip transformations after rotation
            // Determine dimensions after rotation
            const effectiveWidth = (rotationAngle === 90 || rotationAngle === 270) ? height : width;
            const effectiveHeight = (rotationAngle === 90 || rotationAngle === 270) ? width : height;

            if (flipX) {
                newX = effectiveWidth - newX;
            }
            if (flipY) {
                newY = effectiveHeight - newY;
            }

            return {
                x: newX,
                y: newY,
                confidence: kp.confidence
            };
        });
    };

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

                    // CRITICAL: Use camera frame dimensions to match Python's approach
                    // MediaPipe outputs normalized 0-1 coordinates
                    // Python multiplies by camera width/height (e.g., 640x480)
                    // We use a typical camera resolution - this will be close enough
                    // since the model was trained with similar aspect ratios
                    const CAMERA_WIDTH = 640;   // Typical camera width
                    const CAMERA_HEIGHT = 480;  // Typical camera height

                    // Convert PoseLandmark[] to Keypoint[] format with camera-scaled coordinates
                    // Convert PoseLandmark[] to Keypoint[] format with camera-scaled coordinates
                    let keypoints: Keypoint[] = pose.map((landmark: PoseLandmark) => ({
                        x: landmark.x * CAMERA_WIDTH,   // Scale by camera width
                        y: landmark.y * CAMERA_HEIGHT,  // Scale by camera height
                        confidence: landmark.visibility
                    }));
                    // Transform to landscape orientation if rotation key is enabled
                    // DeepFit model ALWAYS requires landscape orientation (width > height)
                    keypoints = transformKeypointsForLandscape(keypoints, CAMERA_WIDTH, CAMERA_HEIGHT);

                    try {
                        // Extract 18 keypoints for DeepFit from 33 pose landmarks
                        const deepfitKeypoints = extractDeepFitKeypoints(keypoints);
                        const normalizedInput = normalizeKeypoints(deepfitKeypoints);

                        // Run DeepFit model
                        const deepfitOutputs = pluginDeepFit.model.runSync([normalizedInput]);
                        const exerciseProbs = deepfitOutputs[0] as Float32Array;

                        // Get raw exercise name from model
                        const detectedResult = getExerciseName(exerciseProbs);
                        const detectedExercise = detectedResult.name;
                        const confidence = detectedResult.maxValue;

                        // Add to buffer and get smoothed exercise name (majority voting)
                        // This prevents flickering between exercises due to misclassification
                        const newBuffer = [...exerciseBuffer, detectedExercise];
                        if (newBuffer.length > EXERCISE_BUFFER_SIZE) {
                            newBuffer.shift(); // Remove oldest
                        }
                        setExerciseBuffer(newBuffer);

                        // Get most common exercise from buffer (like DeepFit's max(set(frame_queue), key=frame_queue.count))
                        const exerciseCounts: Record<string, number> = {};
                        newBuffer.forEach(ex => {
                            exerciseCounts[ex] = (exerciseCounts[ex] || 0) + 1;
                        });
                        const smoothedExercise = Object.entries(exerciseCounts).reduce((a, b) =>
                            exerciseCounts[a[0]] > exerciseCounts[b[0]] ? a : b
                        )[0];

                        console.log(`[PoseLandmarks] Raw: ${detectedExercise}, Smoothed: ${smoothedExercise}, Confidence: ${confidence.toFixed(4)} (buffer: ${newBuffer.length})`);

                        // Handle exercise change
                        if (previousExerciseName && previousExerciseName !== smoothedExercise) {
                            console.log(`[WorkoutScreen] Exercise changed: ${previousExerciseName} -> ${smoothedExercise}`);

                            // Notify tracking service if session is active
                            if (sessionActive) {
                                const previousState = exerciseStates.get(previousExerciseName) || createExerciseState();
                                const reps = Math.floor(previousState.count);
                                handleExerciseChange(smoothedExercise, confidence, reps).catch(err =>
                                    console.error('[WorkoutScreen] Error handling exercise change:', err)
                                );
                            }
                        } else if (!previousExerciseName && smoothedExercise) {
                            // First exercise detection
                            console.log(`[WorkoutScreen] First exercise detected: ${smoothedExercise}`);

                            // Notify tracking service if session is active
                            if (sessionActive) {
                                handleExerciseChange(smoothedExercise, confidence, 0).catch(err =>
                                    console.error('[WorkoutScreen] Error handling exercise change:', err)
                                );
                            }
                        }

                        setPreviousExerciseName(smoothedExercise);
                        setExerciseName(smoothedExercise);

                        // Update exercise state for rep counting (skip for Unknown)
                        if (smoothedExercise !== 'Unknown') {
                            const newStateMap = updateExerciseState(smoothedExercise, exerciseStates, keypoints);
                            setExerciseStates(newStateMap);

                            // Update reps in tracking service if session is active
                            if (sessionActive) {
                                const currentState = newStateMap.get(smoothedExercise) || createExerciseState();
                                const reps = Math.floor(currentState.count);
                                // Update reps without changing exercise
                                if (previousExerciseName === smoothedExercise) {
                                    handleExerciseChange(smoothedExercise, confidence, reps).catch(err =>
                                        console.error('[WorkoutScreen] Error updating reps:', err)
                                    );
                                }
                            }
                        }



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
    }, [modelPath, pluginDeepFit, exerciseStates]);
    const { resize } = useResizePlugin();

    useEffect(() => {
        // Request camera permission on component mount
        console.log('[PoseLandmarks] Requesting camera permission...');
        requestPermission()
            .then(granted => console.log('[PoseLandmarks] Camera permission granted:', granted))
            .catch(error => console.error('[PoseLandmarks] Camera permission error:', error));
    }, [requestPermission]);

    // Create JS bridge for incrementCurrentExerciseDuration
    const incrementDuration = useRunOnJS(incrementCurrentExerciseDuration, []);

    const frameProcessor = useFrameProcessor(frame => {
        'worklet';

        runAtTargetFps(fps, () => {
            'worklet';
            // Process the frame using the 'poseLandmarks' plugin
            try {

                if (poseLandMarkPlugin != null) {
                    poseLandMarkPlugin.call(frame);
                }
            } catch (error) {
                console.error('[FrameProcessor] Error processing frame:', error);
            }
        });

        // Duration tracker at 1 FPS - only runs during active session
        runAtTargetFps(1, () => {
            'worklet';
            if (sessionActive) {
                incrementDuration();
            }
        });
    }, [sessionActive, incrementDuration]);

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

    // Helper function to transform display coordinates based on rotation angle and flip
    // Takes normalized coordinates (0-1) and returns screen coordinates
    const transformDisplayCoordinates = (x: number, y: number): { x: number, y: number } => {
        let newX: number = x;
        let newY: number = y;

        // Apply rotation first
        switch (rotationAngle) {
            case 90:
                // Rotate 90° clockwise: (x, y) -> (1 - y, x)
                newX = 1 - y;
                newY = x;
                break;
            case 180:
                // Rotate 180°: (x, y) -> (1 - x, 1 - y)
                newX = 1 - x;
                newY = 1 - y;
                break;
            case 270:
                // Rotate 270° clockwise: (x, y) -> (y, 1 - x)
                newX = y;
                newY = 1 - x;
                break;
            case 0:
            default:
                newX = x;
                newY = y;
                break;
        }

        // Apply flip transformations after rotation
        if (flipX) {
            newX = 1 - newX;
        }
        if (flipY) {
            newY = 1 - newY;
        }

        return { x: newX * screenWidth, y: newY * screenHeight };
    };

    // Select 640x480 format to match DeepFit training data
    const selectedFormat = device.formats.find(
        (f) => f.videoWidth === 640 && f.videoHeight === 480
    ) || device.formats[0];

    console.log('[PoseLandmarks] Rendering camera with device:', device.id);
    console.log('[PoseLandmarks] Selected camera format:', {
        width: selectedFormat.videoWidth,
        height: selectedFormat.videoHeight,
        fps: selectedFormat.maxFps
    });
    console.log('[PoseLandmarks] Current landmarks count:', landmarks.length);

    return (
        <View style={StyleSheet.absoluteFill}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                pixelFormat={pixelFormat}
                format={selectedFormat}
                zoom={1}
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
                                        const fromCoords = transformDisplayCoordinates(pose[from].x, pose[from].y);
                                        const toCoords = transformDisplayCoordinates(pose[to].x, pose[to].y);
                                        return (
                                            <Line
                                                key={`line-${poseIndex}-${lineIndex}`}
                                                x1={fromCoords.x}
                                                y1={fromCoords.y}
                                                x2={toCoords.x}
                                                y2={toCoords.y}
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
                                    const coords = transformDisplayCoordinates(mark.x, mark.y);
                                    return (
                                        <Circle
                                            key={`circle-${poseIndex}-${markIndex}`}
                                            cx={coords.x}
                                            cy={coords.y}
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
                    {exerciseName && (() => {
                        const currentState = exerciseStates.get(exerciseName) || createExerciseState();
                        const isUnknown = exerciseName === 'Unknown';

                        return (
                            <>
                                {/* Background for exercise name */}
                                <Rect
                                    x={10}
                                    y={20}
                                    width={300}
                                    height={50}
                                    fill={isUnknown ? "gray" : "black"}
                                    opacity={0.6}
                                    rx={8}
                                />
                                <SvgText
                                    x={20}
                                    y={55}
                                    fontSize="36"
                                    fontWeight="bold"
                                    fill={isUnknown ? "lightgray" : "white"}
                                    stroke="black"
                                    strokeWidth="2"
                                >
                                    {isUnknown ? "Неизвестно" : exerciseName}
                                </SvgText>

                                {/* Show exercise stats only when not Unknown */}
                                {!isUnknown && (
                                    <>
                                        {/* Background for reps */}
                                        <Rect
                                            x={10}
                                            y={75}
                                            width={200}
                                            height={40}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={105}
                                            fontSize="28"
                                            fontWeight="bold"
                                            fill="white"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Reps: {Math.floor(currentState.count)}
                                        </SvgText>
                                        {/* Background for form */}
                                        <Rect
                                            x={10}
                                            y={120}
                                            width={180}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={148}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill={currentState.form === 1 ? "lime" : "red"}
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Form: {currentState.form === 1 ? 'Good' : 'Bad'}
                                        </SvgText>
                                        {/* Background for feedback */}
                                        <Rect
                                            x={10}
                                            y={163}
                                            width={280}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={191}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill="yellow"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            {currentState.feedback}
                                        </SvgText>
                                        {/* Background for progress */}
                                        <Rect
                                            x={10}
                                            y={206}
                                            width={250}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={234}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill="cyan"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Progress: {currentState.percentage.toFixed(1)}%
                                        </SvgText>

                                        {/* Vertical Progress Bar */}
                                        {currentState.form === 1 && (
                                            <>
                                                {/* Progress bar background (outline) */}
                                                <Rect
                                                    x={screenWidth - 70}
                                                    y={50}
                                                    width={50}
                                                    height={300}
                                                    fill="none"
                                                    stroke={
                                                        exerciseName === 'squats' ? '#00ff00' :
                                                            exerciseName === 'pushups' ? '#00bfff' :
                                                                exerciseName === 'lunges' ? '#ff6b00' :
                                                                    exerciseName === 'situps' ? '#ff00ff' :
                                                                        exerciseName === 'bicep_curls' ? '#ffff00' :
                                                                            '#00ff00'
                                                    }
                                                    strokeWidth="3"
                                                />
                                                {/* Progress bar fill (fills from bottom to top) */}
                                                <Rect
                                                    x={screenWidth - 70}
                                                    y={50 + (300 * (100 - currentState.percentage) / 100)}
                                                    width={50}
                                                    height={300 * currentState.percentage / 100}
                                                    fill={
                                                        exerciseName === 'squats' ? '#00ff00' :
                                                            exerciseName === 'pushups' ? '#00bfff' :
                                                                exerciseName === 'lunges' ? '#ff6b00' :
                                                                    exerciseName === 'situps' ? '#ff00ff' :
                                                                        exerciseName === 'bicep_curls' ? '#ffff00' :
                                                                            '#00ff00'
                                                    }
                                                    opacity={0.8}
                                                />
                                                {/* Percentage text on progress bar */}
                                                <SvgText
                                                    x={screenWidth - 45}
                                                    y={370}
                                                    fontSize="20"
                                                    fontWeight="bold"
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth="2"
                                                    textAnchor="middle"
                                                >
                                                    {Math.round(currentState.percentage)}%
                                                </SvgText>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </Svg>
            )}

            {/* Persistent Exercise Counters - Always visible */}
            <View style={styles.persistentCounters}>
                <View style={styles.counterBox}>
                    <Text style={styles.counterLabel}>Squats</Text>
                    <Text style={styles.counterValue}>
                        {Math.floor((exerciseStates.get('squats')?.count || 0))}
                    </Text>
                </View>
                <View style={styles.counterBox}>
                    <Text style={styles.counterLabel}>Pushups</Text>
                    <Text style={styles.counterValue}>
                        {Math.floor((exerciseStates.get('pushups')?.count || 0))}
                    </Text>
                </View>
            </View>

            {/* Control buttons */}
            <View style={styles.buttonContainer}>
                {/* Session control */}
                <TouchableOpacity
                    style={[styles.button, sessionActive ? styles.buttonDanger : styles.buttonSuccess]}
                    onPress={async () => {
                        if (sessionActive) {
                            // End session - complete and save
                            console.log('[WorkoutScreen] Ending session...');
                            const session = await completeWorkoutSession();
                            if (session) {
                                await updateCurrentWeekNRA();
                                Alert.alert('Session Complete', `Saved ${session.exercises.length} exercises!\n\nSession data:\n${JSON.stringify(session, null, 2)}`);
                            }
                            setSessionActive(false);
                            setSessionStartTime(null);
                            // Reset exercise states
                            setExerciseStates(new Map());
                            setPreviousExerciseName('');
                        } else {
                            // Start session
                            if (userId) {
                                await startWorkoutSession(userId);
                                setSessionActive(true);
                                setSessionStartTime(new Date());
                                Alert.alert('Session Started', 'Start exercising!');
                            }
                        }
                    }}
                >
                    <Text style={styles.buttonText}>
                        {sessionActive ? 'End Session' : 'Start Session'}
                    </Text>
                </TouchableOpacity>

                {/* Profile button */}
                {onNavigateToProfile && (
                    <TouchableOpacity
                        style={[styles.button, styles.buttonProfile]}
                        onPress={onNavigateToProfile}
                    >
                        <Text style={styles.buttonText}>👤 Профиль</Text>
                    </TouchableOpacity>
                )}

                {/* Testing buttons */}
                <View style={styles.testingButtons}>
                    <TouchableOpacity
                        style={[styles.button, styles.buttonInfo]}
                        onPress={async () => {
                            const newDate = await moveToNextDay();
                            const info = await getDateInfo();
                            setDateInfo(info);
                            Alert.alert('Next Day', `Moved to: ${newDate.toLocaleDateString()}`);
                        }}
                    >
                        <Text style={styles.buttonText}>NextDay</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonWarning]}
                        onPress={async () => {
                            const newDate = await moveToPreviousDay();
                            const info = await getDateInfo();
                            setDateInfo(info);
                            Alert.alert('Previous Day', `Moved to: ${newDate.toLocaleDateString()}`);
                        }}
                    >
                        <Text style={styles.buttonText}>Ctrl+Z</Text>
                    </TouchableOpacity>
                </View>

                {/* Rotation angle selector */}
                <TouchableOpacity
                    style={[styles.button, styles.buttonRotation]}
                    onPress={() => {
                        // Cycle through rotation angles: 0 -> 90 -> 180 -> 270 -> 0
                        const angles: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
                        const currentIndex = angles.indexOf(rotationAngle);
                        const nextIndex = (currentIndex + 1) % angles.length;
                        setRotationAngle(angles[nextIndex]);
                    }}
                >
                    <Text style={styles.buttonText}>
                        🔄 Rotation: {rotationAngle}°
                    </Text>
                </TouchableOpacity>

                {/* Flip controls */}
                <View style={styles.testingButtons}>
                    <TouchableOpacity
                        style={[styles.button, flipX ? styles.buttonSuccess : styles.buttonInfo]}
                        onPress={() => setFlipX(!flipX)}
                    >
                        <Text style={styles.buttonText}>
                            ↔️ Flip X: {flipX ? 'ON' : 'OFF'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, flipY ? styles.buttonSuccess : styles.buttonInfo]}
                        onPress={() => setFlipY(!flipY)}
                    >
                        <Text style={styles.buttonText}>
                            ↕️ Flip Y: {flipY ? 'ON' : 'OFF'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Date info */}
                {dateInfo && (
                    <Text style={styles.dateInfo}>{dateInfo}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    buttonContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        gap: 10,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonSuccess: {
        backgroundColor: '#28a745',
    },
    buttonDanger: {
        backgroundColor: '#dc3545',
    },
    buttonProfile: {
        backgroundColor: '#6c757d',
    },
    buttonInfo: {
        backgroundColor: '#17a2b8',
        flex: 1,
    },
    buttonWarning: {
        backgroundColor: '#ffc107',
        flex: 1,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    testingButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    dateInfo: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 8,
        borderRadius: 5,
    },
    buttonRotation: {
        backgroundColor: '#9c27b0',
    },
    persistentCounters: {
        position: 'absolute',
        top: 20,
        right: 20,
        flexDirection: 'column',
        gap: 10,
    },
    counterBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#00ff00',
        minWidth: 120,
    },
    counterLabel: {
        color: '#00ff00',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    counterValue: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    counterTime: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 2,
    },
});

export default WorkoutScreen;
