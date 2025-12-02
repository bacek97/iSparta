import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { loadUserProfile, loadAllWeeklyStats } from './storageService';
import { getVirtualDate, getWeekStart } from './testingUtils';
import { UserProfile, WeeklyStats, LeaderboardEntry } from './types';

interface LeaderboardScreenProps {
    onNavigateToProfile?: () => void;
}

function LeaderboardScreen({ onNavigateToProfile }: LeaderboardScreenProps) {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'week' | 'month' | 'all'>('week');

    const loadLeaderboardData = async () => {
        try {
            setLoading(true);

            // Load current user profile
            const profile = await loadUserProfile();
            setCurrentUser(profile);

            // Load all weekly stats
            const allStats = await loadAllWeeklyStats();

            // For now, create a simple leaderboard from weekly stats
            // In a real app, this would aggregate multiple users
            const virtualDate = await getVirtualDate();
            const currentWeekStart = getWeekStart(virtualDate);

            let filteredStats: WeeklyStats[] = [];

            if (filter === 'week') {
                // Current week only
                filteredStats = allStats.filter(stat =>
                    stat.weekStartDate.getTime() === currentWeekStart.getTime()
                );
            } else if (filter === 'month') {
                // Last 4 weeks
                const fourWeeksAgo = new Date(currentWeekStart);
                fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
                filteredStats = allStats.filter(stat =>
                    stat.weekStartDate >= fourWeeksAgo
                );
            } else {
                // All time
                filteredStats = allStats;
            }

            // Create leaderboard entries (for single user demo)
            const entries: LeaderboardEntry[] = filteredStats.map((stat, index) => ({
                userId: profile?.id || 'user',
                userName: profile?.name || 'Спартанец',
                nraScore: stat.nraScore,
                streakWeeks: profile?.currentStreakWeeks || 0,
                rank: index + 1,
                weekStartDate: stat.weekStartDate,
            }));

            // Sort by NRA score descending
            entries.sort((a, b) => b.nraScore - a.nraScore);

            // Update ranks
            entries.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            setLeaderboard(entries);

            console.log('[LeaderboardScreen] Loaded leaderboard:', {
                filter,
                entriesCount: entries.length,
                topScore: entries[0]?.nraScore || 0,
            });
        } catch (error) {
            console.error('[LeaderboardScreen] Error loading leaderboard:', error);
            Alert.alert('Error', 'Failed to load leaderboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboardData();
    }, [filter]);

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
        );
    }

    const currentUserEntry = leaderboard.find(entry => entry.userId === currentUser?.id);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🏆 Таблица лидеров</Text>
                <Text style={styles.headerSubtitle}>
                    {filter === 'week' && 'Текущая неделя'}
                    {filter === 'month' && 'Последний месяц'}
                    {filter === 'all' && 'Все время'}
                </Text>
            </View>

            {/* Filter Buttons */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
                    onPress={() => setFilter('week')}
                >
                    <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
                        Неделя
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
                    onPress={() => setFilter('month')}
                >
                    <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
                        Месяц
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                        Все время
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Current User Position */}
            {currentUserEntry && (
                <View style={styles.currentUserCard}>
                    <Text style={styles.currentUserLabel}>Ваша позиция</Text>
                    <View style={styles.currentUserInfo}>
                        <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>#{currentUserEntry.rank}</Text>
                        </View>
                        <View style={styles.currentUserStats}>
                            <Text style={styles.currentUserName}>{currentUserEntry.userName}</Text>
                            <Text style={styles.currentUserScore}>
                                НРА: {currentUserEntry.nraScore} • Стрик: {currentUserEntry.streakWeeks} нед
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Leaderboard List */}
            <ScrollView style={styles.leaderboardList}>
                {leaderboard.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Нет данных для отображения</Text>
                        <Text style={styles.emptySubtext}>
                            Завершите тренировку, чтобы появиться в таблице лидеров
                        </Text>
                    </View>
                ) : (
                    leaderboard.map((entry, index) => {
                        const isCurrentUser = entry.userId === currentUser?.id;
                        const isTopThree = entry.rank <= 3;

                        return (
                            <View
                                key={`${entry.userId}-${entry.weekStartDate.getTime()}`}
                                style={[
                                    styles.leaderboardItem,
                                    isCurrentUser && styles.leaderboardItemCurrent,
                                    isTopThree && styles.leaderboardItemTop,
                                ]}
                            >
                                <View style={styles.rankContainer}>
                                    {entry.rank === 1 && <Text style={styles.medal}>🥇</Text>}
                                    {entry.rank === 2 && <Text style={styles.medal}>🥈</Text>}
                                    {entry.rank === 3 && <Text style={styles.medal}>🥉</Text>}
                                    {entry.rank > 3 && (
                                        <Text style={styles.rankNumber}>#{entry.rank}</Text>
                                    )}
                                </View>

                                <View style={styles.userInfo}>
                                    <Text style={[styles.userName, isCurrentUser && styles.userNameCurrent]}>
                                        {entry.userName}
                                        {isCurrentUser && ' (Вы)'}
                                    </Text>
                                    <Text style={styles.userStats}>
                                        Стрик: {entry.streakWeeks} нед
                                        {filter !== 'week' && ` • ${new Date(entry.weekStartDate).toLocaleDateString('ru', { month: 'short', day: 'numeric' })}`}
                                    </Text>
                                </View>

                                <View style={styles.scoreContainer}>
                                    <Text style={[styles.score, isTopThree && styles.scoreTop]}>
                                        {entry.nraScore}
                                    </Text>
                                    <Text style={styles.scoreLabel}>НРА</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonPrimary]}
                    onPress={onNavigateToProfile}
                >
                    <Text style={styles.navButtonText}>👤 Профиль</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonInfo]}
                    onPress={loadLeaderboardData}
                >
                    <Text style={styles.navButtonText}>🔄 Обновить</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 100,
    },
    header: {
        backgroundColor: '#2a2a2a',
        padding: 20,
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#999',
        fontSize: 14,
        marginTop: 4,
    },
    filterContainer: {
        flexDirection: 'row',
        padding: 10,
        gap: 10,
    },
    filterButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: '#4a9eff',
    },
    filterText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
    },
    filterTextActive: {
        color: 'white',
    },
    currentUserCard: {
        backgroundColor: '#2a2a2a',
        margin: 10,
        padding: 15,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#4a9eff',
    },
    currentUserLabel: {
        color: '#4a9eff',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    currentUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankBadge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4a9eff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    currentUserStats: {
        marginLeft: 15,
        flex: 1,
    },
    currentUserName: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    currentUserScore: {
        color: '#999',
        fontSize: 14,
        marginTop: 4,
    },
    leaderboardList: {
        flex: 1,
        padding: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        color: '#444',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    leaderboardItem: {
        flexDirection: 'row',
        backgroundColor: '#2a2a2a',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        alignItems: 'center',
    },
    leaderboardItemCurrent: {
        borderWidth: 2,
        borderColor: '#4a9eff',
    },
    leaderboardItemTop: {
        backgroundColor: '#2d2d2d',
    },
    rankContainer: {
        width: 50,
        alignItems: 'center',
    },
    medal: {
        fontSize: 32,
    },
    rankNumber: {
        color: '#999',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    userName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    userNameCurrent: {
        color: '#4a9eff',
    },
    userStats: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
    },
    scoreContainer: {
        alignItems: 'center',
    },
    score: {
        color: '#4a9eff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    scoreTop: {
        color: '#ffd700',
    },
    scoreLabel: {
        color: '#666',
        fontSize: 10,
    },
    navigationButtons: {
        flexDirection: 'row',
        padding: 10,
        gap: 10,
    },
    navButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    navButtonPrimary: {
        backgroundColor: '#4a9eff',
    },
    navButtonInfo: {
        backgroundColor: '#17a2b8',
    },
    navButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default LeaderboardScreen;
