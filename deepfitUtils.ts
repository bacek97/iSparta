/**
 * DeepFit Utilities
 * Converts MediaPipe 33 landmarks to DeepFit 18 keypoints format
 */

// Mapping from MediaPipe (33 points) to DeepFit (18 points)
// Based on DeepFit's lm_dict: {0:0, 1:10, 2:12, 3:14, 4:16, 5:11, 6:13, 7:15, 8:24, 9:26, 10:28, 11:23, 12:25, 13:27, 14:5, 15:2, 16:8, 17:7}
const MEDIAPIPE_TO_DEEPFIT_MAP: number[] = [
    0,  // 0: Nose
    10, // 1: Neck (approximated from MediaPipe shoulder midpoint)
    12, // 2: Right Shoulder
    14, // 3: Right Elbow
    16, // 4: Right Wrist
    11, // 5: Left Shoulder
    13, // 6: Left Elbow
    15, // 7: Left Wrist
    24, // 8: Right Hip
    26, // 9: Right Knee
    28, // 10: Right Ankle
    23, // 11: Left Hip
    25, // 12: Left Knee
    27, // 13: Left Ankle
    5,  // 14: Right Eye
    2,  // 15: Left Eye
    8,  // 16: Right Ear
    7   // 17: Left Ear
];

export interface Keypoint {
    x: number;
    y: number;
    confidence?: number;
}

/**
 * Extract 18 keypoints from MediaPipe's 33 landmarks
 */
export function extractDeepFitKeypoints(mediapipeLandmarks: Keypoint[]): Keypoint[] {
    if (mediapipeLandmarks.length < 33) {
        throw new Error(`Expected 33 MediaPipe landmarks, got ${mediapipeLandmarks.length}`);
    }

    const deepfitKeypoints: Keypoint[] = [];

    for (let i = 0; i < 18; i++) {
        const mediapipeIndex = MEDIAPIPE_TO_DEEPFIT_MAP[i];

        // Special case for Neck (index 1) - calculate as midpoint of shoulders
        if (i === 1) {
            const leftShoulder = mediapipeLandmarks[11];
            const rightShoulder = mediapipeLandmarks[12];
            deepfitKeypoints.push({
                x: (leftShoulder.x + rightShoulder.x) / 2,
                y: (leftShoulder.y + rightShoulder.y) / 2,
                confidence: Math.min(leftShoulder.confidence || 1, rightShoulder.confidence || 1)
            });
        } else {
            deepfitKeypoints.push({
                x: mediapipeLandmarks[mediapipeIndex].x,
                y: mediapipeLandmarks[mediapipeIndex].y,
                confidence: mediapipeLandmarks[mediapipeIndex].confidence
            });
        }
    }

    return deepfitKeypoints;
}

/**
 * Calculate Euclidean distance between two points
 */
function euclideanDistance(a: Keypoint, b: Keypoint): number {
    // If either point is at origin (0,0), return 0
    if ((a.x === 0 && a.y === 0) || (b.x === 0 && b.y === 0)) {
        return 0;
    }
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Normalize keypoints relative to body length and center of gravity
 * This matches the Python norm_X function from DeepFit
 */
export function normalizeKeypoints(keypoints: Keypoint[]): Float32Array {
    if (keypoints.length !== 18) {
        throw new Error(`Expected 18 keypoints, got ${keypoints.length}`);
    }

    // Extract individual keypoints
    const Nose = keypoints[0];
    const Neck = keypoints[1];
    const RShoulder = keypoints[2];
    const RElbow = keypoints[3];
    const RWrist = keypoints[4];
    const LShoulder = keypoints[5];
    const LElbow = keypoints[6];
    const LWrist = keypoints[7];
    const RHip = keypoints[8];
    const RKnee = keypoints[9];
    const RAnkle = keypoints[10];
    const LHip = keypoints[11];
    const LKnee = keypoints[12];
    const LAnkle = keypoints[13];
    const REye = keypoints[14];
    const LEye = keypoints[15];
    const REar = keypoints[16];
    const LEar = keypoints[17];

    // Calculate head length (max of various head measurements)
    const headLengths = [
        euclideanDistance(Neck, LEar),
        euclideanDistance(Neck, REar),
        euclideanDistance(Neck, LEye),
        euclideanDistance(Neck, REye),
        euclideanDistance(Nose, LEar),
        euclideanDistance(Nose, REar),
        euclideanDistance(Nose, LEye),
        euclideanDistance(Nose, REye)
    ];
    const lengthHead = Math.max(...headLengths);

    // Calculate torso length
    const lengthTorso = Math.max(
        euclideanDistance(Neck, LHip),
        euclideanDistance(Neck, RHip)
    );

    // Calculate leg lengths
    const lengthLegRight = euclideanDistance(RHip, RKnee) + euclideanDistance(RKnee, RAnkle);
    const lengthLegLeft = euclideanDistance(LHip, LKnee) + euclideanDistance(LKnee, LAnkle);
    const lengthLeg = Math.max(lengthLegRight, lengthLegLeft);

    // Total body length
    let lengthBody = lengthHead + lengthTorso + lengthLeg;

    // Avoid division by zero
    if (lengthBody === 0) {
        lengthBody = 1;
    }

    // Calculate center of gravity
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const kp of keypoints) {
        if (kp.x > 0 || kp.y > 0) {
            sumX += kp.x;
            sumY += kp.y;
            count++;
        }
    }

    const centerX = count > 0 ? sumX / count : 0;
    const centerY = count > 0 ? sumY / count : 0;

    // Normalize coordinates relative to body length and center of gravity
    const normalized = new Float32Array(36);

    for (let i = 0; i < 18; i++) {
        const kp = keypoints[i];
        const isValid = kp.x > 0 || kp.y > 0;

        // First 18 values are normalized X coordinates
        normalized[i] = isValid ? (kp.x - centerX) / lengthBody : 0;

        // Next 18 values are normalized Y coordinates
        normalized[i + 18] = isValid ? (kp.y - centerY) / lengthBody : 0;
    }

    return normalized;
}

