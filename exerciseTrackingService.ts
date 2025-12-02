/**
 * Exercise tracking service
 * Manages workout sessions and tracks exercises (reps or time-based)
 */

import {
    WorkoutSession,
    ExerciseRecord,
    UserProfile,
    ExerciseType,
    getExerciseConfig,
    EXERCISE_MUSCLE_GROUP_MAP,
} from './types';
import { MuscleGroup } from './instructions_to_build_profile';
import { ExerciseState } from './deepfitUtils';
import { saveWorkoutSession, loadUserProfile, saveUserProfile } from './storageService';
import { getVirtualDate } from './testingUtils';

/**
 * Current active workout session (in-memory)
 */
let currentSession: WorkoutSession | null = null;
let currentExercise: ExerciseRecord | null = null;
let currentExerciseName: string | null = null;
let exerciseStartTime: Date | null = null;

/**
 * Start a new workout session
 */
export async function startWorkoutSession(userId: string): Promise<WorkoutSession> {
    const virtualDate = await getVirtualDate();

    currentSession = {
        id: `session_${Date.now()}`,
        userId,
        date: virtualDate,
        exercises: [],
        totalDurationSeconds: 0,
        dominantMuscleGroup: MuscleGroup.NONE,
        nraContribution: 0,
        completed: false,
    };

    console.log(`[ExerciseTracking] Started new workout session: ${currentSession.id}`);
    return currentSession;
}

/**
 * Detect exercise change and save previous exercise if needed
 */
export async function handleExerciseChange(
    newExerciseName: string,
    exerciseState: ExerciseState
): Promise<void> {
    if (!currentSession) {
        console.warn('[ExerciseTracking] No active session');
        return;
    }

    // If exercise changed, save the previous one
    if (currentExerciseName && currentExerciseName !== newExerciseName) {
        await finishCurrentExercise(exerciseState);
    }

    // Start tracking new exercise
    if (currentExerciseName !== newExerciseName) {
        await startExercise(newExerciseName);
    }
}

/**
 * Start tracking a new exercise
 */
async function startExercise(exerciseName: string): Promise<void> {
    const config = getExerciseConfig(exerciseName);
    if (!config) {
        console.warn(`[ExerciseTracking] Unknown exercise: ${exerciseName}`);
        return;
    }

    const virtualDate = await getVirtualDate();
    exerciseStartTime = virtualDate;
    currentExerciseName = exerciseName;

    currentExercise = {
        exerciseName,
        exerciseType: config.type,
        muscleGroup: config.muscleGroup,
        startTime: virtualDate,
        endTime: virtualDate, // Will be updated when finished
        formQuality: 0,
    };

    console.log(`[ExerciseTracking] Started tracking: ${exerciseName} (${config.type})`);
}

/**
 * Finish the current exercise and add it to the session
 */
async function finishCurrentExercise(exerciseState: ExerciseState): Promise<void> {
    if (!currentExercise || !exerciseStartTime || !currentSession) {
        return;
    }

    const virtualDate = await getVirtualDate();
    currentExercise.endTime = virtualDate;

    const config = getExerciseConfig(currentExercise.exerciseName);
    if (!config) return;

    // Calculate duration
    const durationMs = currentExercise.endTime.getTime() - currentExercise.startTime.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);

    // Set reps or duration based on exercise type
    if (config.type === 'reps') {
        // For squats and pushups, use the count from exerciseState
        currentExercise.reps = Math.floor(exerciseState.count);
        console.log(`[ExerciseTracking] Finished ${currentExercise.exerciseName}: ${currentExercise.reps} reps`);
    } else {
        // For time-based exercises, use duration
        currentExercise.durationSeconds = durationSeconds;
        console.log(`[ExerciseTracking] Finished ${currentExercise.exerciseName}: ${durationSeconds}s`);
    }

    // Calculate average form quality (simplified - using current form)
    currentExercise.formQuality = exerciseState.form;

    // Add to session
    currentSession.exercises.push(currentExercise);

    // Reset current exercise
    currentExercise = null;
    currentExerciseName = null;
    exerciseStartTime = null;
}

/**
 * Update exercise progress (called on each frame)
 */
export function updateExerciseProgress(
    exerciseName: string,
    exerciseState: ExerciseState
): void {
    // Just track the exercise name change
    // The actual saving happens in handleExerciseChange
    if (currentExerciseName !== exerciseName) {
        // Exercise changed - this will be handled by handleExerciseChange
    }
}

/**
 * Complete and save the current workout session
 */
export async function completeWorkoutSession(
    exerciseState: ExerciseState
): Promise<WorkoutSession | null> {
    if (!currentSession) {
        console.warn('[ExerciseTracking] No active session to complete');
        return null;
    }

    // Finish current exercise if any
    if (currentExercise) {
        await finishCurrentExercise(exerciseState);
    }

    // Calculate total duration
    if (currentSession.exercises.length > 0) {
        const firstStart = currentSession.exercises[0].startTime;
        const lastEnd = currentSession.exercises[currentSession.exercises.length - 1].endTime;
        currentSession.totalDurationSeconds = Math.floor(
            (lastEnd.getTime() - firstStart.getTime()) / 1000
        );
    }

    // Determine dominant muscle group (most worked)
    const muscleGroupCounts: Record<string, number> = {};
    currentSession.exercises.forEach(ex => {
        const group = ex.muscleGroup;
        muscleGroupCounts[group] = (muscleGroupCounts[group] || 0) + 1;
    });

    let maxCount = 0;
    let dominantGroup = MuscleGroup.NONE;
    Object.entries(muscleGroupCounts).forEach(([group, count]) => {
        if (count > maxCount) {
            maxCount = count;
            dominantGroup = group as MuscleGroup;
        }
    });
    currentSession.dominantMuscleGroup = dominantGroup;

    // Mark as completed
    currentSession.completed = true;

    // Save to storage
    await saveWorkoutSession(currentSession);

    // Update user profile stats
    await updateUserProfileStats(currentSession);

    console.log(`[ExerciseTracking] Completed workout session: ${currentSession.id}`);
    console.log(`  - Exercises: ${currentSession.exercises.length}`);
    console.log(`  - Duration: ${currentSession.totalDurationSeconds}s`);
    console.log(`  - Dominant muscle group: ${currentSession.dominantMuscleGroup}`);

    const completedSession = currentSession;

    // Reset current session
    currentSession = null;
    currentExercise = null;
    currentExerciseName = null;
    exerciseStartTime = null;

    return completedSession;
}

/**
 * Update user profile statistics after completing a session
 */
async function updateUserProfileStats(session: WorkoutSession): Promise<void> {
    const profile = await loadUserProfile();
    if (!profile) return;

    // Update total workouts
    profile.totalWorkouts += 1;

    // Update total reps and minutes
    session.exercises.forEach(ex => {
        if (ex.reps) {
            profile.totalReps += ex.reps;
        }
        if (ex.durationSeconds) {
            profile.totalMinutes += Math.floor(ex.durationSeconds / 60);
        }
    });

    await saveUserProfile(profile);
    console.log('[ExerciseTracking] Updated user profile stats');
}

/**
 * Get current session info
 */
export function getCurrentSession(): WorkoutSession | null {
    return currentSession;
}

/**
 * Get current exercise info
 */
export function getCurrentExercise(): ExerciseRecord | null {
    return currentExercise;
}

/**
 * Cancel current session without saving
 */
export function cancelWorkoutSession(): void {
    currentSession = null;
    currentExercise = null;
    currentExerciseName = null;
    exerciseStartTime = null;
    console.log('[ExerciseTracking] Workout session cancelled');
}
