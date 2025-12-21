/**
 * Server Sync Service
 * Handles sending workout data to Hasura Action which calls Deno for bonus calculations
 * 
 * Architecture: App → Hasura Action → Deno → Hasura Database
 */

import { SimpleWorkoutSession, SimpleExerciseRecord } from './exerciseTrackingService';
import { EXERCISES } from './types';

// Hasura GraphQL endpoint (Actions go through this)
const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';

// Types matching server expectations
export interface ServerWorkoutSession {
    signature: string;
    user_public_key: string;
    session_date: string;
    exercise_sets: ServerExerciseSet[];
}

export interface ServerExerciseSet {
    hash_shazam: string;
    exercise_type: string;
    exercise_category: 'REPS' | 'KILOMETERS' | 'SECONDS' | 'STEPS';
    set_date: string;
    seconds: number;
    reps?: number;
    kilometers?: number;
    // New fields for running tracking
    svg_path_d?: string;
    route_points?: any; // JSONB
    route_bounds?: any; // JSONB
}

export interface UserData {
    publicKey: string;
    fmsCategory: 'JUNIOR' | 'MIDDLE' | 'SENIOR';
}

export interface BonusBreakdownSummary {
    bonus_tech_factor: number;
    bonus_speed: number;
    bonus_for_starters: number;
    bonus_another_muscle_yesterday: number;
    bonus_weeks_in_streak: number;
    total_points: number;
}

export interface BonusResponse {
    sessionSignature: string;
    sessionDate: string;
    basePoints: number;
    bonusTechFactor: number;
    bonusSpeed: number;
    bonusForStarters: number;
    bonusAnotherMuscleYesterday: number;
    bonusWeeksInStreak: number;
    totalPoints: number;
    exerciseBreakdown: ExerciseBreakdown[];
}

export interface ExerciseBreakdown {
    exerciseType: string;
    calories: number;
    repsOrDuration: number;
    points: number;
}

export interface SyncResult {
    success: boolean;
    bonusData?: BonusResponse;
    error?: string;
}

/**
 * Normalize date to ISO string - handles both Date objects and string dates
 */
export function normalizeToISOString(date: Date | string | null | undefined): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString();
    return new Date().toISOString();
}

/**
 * Convert SimpleWorkoutSession to server format
 */
export function convertToServerFormat(
    session: SimpleWorkoutSession,
    userPublicKey: string
): ServerWorkoutSession {
    const exerciseSets: ServerExerciseSet[] = [];
    const sessionDate = normalizeToISOString(session.startTime);

    Object.entries(session.exercises).forEach(([exerciseName, record]) => {
        const exercise = exerciseName as EXERCISES;
        if (exercise === EXERCISES.UNKNOWN) return;

        const exerciseSet: ServerExerciseSet = {
            hash_shazam: `${session.sessionId}_${exercise}_${Date.now()}`,
            exercise_type: exercise,
            exercise_category: record.reps !== undefined ? 'REPS' : 'SECONDS',
            set_date: sessionDate,
            seconds: record.duration || 0,
            reps: record.reps,
        };

        // Handle KILOMETERS category and extra fields
        if (record.kilometers !== undefined) {
            exerciseSet.exercise_category = 'KILOMETERS';
            exerciseSet.kilometers = record.kilometers;

            // Map new running fields
            if (record['svg:path[d]']) {
                exerciseSet.svg_path_d = record['svg:path[d]'];
            }
            if (record.route_points) {
                exerciseSet.route_points = record.route_points;
            }
            if (record.route_bounds) {
                exerciseSet.route_bounds = record.route_bounds;
            }
        }

        exerciseSets.push(exerciseSet);
    });

    return {
        signature: session.sessionId,
        user_public_key: userPublicKey,
        session_date: sessionDate,
        exercise_sets: exerciseSets,
    };
}

/**
 * Send workout session via Hasura Action
 * The Action will call Deno to calculate bonuses and save to database
 */
export async function sendWorkoutToServer(
    session: SimpleWorkoutSession,
    userData: UserData
): Promise<BonusResponse> {
    const serverSession = convertToServerFormat(session, userData.publicKey);

    // Call Hasura Action (sync_workout_session)
    const mutation = `
        mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
            sync_workout_session(session: $session, user: $user) {
                signature
                session_date
                base_points
                total_points
                bonus_breakdown {
                    bonus_tech_factor
                    bonus_speed
                    bonus_for_starters
                    bonus_another_muscle_yesterday
                    bonus_weeks_in_streak
                    total_points
                }
            }
        }
    `;

    const variables = {
        session: {
            signature: serverSession.signature,
            user_public_key: serverSession.user_public_key,
            session_date: serverSession.session_date,
            exercise_sets: serverSession.exercise_sets.map(set => ({
                hash_shazam: set.hash_shazam,
                exercise_type: set.exercise_type,
                exercise_category: set.exercise_category,
                set_date: set.set_date,
                seconds: set.seconds,
                reps: set.reps || null,
                kilometers: set.kilometers || null,
                svg_path_d: set.svg_path_d || null,
                route_points: set.route_points || null,
                route_bounds: set.route_bounds || null,
            })),
        },
        user: {
            public_key: userData.publicKey,
            fms_category: userData.fmsCategory,
        },
    };

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

    if (result.errors) {
        console.error('Hasura Action error:', result.errors);
        throw new Error(`Hasura error: ${result.errors[0].message}`);
    }

    const data = result.data.sync_workout_session;

    // Convert to BonusResponse format
    return {
        sessionSignature: data.signature,
        sessionDate: data.session_date,
        basePoints: data.base_points || 0,
        bonusTechFactor: data.bonus_breakdown?.bonus_tech_factor || 0,
        bonusSpeed: data.bonus_breakdown?.bonus_speed || 0,
        bonusForStarters: data.bonus_breakdown?.bonus_for_starters || 0,
        bonusAnotherMuscleYesterday: data.bonus_breakdown?.bonus_another_muscle_yesterday || 0,
        bonusWeeksInStreak: data.bonus_breakdown?.bonus_weeks_in_streak || 0,
        totalPoints: data.total_points || 0,
        exerciseBreakdown: [],
    };
}

/**
 * Complete sync flow: send to Hasura Action
 */
export async function syncWorkoutSession(
    session: SimpleWorkoutSession,
    userData: UserData
): Promise<SyncResult> {
    try {
        const bonusData = await sendWorkoutToServer(session, userData);
        return {
            success: true,
            bonusData,
        };
    } catch (error) {
        console.error('Sync error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