/**
 * Exercise labels (must match DeepFit training order)
 */
export const EXERCISE_LABELS = [
    'squats',
    'lunges',
    'bicep_curls',
    'situps',
    'pushups',
    'tricep_extensions',
    'dumbbell_rows',
    'jumping_jacks',
    'dumbbell_shoulder_press',
    'lateral_shoulder_raises'
];

/**
 * Get exercise name from model output
 */
export function getExerciseName(modelOutput: Float32Array | number[]): string {
    let maxIndex = 0;
    let maxValue = modelOutput[0];

    for (let i = 1; i < modelOutput.length; i++) {
        if (modelOutput[i] > maxValue) {
            maxValue = modelOutput[i];
            maxIndex = i;
        }
    }

    return EXERCISE_LABELS[maxIndex];
}

/**
 * Get all exercise probabilities
 */
export function getExerciseProbabilities(modelOutput: Float32Array | number[]): Record<string, number> {
    const result: Record<string, number> = {};

    for (let i = 0; i < EXERCISE_LABELS.length && i < modelOutput.length; i++) {
        result[EXERCISE_LABELS[i]] = modelOutput[i];
    }

    return result;
}

/**
 * Calculate angle between three points (in degrees)
 * @param point1 First point (e.g., shoulder)
 * @param point2 Middle point/vertex (e.g., elbow)
 * @param point3 Third point (e.g., wrist)
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle(point1: Keypoint, point2: Keypoint, point3: Keypoint): number {
    const x1 = point1.x;
    const y1 = point1.y;
    const x2 = point2.x;
    const y2 = point2.y;
    const x3 = point3.x;
    const y3 = point3.y;

    // Calculate angle using atan2
    let angle = Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y1 - y2, x1 - x2);
    angle = angle * (180 / Math.PI);

    // Normalize angle to 0-180 range
    if (angle < 0) {
        angle += 360;
        if (angle > 180) {
            angle = 360 - angle;
        }
    } else if (angle > 180) {
        angle = 360 - angle;
    }

    return angle;
}

/**
 * Exercise state tracker for rep counting and form checking
 */
export interface ExerciseState {
    count: number;           // Total rep count (increments by 0.5 for each phase)
    direction: number;       // 0 = going down, 1 = going up
    form: number;           // 0 = bad form, 1 = good form
    feedback: string;       // Current feedback message
    percentage: number;     // Completion percentage (0-100)
}

/**
 * Body angles extracted from keypoints
 */
export interface BodyAngles {
    elbowLeft: number;
    elbowRight: number;
    shoulderLeft: number;
    shoulderRight: number;
    hipLeft: number;
    hipRight: number;
    kneeLeft: number;
    kneeRight: number;
}

/**
 * Calculate body angles from MediaPipe landmarks
 * MediaPipe landmark indices:
 * 11: Left Shoulder, 12: Right Shoulder
 * 13: Left Elbow, 14: Right Elbow
 * 15: Left Wrist, 16: Right Wrist
 * 23: Left Hip, 24: Right Hip
 * 25: Left Knee, 26: Right Knee
 * 27: Left Ankle, 28: Right Ankle
 */
export function calculateBodyAngles(landmarks: Keypoint[]): BodyAngles {
    if (landmarks.length < 33) {
        throw new Error(`Expected 33 MediaPipe landmarks, got ${landmarks.length}`);
    }

    return {
        // Left elbow angle: shoulder-elbow-wrist
        elbowLeft: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),

        // Right elbow angle: shoulder-elbow-wrist
        elbowRight: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),

        // Left shoulder angle: elbow-shoulder-hip
        shoulderLeft: calculateAngle(landmarks[13], landmarks[11], landmarks[23]),

        // Right shoulder angle: elbow-shoulder-hip
        shoulderRight: calculateAngle(landmarks[14], landmarks[12], landmarks[24]),

        // Left hip angle: shoulder-hip-knee
        hipLeft: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),

        // Right hip angle: shoulder-hip-knee
        hipRight: calculateAngle(landmarks[12], landmarks[24], landmarks[26]),

        // Left knee angle: hip-knee-ankle
        kneeLeft: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),

        // Right knee angle: hip-knee-ankle
        kneeRight: calculateAngle(landmarks[24], landmarks[26], landmarks[28])
    };
}

