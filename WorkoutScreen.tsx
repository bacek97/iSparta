import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, NativeModules, Dimensions, TouchableOpacity, Alert } from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    VisionCameraProxy,
} from 'react-native-vision-camera';
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
    const [exerciseState, setExerciseState] = useState<ExerciseState>(createExerciseState());
    const [exerciseName, setExerciseName] = useState<string>('');
    const [sessionActive, setSessionActive] = useState<boolean>(false);
    const [userId, setUserId] = useState<string>('');
    const [dateInfo, setDateInfo] = useState<string>('');
    const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
    const [exerciseDuration, setExerciseDuration] = useState<number>(0);

    // Exercise name debouncing buffer (similar to DeepFit's frame_queue)
    // DeepFit uses 250 frames, we use 45 frames (~1.5 seconds at 30 FPS)
    const [exerciseBuffer, setExerciseBuffer] = useState<string[]>([]);
    const EXERCISE_BUFFER_SIZE = 45;

    const device = useCameraDevice('front', {
        physicalDevices: ['ultra-wide-angle-camera']
    });
    const { hasPermission, requestPermission } = useCameraPermission();

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
                    const keypoints: Keypoint[] = pose.map((landmark: PoseLandmark) => ({
                        x: landmark.x * CAMERA_WIDTH,   // Scale by camera width
                        y: landmark.y * CAMERA_HEIGHT,  // Scale by camera height
                        confidence: landmark.visibility
                    }));

                    try {
                        // Extract 18 keypoints for DeepFit from 33 pose landmarks
                        const deepfitKeypoints = extractDeepFitKeypoints(keypoints);
                        const normalizedInput = normalizeKeypoints(deepfitKeypoints);

                        // Run DeepFit model
                        const deepfitOutputs = pluginDeepFit.model.runSync([normalizedInput]);
                        const exerciseProbs = deepfitOutputs[0] as Float32Array;

                        // Get raw exercise name from model
                        const detectedExercise = getExerciseName(exerciseProbs);

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

                        console.log(`[PoseLandmarks] Raw: ${detectedExercise}, Smoothed: ${smoothedExercise} (buffer: ${newBuffer.length})`);
                        setExerciseName(smoothedExercise);

                        // Update exercise state for rep counting using smoothed exercise
                        const newState = updateExerciseState(smoothedExercise, exerciseState, keypoints);
                        setExerciseState(newState);

                        // Handle exercise change if session is active (use smoothed exercise)
                        if (sessionActive) {
                            handleExerciseChange(smoothedExercise, newState).catch(err =>
                                console.error('[WorkoutScreen] Error handling exercise change:', err)
                            );
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

                            {/* Vertical Progress Bar */}
                            {exerciseState.form === 1 && (
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
                                        y={50 + (300 * (100 - exerciseState.percentage) / 100)}
                                        width={50}
                                        height={300 * exerciseState.percentage / 100}
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
                                        {Math.round(exerciseState.percentage)}%
                                    </SvgText>
                                </>
                            )}
                        </>
                    )}
                </Svg>
            )}

            {/* Control buttons */}
            <View style={styles.buttonContainer}>
                {/* Session control */}
                <TouchableOpacity
                    style={[styles.button, sessionActive ? styles.buttonDanger : styles.buttonSuccess]}
                    onPress={async () => {
                        if (sessionActive) {
                            // End session
                            const session = await completeWorkoutSession(exerciseState);
                            if (session) {
                                await updateCurrentWeekNRA();
                                Alert.alert('Session Complete', `Saved ${session.exercises.length} exercises!`);
                            }
                            setSessionActive(false);
                            setSessionStartTime(null);
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
});

export default WorkoutScreen;
