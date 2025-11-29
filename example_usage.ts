/**
 * Example usage of DeepFit utilities for exercise tracking
 * 
 * This demonstrates how to:
 * 1. Get exercise classification from the model
 * 2. Calculate completion percentage
 * 3. Get direction feedback ("Go Up" / "Go Down")
 * 4. Track rep count
 */

import {
    extractDeepFitKeypoints,
    normalizeKeypoints,
    getExerciseName,
    createExerciseState,
    updateExerciseState,
    type Keypoint,
    type ExerciseState
} from './deepfitUtils';

// Example: Process a frame from MediaPipe pose detection
function processFrame(
    mediapipeLandmarks: Keypoint[],
    model: any, // Your TFLite model instance
    exerciseState: ExerciseState
): {
    exerciseName: string;
    state: ExerciseState;
} {
    // Step 1: Extract 18 keypoints from MediaPipe's 33 landmarks
    const deepfitKeypoints = extractDeepFitKeypoints(mediapipeLandmarks);

    // Step 2: Normalize keypoints for model input
    const normalizedInput = normalizeKeypoints(deepfitKeypoints);

    // Step 3: Run model inference
    const modelOutput = model.runSync(normalizedInput); // or model.run() depending on your setup

    // Step 4: Get exercise name from model output
    const exerciseName = getExerciseName(modelOutput[0]);

    // Step 5: Update exercise state (gets percentage, direction, rep count)
    const updatedState = updateExerciseState(
        exerciseName,
        exerciseState,
        mediapipeLandmarks
    );

    return {
        exerciseName,
        state: updatedState
    };
}

// Example usage in a React Native component
export function ExampleComponent() {
    // Initialize exercise state once
    const [exerciseState, setExerciseState] = React.useState<ExerciseState>(
        createExerciseState()
    );

    // Frame processor callback
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        // Get pose landmarks from MediaPipe or your pose detection model
        const landmarks = detectPose(frame); // Your pose detection function

        if (landmarks && landmarks.length === 33) {
            // Process the frame
            const result = processFrame(landmarks, tfliteModel, exerciseState);

            // Update state
            runOnJS(setExerciseState)(result.state);

            // Log results
            console.log('Exercise:', result.exerciseName);
            console.log('Percentage:', result.state.percentage + '%');
            console.log('Direction:', result.state.feedback);
            console.log('Reps:', Math.floor(result.state.count));
        }
    }, [exerciseState]);

    return (
        <View>
        <Camera frameProcessor= { frameProcessor } />

        {/* Display exercise info */ }
        < Text > Exercise: { exerciseName } </Text>
            < Text > Reps: { Math.floor(exerciseState.count) } </Text>
                < Text > Progress: { exerciseState.percentage.toFixed(0) }% </Text>
                    < Text > Feedback: { exerciseState.feedback } </Text>

    {/* Progress bar */ }
    <View style={ { width: '100%', height: 20, backgroundColor: '#ddd' } }>
        <View 
          style={
        {
            width: `${exerciseState.percentage}%`,
                height: '100%',
                    backgroundColor: '#4CAF50'
        }
    } 
        />
        </View>
        </View>
  );
}

// Simple usage example
export function simpleExample() {
    // Create initial state
    let state = createExerciseState();

    // For each frame:
    const landmarks = getMediaPipeLandmarks(); // Your function to get landmarks

    // Update state
    state = updateExerciseState('pushups', state, landmarks);

    // Access results
    console.log('Completion:', state.percentage + '%');
    console.log('Direction:', state.feedback); // "Go Up" or "Go Down"
    console.log('Total reps:', Math.floor(state.count));
}