/**
 * Linear interpolation helper
 */
function interpolate(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    // Clamp value to input range
    const clampedValue = Math.max(inMin, Math.min(inMax, value));
    return ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Update exercise state for pushups
 * @param state Current exercise state
 * @param angles Body angles
 * @returns Updated state with feedback and count
 */
export function updatePushupState(state: ExerciseState, angles: BodyAngles): ExerciseState {
    const newState = { ...state };

    // Calculate completion percentage based on elbow angle
    // 90 degrees = fully down (0%), 160 degrees = fully up (100%)
    newState.percentage = interpolate(
        Math.min(angles.elbowLeft, angles.elbowRight),
        90,
        160,
        0,
        100
    );

    // Check if form is correct at the start (arms extended, body straight)
    if (
        angles.elbowLeft > 160 &&
        angles.elbowRight > 160 &&
        angles.shoulderLeft > 40 &&
        angles.shoulderRight > 40 &&
        angles.hipLeft > 160 &&
        angles.hipRight > 160
    ) {
        newState.form = 1;
    }

    // Track full pushup motion
    if (newState.form === 1) {
        // At the bottom position (0%)
        if (newState.percentage <= 5) {
            if (
                angles.elbowLeft <= 90 &&
                angles.elbowRight <= 90 &&
                angles.hipLeft > 160 &&
                angles.hipRight > 160
            ) {
                newState.feedback = "Go Up";
                if (newState.direction === 0) {
                    newState.count += 0.5;
                    newState.direction = 1;
                }
            } else {
                newState.feedback = "Bad Form. Keep body straight.";
            }
        }

        // At the top position (100%)
        if (newState.percentage >= 95) {
            if (
                angles.elbowLeft > 160 &&
                angles.elbowRight > 160 &&
                angles.shoulderLeft > 40 &&
                angles.shoulderRight > 40 &&
                angles.hipLeft > 160 &&
                angles.hipRight > 160
            ) {
                newState.feedback = "Go Down";
                if (newState.direction === 1) {
                    newState.count += 0.5;
                    newState.direction = 0;
                }
            } else {
                newState.feedback = "Bad Form. Extend arms fully.";
            }
        }
    } else {
        newState.feedback = "Get into starting position";
    }

    return newState;
}

/**
 * Update exercise state for squats
 * @param state Current exercise state
 * @param angles Body angles
 * @returns Updated state with feedback and count
 */
export function updateSquatState(state: ExerciseState, angles: BodyAngles): ExerciseState {
    const newState = { ...state };

    // Calculate completion percentage based on knee angle
    // 90 degrees = fully down (0%), 160 degrees = fully up (100%)
    const kneeAngle = Math.min(angles.kneeLeft, angles.kneeRight);
    newState.percentage = interpolate(kneeAngle, 90, 160, 0, 100);

    // Check if form is correct at the start (standing upright)
    if (kneeAngle > 160) {
        newState.form = 1;
    }

    // Track full squat motion
    if (newState.form === 1) {
        // At the bottom position (0%)
        if (newState.percentage <= 5) {
            if (kneeAngle < 90) {
                newState.feedback = "Go Up";
                if (newState.direction === 0) {
                    newState.count += 0.5;
                    newState.direction = 1;
                }
            } else {
                newState.feedback = "Bad Form. Go deeper.";
            }
        }

        // At the top position (100%)
        if (newState.percentage >= 95) {
            if (kneeAngle > 169) {
                newState.feedback = "Go Down";
                if (newState.direction === 1) {
                    newState.count += 0.5;
                    newState.direction = 0;
                }
            } else {
                newState.feedback = "Bad Form. Stand up fully.";
            }
        }
    } else {
        newState.feedback = "Get into starting position";
    }

    return newState;
}

/**
 * Create initial exercise state
 */
export function createExerciseState(): ExerciseState {
    return {
        count: 0,
        direction: 0,
        form: 0,
        feedback: "Get into starting position",
        percentage: 0
    };
}

/**
 * Update exercise state based on detected exercise type
 * @param exerciseName Name of the exercise (from model output)
 * @param state Current exercise state
 * @param landmarks MediaPipe landmarks (33 points)
 * @returns Updated exercise state
 */
export function updateExerciseState(
    exerciseName: string,
    state: ExerciseState,
    landmarks: Keypoint[]
): ExerciseState {
    const angles = calculateBodyAngles(landmarks);

    switch (exerciseName.toLowerCase()) {
        case 'pushups':
            return updatePushupState(state, angles);

        case 'squats':
            return updateSquatState(state, angles);

        // Add more exercises as needed
        default:
            return {
                ...state,
                feedback: `Exercise "${exerciseName}" tracking not implemented yet`,
                percentage: 0
            };
    }
}
