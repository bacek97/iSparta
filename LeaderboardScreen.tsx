import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { GroupManagement } from './components/GroupManagement';
import { useGroupData } from './hooks/useGroupData';
import { PublicationsFeed } from './components/PublicationsFeed';
import { TabSwitcher } from './components/TabSwitcher';
import { StatsCard } from './components/StatsCard';
import { SessionsList } from './components/SessionsList';
import { WeeksList } from './components/WeeksList';
import { ExercisesList } from './components/ExercisesList';
import { LeaderboardCalculator, LeaderboardStats } from './utils/LeaderboardCalculator';
import { SessionPointsBreakdown } from './leaderboard';

export const LeaderboardScreen: React.FC = () => {
    const [stats, setStats] = useState<LeaderboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'stats' | 'feed'>('stats');

    // Use group data hook
    const { userGroup, groupMembers, isAdmin, userData, loading: groupLoading, error: groupError, loadGroupData } = useGroupData();

    useEffect(() => {
        (async () => {
            try {
                if (userData?.publicKey) {
                    // Load stats from server
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
                        bonusForStarters: 0,
                        bonusAnotherMuscleYesterday: 0,
                        bonusWeeksInStreak: 0,
                        totalPoints: s.total_points,
                        exerciseBreakdown: s.exercise_sets.map(ex => ({
                            exercise: ex.exercise_type as any,
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
                        exerciseLeaderboard: [],
                        last7DaysSessions,
                        olderWeeks: []
                    });
                } else {
                    // Fallback to local calculation
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
        })();
    }, [userData?.publicKey]);

    if (loading || groupLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (!stats) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Не удалось загрузить статистику</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} nestedScrollEnabled={true}>
            <View style={styles.header}>
                <Text style={styles.title}>Таблица лидеров</Text>
            </View>

            <GroupManagement
                userGroup={userGroup}
                groupMembers={groupMembers}
                isAdmin={isAdmin}
                userData={userData}
                onGroupChange={loadGroupData}
            />

            <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'feed' ? (
                userGroup?.group_id ? (
                    <PublicationsFeed groupId={userGroup.group_id} />
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.errorText}>
                            Присоединитесь к группе, чтобы видеть публикации
                        </Text>
                    </View>
                )
            ) : (
                <>
                    <StatsCard
                        totalWorkouts={stats.totalWorkouts}
                        totalWorkoutTime={stats.totalWorkoutTime}
                        totalPoints={stats.totalPoints}
                    />

                    <SessionsList sessions={stats.last7DaysSessions} />

                    <WeeksList weeks={stats.olderWeeks} />

                    <ExercisesList exercises={stats.exerciseLeaderboard} />
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#007AFF',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    emptyCard: {
        backgroundColor: '#fff',
        margin: 10,
        padding: 20,
        borderRadius: 10,
        elevation: 3,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
});

export default LeaderboardScreen;
