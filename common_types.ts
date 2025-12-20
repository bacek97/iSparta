/**
 * Common Types - Shared between iSparta Client and Deno Server
 * 
 * IMPORTANT: This file is duplicated in both projects:
 * - iSparta/common_types.ts
 * - deno_isparta/common_types.ts
 * 
 * Keep them in sync manually when making changes.
 */

// ==================== ENUMS ====================

export enum EXERCISES {
    SQUATS = 'SQUATS',
    LUNGES = 'LUNGES',
    BICEP_CURLS = 'BICEP_CURLS',
    SITUPS = 'SITUPS',
    PUSHUPS = 'PUSHUPS',
    TRICEP_EXTENSIONS = 'TRICEP_EXTENSIONS',
    DUMBBELL_ROWS = 'DUMBBELL_ROWS',
    JUMPING_JACKS = 'JUMPING_JACKS',
    DUMBBELL_SHOULDER_PRESS = 'DUMBBELL_SHOULDER_PRESS',
    LATERAL_SHOULDER_RAISES = 'LATERAL_SHOULDER_RAISES',
    RUNNING = 'RUNNING',
    CYCLING = 'CYCLING',
    SWIMMING = 'SWIMMING',
    STEPS = 'STEPS',
    UNKNOWN = 'UNKNOWN'
}

export enum FMS_CATEGORY {
    JUNIOR = 'JUNIOR',
    MIDDLE = 'MIDDLE',
    SENIOR = 'SENIOR'
}

export enum EXERCISE_CATEGORY {
    REPS = 'REPS',
    KILOMETERS = 'KILOMETERS',
    SECONDS = 'SECONDS',
    STEPS = 'STEPS'
}

// ==================== EXERCISE SETS ====================

export interface ExerciseSet {
    hash_shazam: string;
    exercise_type: string;
    exercise_category: 'REPS' | 'KILOMETERS' | 'SECONDS' | 'STEPS';
    set_date: string; // ISO 8601 timestamp
    seconds: number;
    reps?: number;
    kilometers?: number;
    svg_path?: string; // For running/cycling routes
}

// ==================== WORKOUT SESSION ====================

export interface WorkoutSession {
    signature: string;
    user_public_key: string;
    session_date: string; // ISO 8601 timestamp
    exercise_sets: ExerciseSet[];
}

// ==================== USER DATA ====================

export interface UserData {
    public_key: string;
    fms_category: 'JUNIOR' | 'MIDDLE' | 'SENIOR';
}

// ==================== BONUS CALCULATION ====================

export interface ExercisePointsBreakdown {
    exercise_type: string;
    calories: number;
    reps_or_duration: number;
    points: number;
}

export interface BonusBreakdown {
    session_signature: string;
    session_date: string;
    base_points: number;
    bonus_tech_factor: number;
    bonus_speed: number;
    bonus_for_starters: number;
    bonus_another_muscle_yesterday: number;
    bonus_weeks_in_streak: number;
    total_points: number;
    exercise_breakdown: ExercisePointsBreakdown[];
}

export interface BonusCalculationInput {
    session: WorkoutSession;
    user: UserData;
    previous_sessions?: WorkoutSession[];
}

// ==================== TYPE GUARDS ====================

const REPS_EXERCISES: EXERCISES[] = [
    EXERCISES.SQUATS,
    EXERCISES.PUSHUPS
];

const KILOMETERS_EXERCISES: EXERCISES[] = [
    EXERCISES.RUNNING,
    EXERCISES.CYCLING,
    EXERCISES.SWIMMING
];

export function isRepsExercise(exercise: EXERCISES): boolean {
    return REPS_EXERCISES.includes(exercise);
}

export function isKilometersExercise(exercise: EXERCISES): boolean {
    return KILOMETERS_EXERCISES.includes(exercise);
}

export function isSecondsExercise(exercise: EXERCISES): boolean {
    return !isRepsExercise(exercise) && !isKilometersExercise(exercise);
}

// ==================== VALIDATORS ====================

export function validateExerciseSet(set: any): asserts set is ExerciseSet {
    if (!set.hash_shazam || typeof set.hash_shazam !== 'string') {
        throw new Error('Invalid hash_shazam');
    }
    if (!set.exercise_type || typeof set.exercise_type !== 'string') {
        throw new Error('Invalid exercise_type');
    }
    if (!['REPS', 'KILOMETERS', 'SECONDS', 'STEPS'].includes(set.exercise_category)) {
        throw new Error('Invalid exercise_category');
    }
    if (!set.set_date || typeof set.set_date !== 'string') {
        throw new Error('Invalid set_date');
    }
    if (typeof set.seconds !== 'number' || set.seconds < 0) {
        throw new Error('Invalid seconds');
    }
}

export function validateWorkoutSession(session: any): asserts session is WorkoutSession {
    if (!session.signature || typeof session.signature !== 'string') {
        throw new Error('Invalid signature');
    }
    if (!session.user_public_key || typeof session.user_public_key !== 'string') {
        throw new Error('Invalid user_public_key');
    }
    if (!session.session_date || typeof session.session_date !== 'string') {
        throw new Error('Invalid session_date');
    }
    if (!Array.isArray(session.exercise_sets)) {
        throw new Error('Invalid exercise_sets');
    }
}

// ==================== CONSTANTS ====================

export const EXERCISE_NAMES: Record<EXERCISES, string> = {
    [EXERCISES.SQUATS]: 'Squats',
    [EXERCISES.PUSHUPS]: 'Pushups',
    [EXERCISES.LUNGES]: 'Lunges',
    [EXERCISES.BICEP_CURLS]: 'Bicep Curls',
    [EXERCISES.SITUPS]: 'Situps',
    [EXERCISES.TRICEP_EXTENSIONS]: 'Tricep Extensions',
    [EXERCISES.DUMBBELL_ROWS]: 'Dumbbell Rows',
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: 'Dumbbell Shoulder Press',
    [EXERCISES.JUMPING_JACKS]: 'Jumping Jacks',
    [EXERCISES.LATERAL_SHOULDER_RAISES]: 'Lateral Shoulder Raises',
    [EXERCISES.RUNNING]: 'Running',
    [EXERCISES.CYCLING]: 'Cycling',
    [EXERCISES.SWIMMING]: 'Swimming',
    [EXERCISES.STEPS]: 'Steps',
    [EXERCISES.UNKNOWN]: 'Unknown'
};
