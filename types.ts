/**
 * Type definitions for iSparta fitness tracking application
 */

export type ExerciseType = 'reps' | 'seconds';

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
    UNKNOWN = 'UNKNOWN'
}

export enum MuscleGroup {
    ARMS = 'ARMS', // Руки
    LEGS = 'LEGS', // Ноги
    CHEST = 'CHEST', // Грудь
    BACK = 'BACK', // Спина
    RUNNING = 'RUNNING', // Бег
}

type ExerciseNumbers = {
    [K in EXERCISES]: number // reps or seconds
};


export interface TodayResults extends ExerciseNumbers {
    topMuscleGroup: MuscleGroup;
    trainedDifferentGroupYesterday: boolean;
    bonusForFirst30SecondsInExerciseInFullUserHistory: number;
    bonusExerciseNamesConcatenated: string;
}

export interface Last7DaysResults extends ExerciseNumbers {
    allMuscleGroupsTrained: boolean;
    completedNewExerciseForTheFirstTime: boolean;
}


type ExerciseUnlockBonus = {
    [K in EXERCISES]: {
        conditionToUnlock: { type: ExerciseType; value: number };
        amount: Partial<Record<MuscleGroup, number>>;
    }
};

type ExerciseProgressBonus = {
    [K in EXERCISES]: {
        conditionToGetBonus: { type: ExerciseType; value: number };
        amount: Partial<Record<MuscleGroup, number>>;
    }
};

export type ExerciseProgress = {
    [K in EXERCISES]: {
        durationSeconds: number;
        reps?: number;
    }
}

type ProfileBonus = {
    [K in EXERCISES]: {
        unlockedDate: Date;
        bonus: {
            ByLastWeek: number;
            ByLastMonth: number;
            ByLastYear: number;
            averagedByWeeks: number;
        };
        count: {
            ByLastWeek: number;
            ByLastMonth: number;
            ByLastYear: number;
            averagedByWeeks: number;
            counterType: ExerciseType;
        }
        countOfUnlockedExercises: number;
    }
}


export const EXERCISE_MUSCLE_GROUP_POINTS: ExerciseUnlockBonus = {
    [EXERCISES.SQUATS]: { conditionToUnlock: { type: 'reps', value: 5 }, amount: { [MuscleGroup.LEGS]: 1, [MuscleGroup.ARMS]: 2 } },
    [EXERCISES.LUNGES]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.LEGS]: 1 } },
    [EXERCISES.BICEP_CURLS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.ARMS]: 1 } },
    [EXERCISES.SITUPS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.CHEST]: 1 } },
    [EXERCISES.PUSHUPS]: { conditionToUnlock: { type: 'reps', value: 5 }, amount: { [MuscleGroup.CHEST]: 1 } },
    [EXERCISES.TRICEP_EXTENSIONS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.ARMS]: 1 } },
    [EXERCISES.DUMBBELL_ROWS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.BACK]: 1 } },
    [EXERCISES.JUMPING_JACKS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.LEGS]: 1 } },
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.ARMS]: 1 } },
    [EXERCISES.LATERAL_SHOULDER_RAISES]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: { [MuscleGroup.ARMS]: 1 } },
    [EXERCISES.UNKNOWN]: { conditionToUnlock: { type: 'seconds', value: 30 }, amount: {} }
};

export const ExerciseType: Record<EXERCISES, ExerciseType> = {
    [EXERCISES.SQUATS]: 'reps',
    [EXERCISES.PUSHUPS]: 'reps',
    [EXERCISES.LUNGES]: 'seconds',
    [EXERCISES.BICEP_CURLS]: 'seconds',
    [EXERCISES.SITUPS]: 'seconds',
    [EXERCISES.TRICEP_EXTENSIONS]: 'seconds',
    [EXERCISES.DUMBBELL_ROWS]: 'seconds',
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: 'seconds',
    [EXERCISES.JUMPING_JACKS]: 'seconds',
    [EXERCISES.LATERAL_SHOULDER_RAISES]: 'seconds',
    [EXERCISES.UNKNOWN]: 'seconds',
};

export const messagesExercises = {
    en: {
        [EXERCISES.SQUATS]: 'Squats',
        [EXERCISES.PUSHUPS]: 'Pushups',
        [EXERCISES.LUNGES]: 'Lunges',
        [EXERCISES.BICEP_CURLS]: 'Bicep curls',
        [EXERCISES.SITUPS]: 'Situps',
        [EXERCISES.TRICEP_EXTENSIONS]: 'Tricep extensions',
        [EXERCISES.DUMBBELL_ROWS]: 'Dumbbell rows',
        [EXERCISES.DUMBBELL_SHOULDER_PRESS]: 'Dumbbell shoulder press',
        [EXERCISES.JUMPING_JACKS]: 'Jumping jacks',
        [EXERCISES.LATERAL_SHOULDER_RAISES]: 'Lateral shoulder raises',
        [EXERCISES.UNKNOWN]: 'Unknown',
    }
}

/**
 * Virtual date offset for testing (in days)
 * Used to simulate different dates for NRA testing
 */
export interface DateOffset {
    days: number; // Number of days to offset from current date
}

export interface QueueItem {
    name: EXERCISES;
    confidence: number;
}