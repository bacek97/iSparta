/**
 * Type definitions for iSparta fitness tracking application
 */

import { MuscleGroup } from './instructions_to_build_profile';

/**
 * User profile with personal information and statistics
 */
export interface UserProfile {
    id: string;
    name: string;
    avatar?: string; // Optional avatar URL or base64
    createdAt: Date;
    totalWorkouts: number;
    totalReps: number; // Total reps for rep-based exercises
    totalMinutes: number; // Total minutes for time-based exercises
    currentStreakWeeks: number; // Current consecutive weeks with workouts
    bestStreakWeeks: number; // Best streak ever achieved
    currentNRA: number; // Current Weekly NRA score
    bestNRA: number; // Best NRA score ever achieved
}

/**
 * Exercise type - determines how it's tracked
 */
export type ExerciseType = 'reps' | 'time';

/**
 * Exercise record for a single exercise in a workout
 */
export interface ExerciseRecord {
    exerciseName: string; // From EXERCISE_LABELS
    exerciseType: ExerciseType; // 'reps' for squats/pushups, 'time' for others
    muscleGroup: MuscleGroup; // Which muscle group this exercise targets

    // For rep-based exercises (squats, pushups)
    reps?: number;

    // For time-based exercises (all others)
    durationSeconds?: number;

    // Metadata
    startTime: Date;
    endTime: Date;
    formQuality: number; // 0-1, average form quality during exercise
}

/**
 * Workout session containing multiple exercises
 */
export interface WorkoutSession {
    id: string;
    userId: string;
    date: Date; // Date of the workout
    exercises: ExerciseRecord[];
    totalDurationSeconds: number;
    dominantMuscleGroup: MuscleGroup; // Primary muscle group worked this session
    nraContribution: number; // How much this session contributed to weekly NRA
    completed: boolean; // Whether session was properly finished
}

/**
 * Weekly statistics for NRA calculation
 */
export interface WeeklyStats {
    weekStartDate: Date; // Monday of the week
    weekEndDate: Date; // Sunday of the week
    sessions: WorkoutSession[];
    totalVolume: number; // Total reps + minutes for the week
    muscleGroupsWorked: MuscleGroup[]; // Unique muscle groups this week
    daysActive: number; // Number of days with workouts
    nraScore: number; // Final NRA for this week
    nraComponents: {
        wds: number; // Weekly Discipline Score
        multiplier: number; // Long-term multiplier
        was: number; // Weekly Activity Score
        wms: number; // Weekly Mastery Score
    };
}

/**
 * Leaderboard entry for a user
 */
export interface LeaderboardEntry {
    userId: string;
    userName: string;
    avatar?: string;
    nraScore: number;
    streakWeeks: number;
    rank: number; // Position in leaderboard (1-based)
    weekStartDate: Date; // Which week this score is for
}

/**
 * Exercise configuration - maps exercise names to their properties
 */
export interface ExerciseConfig {
    name: string;
    type: ExerciseType;
    muscleGroup: MuscleGroup;
    displayName: string; // Human-readable name
}

/**
 * Mapping of exercise names to muscle groups
 * Based on EXERCISE_LABELS from deepfitUtils.ts
 */
export const EXERCISE_MUSCLE_GROUP_MAP: Record<string, MuscleGroup> = {
    'squats': MuscleGroup.LEGS,
    'lunges': MuscleGroup.LEGS,
    'bicep_curls': MuscleGroup.ARMS,
    'situps': MuscleGroup.CHEST,
    'pushups': MuscleGroup.CHEST,
    'tricep_extensions': MuscleGroup.ARMS,
    'dumbbell_rows': MuscleGroup.BACK,
    'jumping_jacks': MuscleGroup.CARDIO,
    'dumbbell_shoulder_press': MuscleGroup.ARMS,
    'lateral_shoulder_raises': MuscleGroup.ARMS,
};

/**
 * Exercise configurations
 */
export const EXERCISE_CONFIGS: ExerciseConfig[] = [
    { name: 'squats', type: 'reps', muscleGroup: MuscleGroup.LEGS, displayName: 'Squats' },
    { name: 'pushups', type: 'reps', muscleGroup: MuscleGroup.CHEST, displayName: 'Push-ups' },
    { name: 'lunges', type: 'time', muscleGroup: MuscleGroup.LEGS, displayName: 'Lunges' },
    { name: 'bicep_curls', type: 'time', muscleGroup: MuscleGroup.ARMS, displayName: 'Bicep Curls' },
    { name: 'situps', type: 'time', muscleGroup: MuscleGroup.CHEST, displayName: 'Sit-ups' },
    { name: 'tricep_extensions', type: 'time', muscleGroup: MuscleGroup.ARMS, displayName: 'Tricep Extensions' },
    { name: 'dumbbell_rows', type: 'time', muscleGroup: MuscleGroup.BACK, displayName: 'Dumbbell Rows' },
    { name: 'jumping_jacks', type: 'time', muscleGroup: MuscleGroup.CARDIO, displayName: 'Jumping Jacks' },
    { name: 'dumbbell_shoulder_press', type: 'time', muscleGroup: MuscleGroup.ARMS, displayName: 'Shoulder Press' },
    { name: 'lateral_shoulder_raises', type: 'time', muscleGroup: MuscleGroup.ARMS, displayName: 'Lateral Raises' },
];

/**
 * Get exercise configuration by name
 */
export function getExerciseConfig(exerciseName: string): ExerciseConfig | undefined {
    return EXERCISE_CONFIGS.find(config => config.name === exerciseName);
}

/**
 * Virtual date offset for testing (in days)
 * Used to simulate different dates for NRA testing
 */
export interface DateOffset {
    days: number; // Number of days to offset from current date
}
