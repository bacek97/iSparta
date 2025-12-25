import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES, ExerciseType, messagesExercises } from './types';
import { SimpleWorkoutSession } from './exerciseTrackingService';
import { PointsCalculator, SessionPointsBreakdown, WeeklyStats } from './leaderboard';
import Svg, { Path, G } from 'react-native-svg';
import { GroupManagement } from './components/GroupManagement';
import { useGroupData } from './hooks/useGroupData';
import { PublicationsFeed } from './components/PublicationsFeed';

// TODO: Add tab switcher to toggle between stats and PublicationsFeed
// Example:
// const [activeTab, setActiveTab] = useState<'stats' | 'feed'>('stats');
// Then conditionally render: activeTab === 'feed' ? <PublicationsFeed groupId={userGroup?.id} /> : <StatsView />
import { PublicationsFeed } from './components/PublicationsFeed';

// SVG Icon Components for muscle groups
const ArmsIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 96.9 93.6">
        <G fill="#ff8a00">
            <Path d="M89.3 69.4C64.2 88.8 27.5 80 4.1 63.8c-6-4.1-7.2-8.8-4.8-17L9.7 11C13.2-.3 17-7 26-7h13.6c4 0 7.6 8.2 7.6 14.6q0 2.6-.8 4-.7 1.3-1.9 1.2H42c1.2-3 .5-7.4-.8-10.9a1.6 1.6 0 1 0-3 1.2c1.5 3.6 1.7 7.6.6 9.2q-.3.6-1 .5h-3.3c1.1-3 .4-7.4-.9-10.9a1.6 1.6 0 0 0-3 1.1c1.5 3.7 1.7 7.7.7 9.3q-.4.6-1 .5H29c-2.5.2-4.5.2-7-3.2a1.6 1.6 0 0 0-2.5 1.8c2.9 4.1 6 4.6 8.4 4.6h1.7c.2 4.8.3 14.9-.4 20.1A26 26 0 0 0 20 46.4a1.6 1.6 0 0 0 2.8 1.4c3-6.2 9.3-11 16.4-12.4 5.4-1 13.6-.7 22.4 7q3.7 3.6 5 7.8a1.6 1.6 0 1 0 3-.8c-1-3.5-3-6.4-4.7-8.2 4-3.5 14.7-11.6 24.4-3.7a1.6 1.6 0 0 0 2-2.5c-9.6-7.7-21.2-2.8-28.7 4-7.3-5.9-15.8-8.3-24-6.6q-3.1.5-6 2c.4-5.7.3-14 .2-18.3h11.7q3 0 4.6-2.8 1.2-2.2 1.2-5.7C50.3.4 46.2-10 39.6-10H26C14-10 9.8-.1 6.7 10L-3.7 46c-2.8 9.6-1 15.5 6 20.5a95 95 0 0 0 52.4 17.2c13 0 25.8-3.4 36.6-11.8a1.6 1.6 0 1 0-2-2.4" />
        </G>
    </Svg>
);

const LegsIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 72 96.9">
        <G fill="#16b139">
            <Path d="M29.2 86.9h-30q-3.5-.2-4.1-3.2c-.4-2 .8-4 3-4.8l15-6.5c2.7-1.3 4.2-2.9 3.6-6.7l-6.6-38.6q-1.9-8.9 3.4-14.9c8-9.6 19.7-17.7 32-22.1a1.6 1.6 0 1 1 1 3C34.7-2.8 23.5 5 16 14.1c-3 3.4-3.8 7.2-2.8 12.3l6.7 38.7c1 6.2-2.5 8.6-5.5 10L-.8 81.8q-1.2.7-1 1.3t1 .6h30c2.5-.3 3-1.5 3-3.3q0-1.5-.5-3.7c-.7-3.4-1.5-7.6.4-12.3 3.7-9.2 4.2-26.3-.8-33.7a1.6 1.6 0 0 1 1-2.4C43.6 25.7 58.4 19.5 64 5.1a1.6 1.6 0 0 1 2.9 1.1C61 21.7 45.2 28.2 35 31c4.9 9.5 3.5 26.1 0 34.6-1.5 3.9-.8 7.5-.2 10.6q.5 2.4.5 4.3c0 2.6-1 5.8-5.9 6.5z" />
        </G>
    </Svg>
);

const BackIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 94.1 96.9">
        <G fill="#0026cd">
            <Path d="M88.8 15c-3.1-4.5-8.1-10.3-15.7-10.3h-.5c-2.7-2.5-7-4-12-4q-1.5 0-2.8.2a25 25 0 0 0-2.3-10q-.4-.9-1.4-.9H30q-1 0-1.4.8A25 25 0 0 0 26.3 1L23.5.7c-5 0-9.3 1.5-12 4-7.8-.2-13 5.7-16.2 10.2q-.3.4-.3 1v24.8q0 .6.5 1t1.1.5c3.2-.1 6.7-.3 9.4-1.4a43 43 0 0 0 7.7 25.6v19q.1 1.3 1.5 1.5h53.6q1.5-.1 1.6-1.6v-19c4.4-4.6 8-17 7.7-25.5 2.7 1 6.2 1.3 9.4 1.4q.6 0 1.1-.4t.5-1.1V15.8z" />
        </G>
    </Svg>
);

const TorsoIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 66 66">
        <Path d="m58 15.5-3 31.8q0 .6.2 1.2l2.6 8.4v.1a5 5 0 0 1-3.4 6.2A77 77 0 0 1 33 66q-11.7 0-21.4-2.8a5 5 0 0 1-3.4-6.3l2.6-8.4q.2-.6.1-1.2L8 15.5a9 9 0 0 1-5.6-6L0 1.3a1 1 0 1 1 2-.6L4.3 9A7 7 0 0 0 11 14h16a1 1 0 0 1 0 2H10L13 47a5 5 0 0 1-.3 2l-2.6 8.4a3 3 0 0 0 2 3.8A75 75 0 0 0 33 64q11.5 0 20.8-2.7a3 3 0 0 0 2.1-3.7L53.3 49l-.2-1.9L55.9 16H39a1 1 0 0 1 0-2h16a7 7 0 0 0 6.7-5L64 .6a1 1 0 1 1 2 .6l-2.4 8.2a9 9 0 0 1-5.6 6z" fill="#770072" />
    </Svg>
);

const RunningIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" fill="#16B139" />
    </Svg>
);

interface LeaderboardEntry {
    exercise: EXERCISES;
    totalDuration: number;
    totalReps: number;
    isUnlocked: boolean;
}

interface LeaderboardStats {
    totalWorkouts: number;
    totalWorkoutTime: number;
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

        const unlockThreshold = ExerciseType[exercise] === 'reps' ? 5 : 30;
        const currentValue = ExerciseType[exercise] === 'reps' ? entry.totalReps : entry.totalDuration;
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

    private static async loadAllSessions(): Promise < SimpleWorkoutSession[] > {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const sessionKeys = keys.filter(key => key.startsWith('session_'));
        const sessions: SimpleWorkoutSession[] = [];

        for(const key of sessionKeys) {
            const sessionData = await AsyncStorage.getItem(key);
            if (sessionData) sessions.push(JSON.parse(sessionData));
        }
            return sessions;
    } catch(error) {
        console.error('Error loading sessions:', error);
        return [];
    }
}

    static formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    if (userData?.publicKey) {
        const { getUserStats, getLast7DaysSessions } = await import('./statsService');

        const [serverStats, serverSessions] = await Promise.all([
            getUserStats(userData.publicKey),
            getLast7DaysSessions(userData.publicKey)
        ]);

        // Convert server sessions to local format
        const last7DaysSessions: SessionPointsBreakdown[] = serverSessions.map(s => ({
            sessionId: s.signature,
            date: new Date(s.session_date),
            basePoints: s.base_points,
            bonusTechFactor: s.bonus_tech_factor,
            bonusSpeed: s.bonus_speed,
            totalPoints: s.total_points,
            exerciseBreakdown: s.exercise_sets.map(ex => ({
                exercise: ex.exercise_type as EXERCISES,
                calories: 0,
                repsOrDuration: ex.reps || ex.seconds,
                points: ex.points
            }))
        }));

        // Calculate total workout time from exercise sets
        const totalWorkoutTime = serverSessions.reduce((total, session) =>
            total + session.exercise_sets.reduce((sum, ex) => sum + (ex.seconds || 0), 0)
            , 0);

        setStats({
            totalWorkouts: serverStats.workout_count,
            totalWorkoutTime,
            totalPoints: serverStats.total_points,
            exerciseLeaderboard: [], // Can be fetched separately if needed
            last7DaysSessions,
            olderWeeks: [] // Can be fetched separately if needed
        });
    } else {
        // Fallback to local calculation if no user data
        setStats(await LeaderboardCalculator.calculateStats());
    }
} catch (err) {
    console.error('Error loading stats:', err);
    // Fallback to local on error
    try {
        setStats(await LeaderboardCalculator.calculateStats());
    } catch (e) {
        console.error('Error with fallback:', e);
    }
} finally {
    setLoading(false);
}
        }) ();
    }, [userData?.publicKey]);

