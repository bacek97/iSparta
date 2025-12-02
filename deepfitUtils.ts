/**
 * DeepFit Utilities
 * Converts MediaPipe 33 landmarks OR MoveNet 17 landmarks to DeepFit 18 keypoints format
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

// Mapping from MoveNet (17 points) to DeepFit (18 points)
// MoveNet order: 0-nose, 1-left_eye, 2-right_eye, 3-left_ear, 4-right_ear,
//                5-left_shoulder, 6-right_shoulder, 7-left_elbow, 8-right_elbow,
//                9-left_wrist, 10-right_wrist, 11-left_hip, 12-right_hip,
//                13-left_knee, 14-right_knee, 15-left_ankle, 16-right_ankle
const MOVENET_TO_DEEPFIT_MAP: number[] = [
    0,  // 0: Nose
    -1, // 1: Neck (will be calculated as midpoint of shoulders 5,6)
    6,  // 2: Right Shoulder
    8,  // 3: Right Elbow
    10, // 4: Right Wrist
    5,  // 5: Left Shoulder
    7,  // 6: Left Elbow
    9,  // 7: Left Wrist
    12, // 8: Right Hip
    14, // 9: Right Knee
    16, // 10: Right Ankle
    11, // 11: Left Hip
    13, // 12: Left Knee
    15, // 13: Left Ankle
    2,  // 14: Right Eye
    1,  // 15: Left Eye
    4,  // 16: Right Ear
    3   // 17: Left Ear
];

export interface Keypoint {
    x: number;
    y: number;
    confidence: number;
}

/**
 * Extract 18 keypoints from MediaPipe's 33 landmarks OR MoveNet's 17 landmarks
 * Automatically detects which model based on array length
 */
export function extractDeepFitKeypoints(landmarks: Keypoint[]): Keypoint[] {
    if (landmarks.length === 33) {
        // MediaPipe format
        return extractFromMediaPipe(landmarks);
    } else if (landmarks.length === 17) {
        // MoveNet format
        return extractFromMoveNet(landmarks);
    } else {
        throw new Error(`Expected 33 (MediaPipe) or 17 (MoveNet) landmarks, got ${landmarks.length}`);
    }
}

/**
 * Extract from MediaPipe 33 landmarks
 */
