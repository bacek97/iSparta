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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    extractDeepFitKeypoints,
    normalizeKeypoints,
    getExerciseNameAndConfidence,
    type Keypoint,
    calculateBodyAngles
} from './deepfitUtils';
import { WorkoutSession } from './exerciseTrackingService';
import { EXERCISES, ExerciseType, PoseLandmark, PoseLandmarksEvent, PoseLandmarksErrorEvent, PoseLandmarksStatusEvent } from './types';
import { moveToNextDay, moveToPreviousDay, getDateInfo } from './testingUtils';
import { loadUserProfile, createDefaultProfile } from './storageService';
import UltraWideCamera from './ultraWideCamera';

const { PoseLandmarks } = NativeModules;

// console.log('[PoseLandmarks] PoseLandmarks module:', PoseLandmarks);

// Null check for native module
if (!PoseLandmarks) {
    console.warn('[PoseLandmarks] Native module not available. Camera-based workout tracking will be disabled.');
}

const poseLandmarksEmitter = PoseLandmarks ? new NativeEventEmitter(PoseLandmarks) : null;

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

// console.log('[PoseLandmarks] poseLandMarkPlugin initialized:', poseLandMarkPlugin);

interface PoseCameraDemoProps {
    modelPath?: string;
}

function WorkoutScreen({ modelPath = 'models_tflite/mediapipe/full/pose_landmarker_lite.task' }: PoseCameraDemoProps) {
    const [landmarks, setLandmarks] = useState<PoseLandmark[][]>([]);
    const [pluginDeepFit, setPluginDeepFit] = useState<{ model: TensorflowModel | null }>({ model: null });

    // Store current exercise calculation results from workoutSession
    const [currentExerciseData, setCurrentExerciseData] = useState<{ percent?: number; form?: number; feedback?: string }>({});

    const [exerciseName, setExerciseName] = useState<string>('');
    const [previousExerciseName, setPreviousExerciseName] = useState<string>('');
    const [sessionActive, setSessionActive] = useState<boolean>(false);
    const [userId, setUserId] = useState<string>('');
    const [dateInfo, setDateInfo] = useState<string>('');
    const [currentConfidence, setCurrentConfidence] = useState<number>(0);
    const [currentPresence, setCurrentPresence] = useState<number>(0);

    // FPS calculation window duration in seconds
    const FPS_WINDOW_SECONDS = 5;
    const MAX_FPS = 35;

    // Shared values for FPS tracking - counts frames in last N seconds
    const actualFPS = useSharedValue<number>(0);
    const lastFrameTime = useSharedValue<number>(0);
    // Circular buffer to store frame timestamps
    const frameTimestamps = useSharedValue<number[]>([]);
    const frameTimestampIndex = useSharedValue<number>(0);

    // Flag to control frame processing - only process when previous frame is done
    const canProcessFrame = useSharedValue<boolean>(true);

    // WorkoutSession instance for tracking exercises
    const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);

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

                // console.log('[WorkoutScreen] Loading DeepFit classifier...');
                const model = await loadTensorflowModel(
                    require('./models_tflite/deepfit_classifier_v3.tflite'),
                    'nnapi'
                );
                // console.log('[WorkoutScreen] DeepFit classifier loaded successfully!');
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
            // switch (rotationAngle) {
            let fixRotationAngle = 0;
            switch (fixRotationAngle) {
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
        if (!poseLandmarksEmitter || !PoseLandmarks) {
            console.log('[PoseLandmarks] Module not available, skipping initialization');
            return;
        }

        // console.log('[PoseLandmarks] Setting up event listeners...');

        // Set up the event listener to listen for pose landmarks detection results
        const subscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksDetected',
            (event: PoseLandmarksEvent) => {
                // Allow processing of the next frame now that this event has been received
                canProcessFrame.value = true;


                // console.log('[PoseLandmarks] onPoseLandmarksDetected event received!');
                // console.log('[PoseLandmarks] Number of poses:', event.landmarks?.length);

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
                    const sum = pose.reduce((a: number, landmark: PoseLandmark) => a + landmark.visibility, 0);
                    const avg = (sum / pose.length) || 0;
                    // console.log('Average visibility:', avg);
                    setCurrentConfidence(avg);

                    // Calculate average presence
                    const presenceSum = pose.reduce((a: number, landmark: PoseLandmark) => a + (landmark.presence || 0), 0);
                    const avgPresence = (presenceSum / pose.length) || 0;
                    // console.log('Average presence:', avgPresence);
                    setCurrentPresence(avgPresence);
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

                        // Get raw exercise name and confidence from model
                        const detectedResult = getExerciseNameAndConfidence(exerciseProbs);
                        let detectedExercise = detectedResult.name;
                        // const confidence = detectedResult.confidence;
                        const confidence = avg;
                        if (confidence < 0.5) {
                            detectedExercise = EXERCISES.UNKNOWN;
                        }

                        // console.log(`[PoseLandmarks] Raw: ${detectedExercise}, Confidence: ${confidence.toFixed(4)}`);

                        // Add to queue for smoothing (always, even for Unknown)
                        // console.log('[DEBUG] Before if - sessionActive:', sessionActive, 'workoutSession:', !!workoutSession);
                        if (sessionActive && workoutSession) {
                            console.log('[DEBUG] Inside if - calling calculate');
                            workoutSession.addClassification(detectedResult);

                            // Get smoothed exercise name from queue (like DeepFit's workout_name_after_smoothening)
                            const smoothedExerciseName = workoutSession.queue.getSmoothedValue();

                            // console.log(`[Smoothing] Raw: ${detectedExercise}, Smoothed: ${smoothedExerciseName}`);

                            // Calculate exercise metrics using workoutSession
                            const { duration, reps, percent } = workoutSession.calculate(smoothedExerciseName, calculateBodyAngles(keypoints));

                            console.log('percent283', percent);

                            // Determine form and feedback based on percent
                            let form = 1; // Good form by default
                            let feedback = '';

                            if (percent !== undefined) {
                                // Form is good if percent is progressing (between 0-100)
                                form = (percent >= 0 && percent <= 100) ? 1 : 0;

                                // Generate feedback based on progress
                                if (percent < 30) {
                                    feedback = 'Start position';
                                } else if (percent < 70) {
                                    feedback = 'In progress';
                                } else if (percent < 100) {
                                    feedback = 'Almost there';
                                } else {
                                    feedback = 'Complete!';
                                }
                            }

                            // Update UI with smoothed value and calculated data
                            setPreviousExerciseName(smoothedExerciseName);
                            setExerciseName(smoothedExerciseName);
                            setCurrentExerciseData({ percent, form, feedback });
                        } else {
                            // No active session - just update UI with raw detection
                            setPreviousExerciseName(detectedExercise);
                            setExerciseName(detectedExercise);
                            setCurrentExerciseData({});
                        }



                    } catch (error) {
                        console.error('[PoseLandmarks] DeepFit classification error:', error);
                    }
                }
            },
        );

        const statusSubscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksStatus',
            (event: PoseLandmarksStatusEvent) => {

                canProcessFrame.value = true;
                // console.log('[PoseLandmarks] Status event:', JSON.stringify(event, null, 2));
            },
        );

        const errorSubscription = poseLandmarksEmitter.addListener(
            'onPoseLandmarksError',
            (event: PoseLandmarksErrorEvent) => {
                console.error('[PoseLandmarks] ❌ ERROR EVENT ❌');
                console.error('[PoseLandmarks] Error event:', JSON.stringify(event, null, 2));
                console.error('[PoseLandmarks] Error message:', event.error);
            },
        );

        // Initialize the model with the provided model path
        // console.log('[PoseLandmarks] Calling PoseLandmarks.initModel with path:', modelPath);
        PoseLandmarks.initModel(modelPath);

        // Clean up the event listener when the component is unmounted
        return () => {
            // console.log('[PoseLandmarks] Cleaning up event listeners');
            subscription.remove();
            statusSubscription.remove();
            errorSubscription.remove();
        };
    }, [modelPath, pluginDeepFit, canProcessFrame, sessionActive, workoutSession]);
    const { resize } = useResizePlugin();

    useEffect(() => {
        // Request camera permission on component mount
        // console.log('[PoseLandmarks] Requesting camera permission...');
        requestPermission()
            // .then(granted => console.log('[PoseLandmarks] Camera permission granted:', granted))
            .catch(error => console.error('[PoseLandmarks] Camera permission error:', error));
    }, [requestPermission]);

    // Create JS bridge for incrementing duration
    const incrementDuration = useRunOnJS(() => {
        if (workoutSession) {
            workoutSession.incrementDuration();
        }
    }, [workoutSession]);

    const frameProcessor = useFrameProcessor(frame => {
        'worklet';

        // Process the frame using the 'poseLandmarks' plugin
        // Only process if the previous frame has been processed (event-driven throttling)
        // The plugin will trigger 'onPoseLandmarksDetected' event when landmarks are detected
        // All DeepFit classification and exercise tracking happens in that event handler

        // Throttle to MAX_FPS
        const currentTime = Date.now();
        const timeSinceLastFrame = currentTime - lastFrameTime.value;
        const shouldProcess = timeSinceLastFrame >= 1000 / MAX_FPS;

        if (shouldProcess) {
            lastFrameTime.value = currentTime;

            // Add current timestamp to circular buffer
            const maxFrames = MAX_FPS * FPS_WINDOW_SECONDS;
            if (frameTimestamps.value.length < maxFrames) {
                frameTimestamps.value.push(currentTime);
            } else {
                frameTimestamps.value[frameTimestampIndex.value] = currentTime;
            }
            frameTimestampIndex.value = (frameTimestampIndex.value + 1) % maxFrames;

            // Count frames in last FPS_WINDOW_SECONDS
            const windowStartTime = currentTime - (FPS_WINDOW_SECONDS * 1000);
            let frameCount = 0;
            for (let i = 0; i < frameTimestamps.value.length; i++) {
                if (frameTimestamps.value[i] >= windowStartTime) {
                    frameCount++;
                }
            }

            // Calculate FPS: frames in window / window duration
            actualFPS.value = frameCount / FPS_WINDOW_SECONDS;
        }

        if (canProcessFrame.value && shouldProcess) {
            try {
                if (poseLandMarkPlugin != null) {
                    // Set flag to false to prevent processing next frame until event is received
                    canProcessFrame.value = false;
                    poseLandMarkPlugin.call(frame);
                }
            } catch (error) {
                console.error('[FrameProcessor] Error processing frame:', error);
                // Reset flag on error to allow next frame
                canProcessFrame.value = true;
            }
        }

        // Duration tracker at 1 FPS - only runs during active session
        runAtTargetFps(1, () => {
            'worklet';
            if (sessionActive) {
                incrementDuration();
            }
        });
    }, [sessionActive, incrementDuration]);

    if (!hasPermission) {
        // console.log('[PoseLandmarks] No camera permission');
        return <Text>No permission</Text>;
    }

    if (device == null) {
        // console.log('[PoseLandmarks] No camera device');
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

    // console.log('[PoseLandmarks] Rendering camera with device:', device.id);
    // console.log('[PoseLandmarks] Selected camera format:', {
    // width: selectedFormat.videoWidth,
    //     height: selectedFormat.videoHeight,
    //     fps: selectedFormat.maxFps
    // });
    // console.log('[PoseLandmarks] Current landmarks count:', landmarks.length);

    return (
        <View style={StyleSheet.absoluteFill}>
            <UltraWideCamera
                frameProcessor={frameProcessor}
                onOutputOrientationChanged={(orientation) => console.log('orientation', /^landscape/.test(orientation))}
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
                        const isUnknown = exerciseName === EXERCISES.UNKNOWN;

                        // Use session data if active
                        const displayReps = (sessionActive && workoutSession && workoutSession.s.exercises[exerciseName as EXERCISES])
                            ? workoutSession.s.exercises[exerciseName as EXERCISES].reps || 0
                            : 0;

                        const displayPercent = currentExerciseData.percent || 0;
                        const displayForm = currentExerciseData.form || 1;
                        const displayFeedback = currentExerciseData.feedback || '';

                        return (
                            <>
                                {/* Background for exercise name */}
                                <Rect
                                    x={10}
                                    y={30}
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

                                {/* FPS Display - shows onPoseLandmarksDetected event frequency */}
                                <Rect
                                    x={320}
                                    y={30}
                                    width={120}
                                    height={40}
                                    fill="black"
                                    opacity={0.6}
                                    rx={8}
                                />
                                <SvgText
                                    x={100}
                                    y={55}
                                    fontSize="28"
                                    fontWeight="bold"
                                    fill="lime"
                                    stroke="black"
                                    strokeWidth="2"
                                >
                                    FPS: {actualFPS.value.toFixed(1)}
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
                                            Reps: {displayReps}
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
                                            fill={displayForm === 1 ? "lime" : "red"}
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Form: {displayForm === 1 ? 'Good' : 'Bad'}
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
                                            {displayFeedback}
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
                                            Progress: {displayPercent.toFixed(1)}%
                                        </SvgText>
                                        {/* Background for confidence */}
                                        <Rect
                                            x={10}
                                            y={249}
                                            width={250}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={277}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill="orange"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Confidence: {(currentConfidence * 100).toFixed(1)}%
                                        </SvgText>
                                        {/* Background for presence */}
                                        <Rect
                                            x={10}
                                            y={335}
                                            width={250}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={363}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill="magenta"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Presence: {(currentPresence * 100).toFixed(1)}%
                                        </SvgText>
                                        {/* Background for duration */}
                                        <Rect
                                            x={10}
                                            y={292}
                                            width={250}
                                            height={38}
                                            fill="black"
                                            opacity={0.6}
                                            rx={8}
                                        />
                                        <SvgText
                                            x={20}
                                            y={320}
                                            fontSize="24"
                                            fontWeight="bold"
                                            fill="lightgreen"
                                            stroke="black"
                                            strokeWidth="2"
                                        >
                                            Duration: {sessionActive && workoutSession ? workoutSession.s.exercises[exerciseName as EXERCISES]?.duration || 0 : 0}s
                                        </SvgText>

                                        {/* Vertical Progress Bar */}
                                        <>
                                            {/* Progress bar background (outline) */}
                                            <Rect
                                                x={screenWidth - 70}
                                                y={50}
                                                width={50}
                                                height={300}
                                                fill="none"
                                                stroke={
                                                    exerciseName === EXERCISES.SQUATS ? '#00ff00' :
                                                        exerciseName === EXERCISES.PUSHUPS ? '#00bfff' :
                                                            exerciseName === EXERCISES.LUNGES ? '#ff6b00' :
                                                                exerciseName === EXERCISES.SITUPS ? '#ff00ff' :
                                                                    exerciseName === EXERCISES.BICEP_CURLS ? '#ffff00' :
                                                                        '#00ff00'
                                                }
                                                strokeWidth="3"
                                            />
                                            {/* Progress bar fill (fills from bottom to top) */}
                                            <Rect
                                                x={screenWidth - 70}
                                                y={50 + (300 * (100 - displayPercent) / 100)}
                                                width={50}
                                                height={300 * displayPercent / 100}
                                                fill={
                                                    exerciseName === EXERCISES.SQUATS ? '#00ff00' :
                                                        exerciseName === EXERCISES.PUSHUPS ? '#00bfff' :
                                                            exerciseName === EXERCISES.LUNGES ? '#ff6b00' :
                                                                exerciseName === EXERCISES.SITUPS ? '#ff00ff' :
                                                                    exerciseName === EXERCISES.BICEP_CURLS ? '#ffff00' :
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
                                                {Math.round(displayPercent)}%
                                            </SvgText>
                                        </>
                                    </>
                                )
                                }
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
                        {(sessionActive && workoutSession && workoutSession.s.exercises[EXERCISES.SQUATS])
                            ? workoutSession.s.exercises[EXERCISES.SQUATS].reps
                            : 0}
                    </Text>
                </View>
                <View style={styles.counterBox}>
                    <Text style={styles.counterLabel}>Pushups</Text>
                    <Text style={styles.counterValue}>
                        {(sessionActive && workoutSession && workoutSession.s.exercises[EXERCISES.PUSHUPS])
                            ? workoutSession.s.exercises[EXERCISES.PUSHUPS].reps
                            : 0}
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
                            // console.log('[WorkoutScreen] Ending session...');
                            if (workoutSession) {
                                const sessionJson = workoutSession.getJson();
                                const sessionData = JSON.parse(sessionJson);

                                // Save to AsyncStorage
                                await AsyncStorage.setItem(`session_${sessionData.sessionId}`, sessionJson);

                                // Auto-sync to server if enabled
                                try {
                                    const { autoSyncWorkout } = await import('./autoSyncService');
                                    const { getCurrentUser } = await import('./authService');

                                    const userData = await getCurrentUser();
                                    if (userData) {
                                        await autoSyncWorkout(sessionData, {
                                            publicKey: userData.publicKey,
                                            fmsCategory: 'JUNIOR', // TODO: Get from user profile
                                        });
                                    }
                                } catch (syncError) {
                                    console.log('Auto-sync skipped or failed:', syncError);
                                    // Don't block workout save if sync fails
                                }

                                // Count exercises with data
                                const exerciseCount = Object.values(sessionData.exercises).filter(
                                    (ex: any) => ex.duration > 0 || (ex.reps && ex.reps > 0)
                                ).length;

                                Alert.alert('Session Complete', `Saved ${exerciseCount} exercises!\n\nSession data:\n${sessionJson}`);
                            }
                            setSessionActive(false);
                            setWorkoutSession(null);
                            // Reset exercise data
                            setCurrentExerciseData({});
                            setPreviousExerciseName('');
                        } else {
                            // Start session
                            console.log('[DEBUG] Start session button pressed, userId:', userId);
                            if (userId) {
                                // Create new WorkoutSession
                                const newSession = new WorkoutSession();
                                console.log('[DEBUG] Created new session:', newSession);
                                setWorkoutSession(newSession);
                                setSessionActive(true);
                                console.log('[DEBUG] Session activated!');
                                Alert.alert('Session Started', 'Start exercising!');
                            } else {
                                console.log('[DEBUG] No userId - cannot start session');
                            }
                        }
                    }}
                >
                    <Text style={styles.buttonText}>
                        {sessionActive ? 'End Session' : 'Start Session'}
                    </Text>
                </TouchableOpacity>

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
        </View >
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
