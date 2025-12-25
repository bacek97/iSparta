import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES, ExerciseType } from '../types';
import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { PointsCalculator, SessionPointsBreakdown, WeeklyStats } from '../leaderboard';

export interface LeaderboardEntry {
    exercise: EXERCISES;
    totalDuration: number;
    totalReps: number;
    isUnlocked: boolean;
}

export interface LeaderboardStats {
    totalWorkouts: number;
    totalWorkoutTime: number;
    totalPoints: number;
    exerciseLeaderboard: LeaderboardEntry[];
    last7DaysSessions: SessionPointsBreakdown[];
    olderWeeks: WeeklyStats[];
}

export class LeaderboardCalculator {
    static async calculateStats(): Promise<LeaderboardStats> {
        const sessions = await this.loadAllSessions();
        const exerciseMap = new Map<EXERCISES, LeaderboardEntry>();
        let totalWorkoutTime = 0;
        let totalPoints = 0;

        const allSessionPoints = sessions.map(session =>
            PointsCalculator.calculateSessionPoints(session, sessions)
        );

        totalPoints = allSessionPoints.reduce((sum, sp) => sum + sp.totalPoints, 0);

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const last7DaysSessions = allSessionPoints
            .filter(sp => sp.date >= sevenDaysAgo)
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        const olderSessions = sessions.filter(s => new Date(s.startTime) < sevenDaysAgo);
        const weeklyStats = PointsCalculator.calculateWeeklyPoints(olderSessions);
        const olderWeeks = Array.from(weeklyStats.values())
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.weekNumber - a.weekNumber;
            });

        Object.values(EXERCISES).forEach(exercise => {
            if (exercise !== EXERCISES.UNKNOWN) {
                exerciseMap.set(exercise, {
                    exercise,
                    totalDuration: 0,
                    totalReps: 0,
                    isUnlocked: false,
                });
            }
        });

        sessions.forEach(session => {
            Object.entries(session.exercises).forEach(([exerciseName, record]) => {
                const exercise = exerciseName as EXERCISES;
                if (exercise === EXERCISES.UNKNOWN) return;

                const entry = exerciseMap.get(exercise);
                if (!entry) return;

                entry.totalDuration += record.duration;
                totalWorkoutTime += record.duration;
                if (record.reps) entry.totalReps += record.reps;

                const unlockThreshold = (exercise in ExerciseType && (ExerciseType as any)[exercise] === 'reps') ? 5 : 30;
                const currentValue = (exercise in ExerciseType && (ExerciseType as any)[exercise] === 'reps') ? entry.totalReps : entry.totalDuration;
                entry.isUnlocked = currentValue >= unlockThreshold;
            });
        });

        const exerciseLeaderboard = Array.from(exerciseMap.values())
            .filter(entry => entry.totalDuration > 0 || entry.totalReps > 0)
            .sort((a, b) => a.isUnlocked === b.isUnlocked ? b.totalDuration - a.totalDuration : (a.isUnlocked ? -1 : 1));

        return {
            totalWorkouts: sessions.length,
            totalWorkoutTime,
            totalPoints,
            exerciseLeaderboard,
            last7DaysSessions,
            olderWeeks
        };
    }

    private static async loadAllSessions(): Promise<SimpleWorkoutSession[]> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const sessionKeys = keys.filter(key => key.startsWith('session_'));
            const sessions: SimpleWorkoutSession[] = [];

            for (const key of sessionKeys) {
                const sessionData = await AsyncStorage.getItem(key);
                if (sessionData) sessions.push(JSON.parse(sessionData));
            }
            return sessions;
        } catch (error) {
            console.error('Error loading sessions:', error);
            return [];
        }
    }

    static formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) return `${h}ч ${m}м`;
        if (m > 0) return `${m}м ${s}с`;
        return `${s}с`;
    }
}
