/**
 * Local storage service using AsyncStorage
 * Handles all data persistence for offline functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    UserProfile,
    WorkoutSession,
    WeeklyStats,
    LeaderboardEntry,
} from './types';

// Storage keys
const KEYS = {
    USER_PROFILE: '@iSparta:userProfile',
    WORKOUT_SESSIONS: '@iSparta:workoutSessions',
    WEEKLY_STATS: '@iSparta:weeklyStats',
    LEADERBOARD: '@iSparta:leaderboard',
};

/**
 * User Profile Operations
 */

export async function saveUserProfile(profile: UserProfile): Promise<void> {
    try {
        await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
        console.log('[Storage] User profile saved');
    } catch (error) {
        console.error('[Storage] Error saving user profile:', error);
        throw error;
    }
}

export async function loadUserProfile(): Promise<UserProfile | null> {
    try {
        const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
        if (!data) return null;

        const profile = JSON.parse(data);
        // Convert date strings back to Date objects
        profile.createdAt = new Date(profile.createdAt);

        console.log('[Storage] User profile loaded');
        return profile;
    } catch (error) {
        console.error('[Storage] Error loading user profile:', error);
        return null;
    }
}

export async function createDefaultProfile(): Promise<UserProfile> {
    const profile: UserProfile = {
        id: `user_${Date.now()}`,
        name: 'Спартанец',
        createdAt: new Date(),
        totalWorkouts: 0,
        totalReps: 0,
        totalMinutes: 0,
        currentStreakWeeks: 0,
        bestStreakWeeks: 0,
        currentNRA: 0,
        bestNRA: 0,
    };

    await saveUserProfile(profile);
    return profile;
}

/**
 * Workout Sessions Operations
 */

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
    try {
        const sessions = await loadWorkoutSessions();
        sessions.push(session);
        await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(sessions));
        console.log(`[Storage] Workout session saved (${session.id})`);
    } catch (error) {
        console.error('[Storage] Error saving workout session:', error);
        throw error;
    }
}

export async function loadWorkoutSessions(): Promise<WorkoutSession[]> {
    try {
        const data = await AsyncStorage.getItem(KEYS.WORKOUT_SESSIONS);
        if (!data) return [];

        const sessions = JSON.parse(data);
        // Convert date strings back to Date objects
        sessions.forEach((session: WorkoutSession) => {
            session.date = new Date(session.date);
            session.exercises.forEach(exercise => {
                exercise.startTime = new Date(exercise.startTime);
                exercise.endTime = new Date(exercise.endTime);
            });
        });

        return sessions;
    } catch (error) {
        console.error('[Storage] Error loading workout sessions:', error);
        return [];
    }
}

export async function getSessionsByDateRange(startDate: Date, endDate: Date): Promise<WorkoutSession[]> {
    const allSessions = await loadWorkoutSessions();
    return allSessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= startDate && sessionDate <= endDate;
    });
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
    try {
        const sessions = await loadWorkoutSessions();
        const filtered = sessions.filter(s => s.id !== sessionId);
        await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(filtered));
        console.log(`[Storage] Workout session deleted (${sessionId})`);
    } catch (error) {
        console.error('[Storage] Error deleting workout session:', error);
        throw error;
    }
}

/**
 * Weekly Stats Operations
 */

export async function saveWeeklyStats(stats: WeeklyStats): Promise<void> {
    try {
        const allStats = await loadAllWeeklyStats();

        // Find and replace existing stats for this week, or add new
        const existingIndex = allStats.findIndex(s =>
            s.weekStartDate.getTime() === stats.weekStartDate.getTime()
        );

        if (existingIndex >= 0) {
            allStats[existingIndex] = stats;
        } else {
            allStats.push(stats);
        }

        await AsyncStorage.setItem(KEYS.WEEKLY_STATS, JSON.stringify(allStats));
        console.log(`[Storage] Weekly stats saved for week starting ${stats.weekStartDate.toLocaleDateString()}`);
    } catch (error) {
        console.error('[Storage] Error saving weekly stats:', error);
        throw error;
    }
}

export async function loadAllWeeklyStats(): Promise<WeeklyStats[]> {
    try {
        const data = await AsyncStorage.getItem(KEYS.WEEKLY_STATS);
        if (!data) return [];

        const stats = JSON.parse(data);
        // Convert date strings back to Date objects
        stats.forEach((stat: WeeklyStats) => {
            stat.weekStartDate = new Date(stat.weekStartDate);
            stat.weekEndDate = new Date(stat.weekEndDate);
            stat.sessions.forEach(session => {
                session.date = new Date(session.date);
                session.exercises.forEach(exercise => {
                    exercise.startTime = new Date(exercise.startTime);
                    exercise.endTime = new Date(exercise.endTime);
                });
            });
        });

        return stats;
    } catch (error) {
        console.error('[Storage] Error loading weekly stats:', error);
        return [];
    }
}

export async function getWeeklyStatsForDate(date: Date): Promise<WeeklyStats | null> {
    const allStats = await loadAllWeeklyStats();
    return allStats.find(stat => {
        const statStart = new Date(stat.weekStartDate);
        const statEnd = new Date(stat.weekEndDate);
        return date >= statStart && date <= statEnd;
    }) || null;
}

/**
 * Leaderboard Operations
 */

export async function saveLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
    try {
        await AsyncStorage.setItem(KEYS.LEADERBOARD, JSON.stringify(entries));
        console.log(`[Storage] Leaderboard saved (${entries.length} entries)`);
    } catch (error) {
        console.error('[Storage] Error saving leaderboard:', error);
        throw error;
    }
}

export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const data = await AsyncStorage.getItem(KEYS.LEADERBOARD);
        if (!data) return [];

        const entries = JSON.parse(data);
        // Convert date strings back to Date objects
        entries.forEach((entry: LeaderboardEntry) => {
            entry.weekStartDate = new Date(entry.weekStartDate);
        });

        return entries;
    } catch (error) {
        console.error('[Storage] Error loading leaderboard:', error);
        return [];
    }
}

/**
 * Utility: Clear all data (for testing)
 */
export async function clearAllData(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([
            KEYS.USER_PROFILE,
            KEYS.WORKOUT_SESSIONS,
            KEYS.WEEKLY_STATS,
            KEYS.LEADERBOARD,
        ]);
        console.log('[Storage] All data cleared');
    } catch (error) {
        console.error('[Storage] Error clearing data:', error);
        throw error;
    }
}

/**
 * Utility: Get storage info
 */
export async function getStorageInfo(): Promise<{
    profileExists: boolean;
    sessionCount: number;
    weekCount: number;
    leaderboardCount: number;
}> {
    const profile = await loadUserProfile();
    const sessions = await loadWorkoutSessions();
    const weeks = await loadAllWeeklyStats();
    const leaderboard = await loadLeaderboard();

    return {
        profileExists: profile !== null,
        sessionCount: sessions.length,
        weekCount: weeks.length,
        leaderboardCount: leaderboard.length,
    };
}
