/**
 * Step Counter Service
 * Manages step counting, storage, and sync with server
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseSet } from './common_types';
import { getVirtualDate } from './testingUtils';

// Native module
const { StepCounter } = NativeModules;
const stepCounterEmitter = StepCounter ? new NativeEventEmitter(StepCounter) : null;

// Storage keys
const STORAGE_KEYS = {
    TODAY_BASELINE: '@iSparta:step_today_baseline',
    TODAY_DATE: '@iSparta:step_today_date',
    STEPS_PREFIX: '@iSparta:steps_',
};

// Event listeners
type StepListener = (steps: number) => void;
const stepListeners: Set<StepListener> = new Set();
let eventSubscription: any = null;

/**
 * Format date to YYYY-MM-DD using local timezone
 */
function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date string YYYY-MM-DD
 */
async function getTodayDateString(): Promise<string> {
    const today = await getVirtualDate();
    return formatDateKey(today);
}

/**
 * Check if step counter is available
 */
export async function isStepCounterAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android' || !StepCounter) {
        return false;
    }
    try {
        return await StepCounter.isAvailable();
    } catch (error) {
        console.error('[StepCounterService] Error checking availability:', error);
        return false;
    }
}

/**
 * Get current step count from native module
 */
export async function getCurrentSteps(): Promise<number> {
    if (!StepCounter) {
        console.warn('[StepCounterService] StepCounter native module not available');
        return 0;
    }
    try {
        const steps = await StepCounter.getCurrentSteps();
        console.log('[StepCounterService] getCurrentSteps:', steps);
        return steps;
    } catch (error) {
        console.error('[StepCounterService] Error getting current steps:', error);
        return 0;
    }
}

/**
 * Start listening to step counter and get initial value
 */
export async function startStepCounter(): Promise<number> {
    if (!StepCounter || !stepCounterEmitter) {
        console.warn('[StepCounterService] StepCounter native module not available');
        return 0;
    }

    try {
        const result = await StepCounter.startListening();
        console.log('[StepCounterService] Started listening:', result);

        // Get current step count immediately
        const totalSteps = await getCurrentSteps();
        const todaySteps = await calculateTodaySteps(totalSteps);
        console.log('[StepCounterService] Initial steps - total:', totalSteps, 'today:', todaySteps);

        return todaySteps;
    } catch (error) {
        console.error('[StepCounterService] Error starting step counter:', error);
        return 0;
    }
}

/**
 * Stop listening to step counter
 */
export async function stopStepCounter(): Promise<boolean> {
    if (!StepCounter) return false;
    try {
        return await StepCounter.stopListening();
    } catch (error) {
        console.error('[StepCounterService] Error stopping step counter:', error);
        return false;
    }
}

/**
 * Calculate today's steps from total steps since boot
 * Stores baseline at start of each day
 */
async function calculateTodaySteps(totalStepsSinceBoot: number): Promise<number> {
    const todayStr = await getTodayDateString();
    const storedDate = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_DATE);
    const storedBaseline = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_BASELINE);

    console.log('[StepCounterService] Total since boot:', totalStepsSinceBoot,
        'Today:', todayStr, 'StoredDate:', storedDate, 'StoredBaseline:', storedBaseline);

    // New day or first time - set baseline
    if (storedDate !== todayStr || !storedBaseline) {
        console.log('[StepCounterService] New day or first time - setting baseline');
        await AsyncStorage.setItem(STORAGE_KEYS.TODAY_DATE, todayStr);
        await AsyncStorage.setItem(STORAGE_KEYS.TODAY_BASELINE, totalStepsSinceBoot.toString());
        return 0; // Start of new day
    }

    const baseline = parseInt(storedBaseline, 10);

    // Device rebooted (totalSteps < baseline)
    if (totalStepsSinceBoot < baseline) {
        console.log('[StepCounterService] Device rebooted - resetting baseline');
        await AsyncStorage.setItem(STORAGE_KEYS.TODAY_BASELINE, '0');
        return totalStepsSinceBoot;
    }

    const todaySteps = totalStepsSinceBoot - baseline;
    console.log('[StepCounterService] Today steps:', todaySteps);
    return todaySteps;
}

/**
 * Subscribe to step count changes
 */
export function subscribeToSteps(listener: StepListener): () => void {
    stepListeners.add(listener);

    // Start native listener and subscribe to events if first subscriber
    if (stepListeners.size === 1 && stepCounterEmitter && !eventSubscription) {
        startStepCounter();

        // Subscribe to native events
        eventSubscription = stepCounterEmitter.addListener('onStepCountChanged', async (event) => {
            const { totalSteps } = event;
            console.log('[StepCounterService] Event received - totalSteps:', totalSteps);

            const todaySteps = await calculateTodaySteps(totalSteps);

            // Save to AsyncStorage so getTodaySteps() can read it
            await saveSteps(todaySteps);

            // Notify all listeners
            stepListeners.forEach(l => l(todaySteps));
        });
    }

    // Return unsubscribe function
    return () => {
        stepListeners.delete(listener);
        if (stepListeners.size === 0 && eventSubscription) {
            eventSubscription.remove();
            eventSubscription = null;
            stopStepCounter();
        }
    };
}

/**
 * Get today's step count from storage
 */