function extractFromMediaPipe(mediapipeLandmarks: Keypoint[]): Keypoint[] {
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
 * Extract from MoveNet 17 landmarks
 */
function extractFromMoveNet(movenetLandmarks: Keypoint[]): Keypoint[] {
    const deepfitKeypoints: Keypoint[] = [];

    for (let i = 0; i < 18; i++) {
        const movenetIndex = MOVENET_TO_DEEPFIT_MAP[i];

        // Special case for Neck (index 1) - calculate as midpoint of shoulders
        if (i === 1) {
            const leftShoulder = movenetLandmarks[5];  // MoveNet index 5
            const rightShoulder = movenetLandmarks[6]; // MoveNet index 6
            deepfitKeypoints.push({
                x: (leftShoulder.x + rightShoulder.x) / 2,
                y: (leftShoulder.y + rightShoulder.y) / 2,
                confidence: Math.min(leftShoulder.confidence || 1, rightShoulder.confidence || 1)
            });
        } else {
            deepfitKeypoints.push({
                x: movenetLandmarks[movenetIndex].x,
                y: movenetLandmarks[movenetIndex].y,
                confidence: movenetLandmarks[movenetIndex].confidence
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
 * Normalize keypoints to match Python DeepFit implementation
/**
 * Normalize keypoints to match Python DeepFit implementation
 * Input: 18 keypoints with PIXEL coordinates
 * Output: Float32Array(36) in INTERLEAVED format after normalization
 * 
 * This function creates BLOCKED format input [x0...x17, y0...y17] and then
 * applies the norm_X logic from Python which outputs INTERLEAVED format.
 */
export function normalizeKeypoints(keypoints: Keypoint[]): Float32Array {
    if (keypoints.length !== 18) {
        throw new Error(`Expected 18 keypoints, got ${keypoints.length}`);
    }

    // Create BLOCKED format: [x0, x1, ..., x17, y0, y1, ..., y17]
    // This matches Python's convert_mediapipe_keypoints_for_model output
    const blocked = new Float32Array(36);

    // First 18 elements: X coordinates
    for (let i = 0; i < 18; i++) {
        blocked[i] = keypoints[i].x;
    }

    // Last 18 elements: Y coordinates  
    for (let i = 0; i < 18; i++) {
        blocked[18 + i] = keypoints[i].y;
    }

    // Now apply the norm_X logic from Python
    return normX(blocked);
}

/**
 * Port of Python norm_X function from DeepFitClassifier.py
 * Expects BLOCKED input: [x0, x1, ..., x17, y0, y1, ..., y17]
 * Returns INTERLEAVED output: [x0_norm, y0_norm, x1_norm, y1_norm, ...]
 * 
 * NOTE: Python's norm_X uses X[:, 0::2] and X[:, 1::2] slicing which extracts
 * every other element. When applied to BLOCKED format, this creates a mixed
 * array but somehow produces correct results. We replicate this exact behavior.
 */
function normX(X: Float32Array): Float32Array {
    // Python's slicing behavior with BLOCKED input [x0,x1,...,x17,y0,y1,...,y17]:
    // X[:, 0::2] = indices 0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34
    //            = [x0,x2,x4,x6,x8,x10,x12,x14,x16,y0,y2,y4,y6,y8,y10,y12,y14,y16]
    // X[:, 1::2] = indices 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35
    //            = [x1,x3,x5,x7,x9,x11,x13,x15,x17,y1,y3,y5,y7,y9,y11,y13,y15,y17]

    const evenIndices: number[] = [];
    const oddIndices: number[] = [];
    for (let i = 0; i < 36; i++) {
        if (i % 2 === 0) {
            evenIndices.push(X[i]);
        } else {
            oddIndices.push(X[i]);
        }
    }

    // Helper function for euclidean distance
    // Python checks if a[:, 0] != 0, which in the sliced arrays means checking the first element
    const euclideanDist = (aIdx: number, bIdx: number): number => {
        const ax = evenIndices[aIdx];
        const ay = oddIndices[aIdx];
        const bx = evenIndices[bIdx];
        const by = oddIndices[bIdx];

        // Python: (a[:, 0] != 0).astype(int) checks if X coordinate is not 0
        if (ax === 0 || bx === 0) {
            return 0;
        }

        return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
    };

    // Calculate head length (max of various head measurements)
    // Indices: 0=Nose, 1=Neck, 14=REye, 15=LEye, 16=REar, 17=LEar
    const lengthHead = Math.max(
        euclideanDist(1, 17),  // Neck to LEar
        euclideanDist(1, 16),  // Neck to REar
        euclideanDist(1, 15),  // Neck to LEye
        euclideanDist(1, 14),  // Neck to REye
        euclideanDist(0, 17),  // Nose to LEar
        euclideanDist(0, 16),  // Nose to REar
        euclideanDist(0, 15),  // Nose to LEye
        euclideanDist(0, 14)   // Nose to REye
    );

    // Calculate torso length
    // Indices: 1=Neck, 8=RHip, 11=LHip
    const lengthTorso = Math.max(
        euclideanDist(1, 11),  // Neck to LHip
        euclideanDist(1, 8)    // Neck to RHip
    );

    // Calculate leg lengths
    // Indices: 8=RHip, 9=RKnee, 10=RAnkle, 11=LHip, 12=LKnee, 13=LAnkle
    const lengthLegRight = euclideanDist(8, 9) + euclideanDist(9, 10);
    const lengthLegLeft = euclideanDist(11, 12) + euclideanDist(12, 13);
    const lengthLeg = Math.max(lengthLegRight, lengthLegLeft);

    // Total body length
    let lengthBody = lengthHead + lengthTorso + lengthLeg;

    // Check if length_body is 0
    const lengthChk = lengthBody > 0 ? 1 : 0;

    // Set all length_body of 0 to 1 (to avoid division by 0)
    if (lengthBody === 0) {
        lengthBody = 1;
    }

    // The center of gravity
    // Python: num_pts = (X[:, 0::2] > 0).sum(1)
    // Count how many values in evenIndices are > 0
    let numPts = 0;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < 18; i++) {
        if (evenIndices[i] > 0) {
            numPts++;
            sumX += evenIndices[i];
            sumY += oddIndices[i];
        }
    }

    const centerX = numPts > 0 ? sumX / numPts : 0;
    const centerY = numPts > 0 ? sumY / numPts : 0;

    // The coordinates are normalized relative to the length of the body and the center of gravity
    const xsNorm: number[] = [];
    const ysNorm: number[] = [];
    for (let i = 0; i < 18; i++) {
        xsNorm.push((evenIndices[i] - centerX) / lengthBody);
        ysNorm.push((oddIndices[i] - centerY) / lengthBody);
    }

    // Create interleaved output
    // Python: X_norm = np.column_stack((X_norm_x[:, :1], X_norm_y[:, :1]))
    //         for i in range(1, X.shape[1] // 2):
    //             X_norm = np.column_stack((X_norm, X_norm_x[:, i:i+1], X_norm_y[:, i:i+1]))
    const normalized = new Float32Array(36);
    for (let i = 0; i < 18; i++) {
        normalized[i * 2] = xsNorm[i];
        normalized[i * 2 + 1] = ysNorm[i];
    }

    // Set all samples have length_body of 0 to origin (0, 0)
    // Python: X_norm = X_norm * chk
    // Also check keypoints at origin: keypoints_chk = (X > 0).astype(int)
    for (let i = 0; i < 18; i++) {
        const keypointChk = (evenIndices[i] > 0 || oddIndices[i] > 0) ? 1 : 0;
        const chk = lengthChk * keypointChk;
        normalized[i * 2] *= chk;
        normalized[i * 2 + 1] *= chk;
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

    // Find the exercise with the highest probability
    for (let i = 1; i < modelOutput.length; i++) {
        if (modelOutput[i] > maxValue) {
            maxValue = modelOutput[i];
            maxIndex = i;
        }
    }

    console.log(`[DeepFit] Detected: ${EXERCISE_LABELS[maxIndex]} (confidence: ${maxValue.toFixed(4)})`);
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
 * Calculate body angles from landmarks (supports both MediaPipe 33 and MoveNet 17)
 * MediaPipe landmark indices:
 * 11: Left Shoulder, 12: Right Shoulder
 * 13: Left Elbow, 14: Right Elbow
 * 15: Left Wrist, 16: Right Wrist
 * 23: Left Hip, 24: Right Hip
 * 25: Left Knee, 26: Right Knee
 * 27: Left Ankle, 28: Right Ankle
 * 
 * MoveNet landmark indices:
 * 5: Left Shoulder, 6: Right Shoulder
 * 7: Left Elbow, 8: Right Elbow
 * 9: Left Wrist, 10: Right Wrist
 * 11: Left Hip, 12: Right Hip
 * 13: Left Knee, 14: Right Knee
 * 15: Left Ankle, 16: Right Ankle
 */
export function calculateBodyAngles(landmarks: Keypoint[]): BodyAngles {
    if (landmarks.length === 33) {
        // MediaPipe format
        return {
            elbowLeft: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
            elbowRight: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
            shoulderLeft: calculateAngle(landmarks[13], landmarks[11], landmarks[23]),
            shoulderRight: calculateAngle(landmarks[14], landmarks[12], landmarks[24]),
            hipLeft: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
            hipRight: calculateAngle(landmarks[12], landmarks[24], landmarks[26]),
            kneeLeft: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
            kneeRight: calculateAngle(landmarks[24], landmarks[26], landmarks[28])
        };
    } else if (landmarks.length === 17) {
        // MoveNet format
        return {
            elbowLeft: calculateAngle(landmarks[5], landmarks[7], landmarks[9]),
            elbowRight: calculateAngle(landmarks[6], landmarks[8], landmarks[10]),
            shoulderLeft: calculateAngle(landmarks[7], landmarks[5], landmarks[11]),
            shoulderRight: calculateAngle(landmarks[8], landmarks[6], landmarks[12]),
            hipLeft: calculateAngle(landmarks[5], landmarks[11], landmarks[13]),
            hipRight: calculateAngle(landmarks[6], landmarks[12], landmarks[14]),
            kneeLeft: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
            kneeRight: calculateAngle(landmarks[12], landmarks[14], landmarks[16])
        };
    } else {
        throw new Error(`Expected 33 (MediaPipe) or 17 (MoveNet) landmarks, got ${landmarks.length}`);
    }
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
