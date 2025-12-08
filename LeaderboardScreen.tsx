import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES, ExerciseType, messagesExercises, EXERCISE_MUSCLE_GROUP_POINTS } from './types';
import { SimpleWorkoutSession } from './exerciseTrackingService';

interface LeaderboardEntry {
    exercise: EXERCISES;
    totalDuration: number;
    totalReps: number;
    isUnlocked: boolean;
}

interface LeaderboardStats {
    totalWorkouts: number;
    totalWorkoutTime: number; // total seconds across all exercises
    exerciseLeaderboard: LeaderboardEntry[];
}

class LeaderboardCalculator {
    static async calculateStats(): Promise<LeaderboardStats> {
        const sessions = await this.loadAllSessions();
        const exerciseMap = new Map<EXERCISES, LeaderboardEntry>();
        let totalWorkoutTime = 0;

        // Инициализация (исключая UNKNOWN)
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

        // Подсчёт
        sessions.forEach(session => {
            Object.entries(session.exercises).forEach(([exerciseName, record]) => {
                const exercise = exerciseName as EXERCISES;

                // Пропускаем UNKNOWN
                if (exercise === EXERCISES.UNKNOWN) return;

                const entry = exerciseMap.get(exercise);
                if (!entry) return;

                entry.totalDuration += record.duration;
                totalWorkoutTime += record.duration;
                if (record.reps) entry.totalReps += record.reps;

                const unlockCondition = EXERCISE_MUSCLE_GROUP_POINTS[exercise].conditionToUnlock;
                const currentValue = unlockCondition.type === 'reps' ? entry.totalReps : entry.totalDuration;
                entry.isUnlocked = currentValue >= unlockCondition.value;
            });
        });

        // Фильтруем упражнения с нулевой активностью и сортируем
        const exerciseLeaderboard = Array.from(exerciseMap.values())
            .filter(entry => entry.totalDuration > 0 || entry.totalReps > 0)
            .sort((a, b) => a.isUnlocked === b.isUnlocked ? b.totalDuration - a.totalDuration : (a.isUnlocked ? -1 : 1));

        return { totalWorkouts: sessions.length, totalWorkoutTime, exerciseLeaderboard };
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
        return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
}

export const LeaderboardScreen: React.FC = () => {
    const [stats, setStats] = useState<LeaderboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setStats(await LeaderboardCalculator.calculateStats());
            setLoading(false);
        })();
    }, []);

    if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#007AFF" /></View>;
    if (!stats) return <View style={styles.container}><Text style={styles.errorText}>Не удалось загрузить статистику</Text></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Таблица лидеров</Text>
            </View>

            <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Общая статистика</Text>
                <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Всего тренировок:</Text>
                    <Text style={styles.statsValue}>{stats.totalWorkouts}</Text>
                </View>
                <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Общее время:</Text>
                    <Text style={styles.statsValue}>{LeaderboardCalculator.formatDuration(stats.totalWorkoutTime)}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Упражнения</Text>
                {stats.exerciseLeaderboard.map((entry, index) => {
                    const isRepBased = ExerciseType[entry.exercise] === 'reps';

                    return (
                        <View key={entry.exercise} style={[styles.exerciseCard, !entry.isUnlocked && styles.exerciseCardLocked]}>
                            <View style={styles.exerciseHeader}>
                                <Text style={styles.exerciseRank}>#{index + 1}</Text>
                                <Text style={styles.exerciseName}>{messagesExercises.en[entry.exercise]}</Text>
                                {entry.isUnlocked && <Text style={styles.unlockedBadge}>✓</Text>}
                            </View>

                            <View style={styles.exerciseStats}>
                                <Text style={styles.exerciseStatValue}>
                                    {LeaderboardCalculator.formatDuration(entry.totalDuration)}
                                </Text>
                                {isRepBased && <Text style={styles.exerciseStatValue}>{entry.totalReps} reps</Text>}
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { padding: 20, backgroundColor: '#007AFF' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    statsCard: { backgroundColor: '#fff', margin: 10, padding: 15, borderRadius: 10, elevation: 3 },
    cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
    statsLabel: { fontSize: 16, color: '#666', fontWeight: '500' },
    statsValue: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
    exerciseCard: { backgroundColor: '#f9f9f9', padding: 12, marginVertical: 6, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#007AFF' },
    exerciseCardLocked: { borderLeftColor: '#ccc', opacity: 0.7 },
    exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    exerciseRank: { fontSize: 18, fontWeight: 'bold', color: '#007AFF', marginRight: 10, minWidth: 40 },
    exerciseName: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
    unlockedBadge: { fontSize: 20, color: '#4CAF50' },
    exerciseStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
    exerciseStatValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    errorText: { fontSize: 16, color: '#999', textAlign: 'center' },
});

export default LeaderboardScreen;