const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
        const newSet = new Set(prev);
        if (newSet.has(sessionId)) {
            newSet.delete(sessionId);
        } else {
            newSet.add(sessionId);
        }
        return newSet;
    });
};

const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => {
        const newSet = new Set(prev);
        if (newSet.has(weekKey)) {
            newSet.delete(weekKey);
        } else {
            newSet.add(weekKey);
        }
        return newSet;
    });
};

if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#007AFF" /></View>;
if (!stats) return <View style={styles.container}><Text style={styles.errorText}>Не удалось загрузить статистику</Text></View>;

return (
    <ScrollView style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Таблица лидеров</Text>
        </View>

        {/* Group Management Section */}
        <GroupManagement
            userGroup={userGroup}
            groupMembers={groupMembers}
            isAdmin={isAdmin}
            userData={userData}
            onGroupChange={loadGroupData}
        />

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
            <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Всего баллов:</Text>
                <Text style={styles.statsValue}>{stats.totalPoints.toFixed(1)}</Text>
            </View>
        </View>

        {/* Last 7 Days */}
        {stats.last7DaysSessions.length > 0 && (
            <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Последние 7 дней</Text>
                {stats.last7DaysSessions.map((session) => {
                    const isExpanded = expandedSessions.has(session.sessionId);
                    return (
                        <TouchableOpacity
                            key={session.sessionId}
                            style={styles.sessionCard}
                            onPress={() => toggleSession(session.sessionId)}
                        >
                            <View style={styles.sessionHeader}>
                                <Text style={styles.sessionDate}>
                                    {session.date.toLocaleDateString('ru', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </Text>
                                <Text style={styles.sessionPoints}>{session.totalPoints.toFixed(1)} баллов</Text>
                            </View>

                            {isExpanded && (
                                <View style={styles.sessionDetails}>
                                    <Text style={styles.detailText}>Базовые: {session.basePoints.toFixed(1)}</Text>
                                    {session.bonusTechFactor > 0 && (
                                        <Text style={styles.detailText}>+ Техника: {session.bonusTechFactor}</Text>
                                    )}
                                    {session.bonusSpeed > 0 && (
                                        <Text style={styles.detailText}>+ Скорость: {session.bonusSpeed}</Text>
                                    )}
                                    <View style={styles.exerciseList}>
                                        {session.exerciseBreakdown.map((ex, idx) => (
                                            <Text key={idx} style={styles.exerciseText}>
                                                • {messagesExercises.en[ex.exercise]}: {ex.points.toFixed(2)} баллов
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        )}

        {/* Older Weeks */}
        {stats.olderWeeks.length > 0 && (
            <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Предыдущие недели</Text>
                {stats.olderWeeks.map((week) => {
                    const weekKey = `${week.year}-W${week.weekNumber}`;
                    const isExpanded = expandedWeeks.has(weekKey);

                    return (
                        <TouchableOpacity
                            key={weekKey}
                            style={styles.weekCard}
                            onPress={() => toggleWeek(weekKey)}
                        >
                            <View style={styles.weekHeader}>
                                <Text style={styles.weekLabel}>{week.weekLabel} ({week.year})</Text>
                                <Text style={styles.weekPoints}>{week.totalPoints.toFixed(1)} баллов</Text>
                            </View>
                            <Text style={styles.weekSubtext}>
                                {week.sessionCount} тренировок
                            </Text>

                            {isExpanded && (
                                <View style={styles.weekDetails}>
                                    {week.sessions.map((session) => (
                                        <View key={session.sessionId} style={styles.weekSessionItem}>
                                            <Text style={styles.weekSessionDate}>
                                                {session.date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                                            </Text>
                                            <Text style={styles.weekSessionPoints}>{session.totalPoints.toFixed(1)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        )}

        {/* Exercise Leaderboard */}
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

    sessionCard: { backgroundColor: '#f9f9f9', padding: 12, marginVertical: 6, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
    sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionDate: { fontSize: 16, fontWeight: '600', color: '#333' },
    sessionPoints: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
    sessionDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd' },
    detailText: { fontSize: 14, color: '#666', marginVertical: 2 },
    exerciseList: { marginTop: 8 },
    exerciseText: { fontSize: 12, color: '#888', marginVertical: 1 },

    weekCard: { backgroundColor: '#f0f0f0', padding: 12, marginVertical: 6, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
    weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weekLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
    weekPoints: { fontSize: 16, fontWeight: 'bold', color: '#FF9800' },
    weekSubtext: { fontSize: 12, color: '#666', marginTop: 4 },
    weekDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd' },
    weekSessionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    weekSessionDate: { fontSize: 13, color: '#555' },
    weekSessionPoints: { fontSize: 13, fontWeight: '600', color: '#FF9800' },

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
