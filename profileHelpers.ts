/**
 * Profile Helper Utilities
 * Functions for filtering and aggregating workout data
 */

import { SimpleWorkoutSession } from './exerciseTrackingService';
import { EXERCISES } from './types';

/**
 * Filter sessions by a specific date
 */
export function filterSessionsByDate(
    sessions: SimpleWorkoutSession[],
    date: Date
): SimpleWorkoutSession[] {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(s => {
        const sessionDate = new Date(s.startTime).toISOString().split('T')[0];
        return sessionDate === dateStr;
    });
}

/**
 * Get total running kilometers for sessions on a specific date
 */
export function getRunningKilometersForDate(
    sessions: SimpleWorkoutSession[],
    date: Date
): number {
    const filtered = filterSessionsByDate(sessions, date);
    let totalKm = 0;

    for (const session of filtered) {
        const running = session.exercises[EXERCISES.RUNNING];
        if (running && (running as any).kilometers) {
            totalKm += (running as any).kilometers;
        }
        const cycling = session.exercises[EXERCISES.CYCLING];
        if (cycling && (cycling as any).kilometers) {
            totalKm += (cycling as any).kilometers;
        }
    }

    return Math.round(totalKm * 10) / 10; // Round to 1 decimal
}

/**
 * Get total seconds for all exercises on a specific date
 */
export function getTotalSecondsForDate(
    sessions: SimpleWorkoutSession[],
    date: Date
): number {
    const filtered = filterSessionsByDate(sessions, date);
    let totalSeconds = 0;

    for (const session of filtered) {
        for (const record of Object.values(session.exercises)) {
            totalSeconds += record.duration || 0;
        }
    }

    return totalSeconds;
}

/**
 * Get total reps for all exercises on a specific date
 */
export function getTotalRepsForDate(
    sessions: SimpleWorkoutSession[],
    date: Date
): number {
    const filtered = filterSessionsByDate(sessions, date);
    let totalReps = 0;

    for (const session of filtered) {
        for (const record of Object.values(session.exercises)) {
            totalReps += record.reps || 0;
        }
    }

    return totalReps;
}