export async function getTodaySteps(): Promise<number> {
    try {
        const todayStr = await getTodayDateString();
        const key = `${STORAGE_KEYS.STEPS_PREFIX}${todayStr}`;
        const value = await AsyncStorage.getItem(key);
        return value ? parseInt(value, 10) : 0;
    } catch (error) {
        console.error('[StepCounterService] Error getting today steps:', error);
        return 0;
    }
}

/**
 * Save step count for today
 */
export async function saveSteps(steps: number): Promise<void> {
    try {
        const todayStr = await getTodayDateString();
        const key = `${STORAGE_KEYS.STEPS_PREFIX}${todayStr}`;
        await AsyncStorage.setItem(key, steps.toString());
    } catch (error) {
        console.error('[StepCounterService] Error saving steps:', error);
    }
}

/**
 * Get steps for a specific date from storage
 */
export async function getStepsForDate(date: Date): Promise<number> {
    try {
        const dateStr = formatDateKey(date);
        const key = `${STORAGE_KEYS.STEPS_PREFIX}${dateStr}`;
        const value = await AsyncStorage.getItem(key);
        console.log('[StepCounterService] getStepsForDate:', dateStr, 'key:', key, 'value:', value);
        return value ? parseInt(value, 10) : 0;
    } catch (error) {
        console.error('[StepCounterService] Error getting steps for date:', error);
        return 0;
    }
}

/**
 * Get step baseline (starting point for today)
 */
export async function getStepBaseline(): Promise<number> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_BASELINE);
        return value ? parseInt(value, 10) : 0;
    } catch (error) {
        console.error('[StepCounterService] Error getting baseline:', error);
        return 0;
    }
}

/**
 * Set step baseline
 */
export async function setStepBaseline(sensorValue: number): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.TODAY_BASELINE, sensorValue.toString());
    } catch (error) {
        console.error('[StepCounterService] Error setting baseline:', error);
    }
}

/**
 * Calculate daily steps from sensor value (for tests)
 */
export async function calculateDailySteps(sensorValue: number): Promise<number> {
    return calculateTodaySteps(sensorValue);
}

/**
 * Create ExerciseSet for steps
 */
export function createStepExerciseSet(stepCount: number, date: Date): ExerciseSet {
    const dateStr = date.toISOString();
    const hash = `steps_${dateStr}_${stepCount}`;

    return {
        hash_shazam: hash,
        exercise_type: 'STEPS',
        exercise_category: 'STEPS',
        set_date: dateStr,
        seconds: 0,
        reps: stepCount,
    };
}

/**
 * Reset daily steps (called on day change)
 */
export async function resetDailySteps(currentSensorValue: number): Promise<void> {
    const todayStr = await getTodayDateString();
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_DATE, todayStr);
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_BASELINE, currentSensorValue.toString());
}

/**
 * Handle step sensor event (for tests)
 */
export async function handleStepSensorEvent(sensorValue: number): Promise<number> {
    const dailySteps = await calculateTodaySteps(sensorValue);
    await saveSteps(dailySteps);
    return dailySteps;
}

/**
 * Sync steps to server via Hasura Action
 */
export async function syncStepsToServer(
    userPublicKey: string,
    fmsCategory: 'JUNIOR' | 'MIDDLE' | 'SENIOR' = 'JUNIOR'
): Promise<{ success: boolean; points?: number; error?: string }> {
    try {
        const todaySteps = await getTodaySteps();

        if (todaySteps === 0) {
            console.log('[StepCounterService] No steps to sync (0 steps)');
            return { success: true, points: 0 };
        }

        const today = await getVirtualDate();
        const stepSet = createStepExerciseSet(todaySteps, today);

        console.log('[StepCounterService] Syncing steps to server:', todaySteps, 'steps');
        console.log('[StepCounterService] Exercise set:', JSON.stringify(stepSet));

        // Create a minimal session with just the steps
        const sessionId = `steps_${today.toISOString().split('T')[0]}_${Date.now()}`;

        const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';

        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    session_date
                    base_points
                    total_points
                }
            }
        `;

        const variables = {
            session: {
                signature: sessionId,
                user_public_key: userPublicKey,
                session_date: today.toISOString(),
                exercise_sets: [{
                    hash_shazam: stepSet.hash_shazam,
                    exercise_type: stepSet.exercise_type,
                    exercise_category: stepSet.exercise_category,
                    set_date: stepSet.set_date,
                    seconds: stepSet.seconds,
                    reps: stepSet.reps,
                }],
            },
            user: {
                public_key: userPublicKey,
                fms_category: fmsCategory,
            },
        };

        console.log('[StepCounterService] Sending to Hasura:', JSON.stringify(variables, null, 2));

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-role': 'anonymous',
            },
            body: JSON.stringify({ query: mutation, variables }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        console.log('[StepCounterService] Hasura response:', JSON.stringify(result));

        if (result.errors) {
            console.error('[StepCounterService] Hasura error:', result.errors);
            throw new Error(result.errors[0].message);
        }

        const points = result.data?.sync_workout_session?.total_points || 0;
        console.log('[StepCounterService] Steps synced successfully! Points:', points);

        return { success: true, points };
    } catch (error) {
        console.error('[StepCounterService] Error syncing steps:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
