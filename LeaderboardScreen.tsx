import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { GroupManagement } from './components/GroupManagement';
import { useGroupData } from './hooks/useGroupData';
import { PublicationsFeed } from './components/PublicationsFeed';
import { StatsCard } from './components/StatsCard';
import { SessionsList } from './components/SessionsList';
import { WeeksList } from './components/WeeksList';
import { ExercisesList } from './components/ExercisesList';
import { LeaderboardCalculator, LeaderboardStats } from './utils/LeaderboardCalculator';
import { SessionPointsBreakdown } from './leaderboard';
import { getGlobalLeaderboard, GlobalLeaderboardEntry } from './statsService';
import { getCurrentUser } from './authService';
import { searchUsers, SearchResult } from './userSearchService';
import { UserProfileModal } from './components/UserProfileModal';

type TabType = 'global' | 'groups' | 'stats' | 'feed';

export const LeaderboardScreen: React.FC = () => {
    const [stats, setStats] = useState<LeaderboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('global');
    const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
    const [globalLoading, setGlobalLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserKey, setCurrentUserKey] = useState<string>('');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Profile modal state
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [profileModalVisible, setProfileModalVisible] = useState(false);

    const { userGroup, groupMembers, isAdmin, userData, loading: groupLoading, error: groupError, loadGroupData } = useGroupData();

    // Load current user key
    useEffect(() => {
        (async () => {
            const user = await getCurrentUser();
            if (user?.publicKey) {
                setCurrentUserKey(user.publicKey);
            }
        })();
    }, []);

    // Load global leaderboard
    const loadGlobalLeaderboard = async () => {
        try {
            setGlobalLoading(true);
            const data = await getGlobalLeaderboard(100, 0);
            setGlobalLeaderboard(data);
        } catch (err) {
            console.error('Error loading global leaderboard:', err);
        } finally {
            setGlobalLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadGlobalLeaderboard();
    }, []);

    // Search handler with debounce
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        if (query.trim().length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchUsers(query, 20);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Handle user selection
    const handleUserSelect = (user: any) => {
        setSelectedUser({
            ed25519_public_key: user.ed25519_public_key || user.user_public_key,
            nickname: user.nickname,
            fms_category: user.fms_category,
            total_points: user.total_points,
            workout_count: user.workout_count,
        });
        setProfileModalVisible(true);
    };

    useEffect(() => {
        (async () => {
            try {
                if (userData?.publicKey) {
                    const { getUserStats, getLast7DaysSessions } = await import('./statsService');

                    const [serverStats, serverSessions] = await Promise.all([
                        getUserStats(userData.publicKey),
                        getLast7DaysSessions(userData.publicKey)
                    ]);

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
                    setStats(await LeaderboardCalculator.calculateStats());
                }
            } catch (err) {
                console.error('Error loading stats:', err);
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

    const handleRefresh = () => {
        setRefreshing(true);
        loadGlobalLeaderboard();
    };

    const renderLeaderboardItem = ({ item }: { item: GlobalLeaderboardEntry }) => {
        const isCurrentUser = item.user_public_key === currentUserKey;

        return (
            <TouchableOpacity
                style={[styles.leaderboardItem, isCurrentUser && styles.currentUserItem]}
                onPress={() => handleUserSelect(item)}
                activeOpacity={0.7}
            >
                <View style={styles.rankContainer}>
                    <Text style={[styles.rank, getRankStyle(item.rank)]}>
                        {item.rank}
                    </Text>
                </View>

                <View style={styles.userInfo}>
                    <Text style={[styles.nickname, isCurrentUser && styles.currentUserText]}>
                        {item.nickname || 'Без никнейма'}
                        {isCurrentUser && ' (Вы)'}
                    </Text>
                    <Text style={styles.publicKeyText} numberOfLines={1}>
                        {item.user_public_key.slice(0, 16)}...
                    </Text>
                    <Text style={styles.workoutCount}>
                        {item.workout_count} {getWorkoutWord(item.workout_count)}
                    </Text>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.points}>
                        {item.total_points.toLocaleString()}
                    </Text>
                    <Text style={styles.pointsLabel}>очков</Text>
                </View>

                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
        );
    };

    const renderSearchResult = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={styles.searchResultItem}
            onPress={() => handleUserSelect(item)}
            activeOpacity={0.7}
        >
            <View style={styles.searchResultAvatar}>
                <Text style={styles.avatarText}>
                    {(item.nickname?.[0] || item.ed25519_public_key[8] || '?').toUpperCase()}
                </Text>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.nickname}>
                    {item.nickname || 'Без никнейма'}
                </Text>
                <Text style={styles.publicKeyText} numberOfLines={1}>
                    {item.ed25519_public_key.slice(0, 20)}...
                </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );

    const renderTab = (tab: TabType, label: string, icon: string) => (
        <TouchableOpacity
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
        >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    if (loading && groupLoading && globalLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🏆 Таблица лидеров</Text>
                <TouchableOpacity
                    style={styles.searchToggle}
                    onPress={() => setShowSearch(!showSearch)}
                >
                    <Text style={styles.searchIcon}>🔍</Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            {showSearch && (
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Поиск по никнейму или ключу..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {isSearching && (
                        <ActivityIndicator size="small" color="#4CAF50" style={styles.searchLoader} />
                    )}
                </View>
            )}

            {/* Search Results */}
            {showSearch && searchQuery.length >= 2 && (
                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.ed25519_public_key}
                    renderItem={renderSearchResult}
                    style={styles.searchResults}
                    ListEmptyComponent={
                        !isSearching ? (
                            <Text style={styles.emptyText}>Ничего не найдено</Text>
                        ) : null
                    }
                />
            )}

            {/* Main Content (hidden during search) */}
            {!(showSearch && searchQuery.length >= 2) && (
                <>
                    {/* Tab Navigation */}
                    <View style={styles.tabContainer}>
                        {renderTab('global', 'Все', '🌍')}
                        {renderTab('groups', 'Группы', '👥')}
                        {renderTab('stats', 'Статистика', '📊')}
                        {renderTab('feed', 'Лента', '📰')}
                    </View>

                    {/* Tab Content */}
                    {activeTab === 'global' && (
                        <FlatList
                            data={globalLeaderboard}
                            keyExtractor={(item) => item.user_public_key}
                            renderItem={renderLeaderboardItem}
                            contentContainerStyle={styles.leaderboardList}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    tintColor="#4CAF50"
                                />
                            }
                            ListHeaderComponent={
                                <View style={styles.leaderboardHeader}>
                                    <Text style={styles.leaderboardTitle}>
                                        Глобальный рейтинг
                                    </Text>
                                    <Text style={styles.leaderboardSubtitle}>
                                        {globalLeaderboard.length} участников • нажмите для профиля
                                    </Text>
                                </View>
                            }
                            ListEmptyComponent={
                                globalLoading ? (
                                    <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
                                ) : (
                                    <Text style={styles.emptyText}>Нет участников</Text>
                                )
                            }
                        />
                    )}

                    {activeTab === 'groups' && (
                        <ScrollView style={styles.scrollContent}>
                            <GroupManagement
                                userGroup={userGroup}
                                groupMembers={groupMembers}
                                isAdmin={isAdmin}
                                userData={userData}
                                onGroupChange={loadGroupData}
                            />
                        </ScrollView>
                    )}

                    {activeTab === 'stats' && stats && (
                        <ScrollView style={styles.scrollContent}>
                            <StatsCard
                                totalWorkouts={stats.totalWorkouts}
                                totalWorkoutTime={stats.totalWorkoutTime}
                                totalPoints={stats.totalPoints}
                            />
                            <SessionsList sessions={stats.last7DaysSessions} />
                            <WeeksList weeks={stats.olderWeeks} />
                            <ExercisesList exercises={stats.exerciseLeaderboard} />
                        </ScrollView>
                    )}

                    {activeTab === 'feed' && (
                        <View style={styles.scrollContent}>
                            {(currentUserKey || userData?.publicKey) ? (
                                <PublicationsFeed currentUserKey={currentUserKey || userData?.publicKey || ''} />
                            ) : (
                                <View style={styles.emptyCard}>
                                    <Text style={styles.emptyText}>
                                        Войдите, чтобы видеть публикации
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </>
            )}

            {/* User Profile Modal */}
            <UserProfileModal
                visible={profileModalVisible}
                onClose={() => setProfileModalVisible(false)}
                user={selectedUser}
                currentUserKey={currentUserKey}
            />
        </View>
    );
};

function getRankStyle(rank: number) {
    switch (rank) {
        case 1: return { color: '#FFD700' };
        case 2: return { color: '#C0C0C0' };
        case 3: return { color: '#CD7F32' };
        default: return { color: '#fff' };
    }
}

function getWorkoutWord(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'тренировок';
    if (lastDigit === 1) return 'тренировка';
    if (lastDigit >= 2 && lastDigit <= 4) return 'тренировки';
    return 'тренировок';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#2a2a2a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    searchToggle: {
        padding: 8,
    },
    searchIcon: {
        fontSize: 22,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 16,
    },
    searchLoader: {
        position: 'absolute',
        right: 28,
    },
    searchResults: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 12,
        padding: 12,
    },
    searchResultAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#2a2a2a',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        marginHorizontal: 4,
    },
    activeTab: {
        backgroundColor: '#4CAF50',
    },
    tabIcon: {
        fontSize: 18,
        marginBottom: 4,
    },
    tabText: {
        color: '#888',
        fontSize: 11,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '600',
    },
    scrollContent: {
        flex: 1,
    },
    leaderboardList: {
        padding: 12,
    },
    leaderboardHeader: {
        marginBottom: 12,
    },
    leaderboardTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    leaderboardSubtitle: {
        color: '#888',
        fontSize: 13,
        marginTop: 4,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    currentUserItem: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    rankContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rank: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    nickname: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    currentUserText: {
        color: '#4CAF50',
    },
    publicKeyText: {
        color: '#666',
        fontSize: 10,
        marginTop: 2,
    },
    workoutCount: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    statsContainer: {
        alignItems: 'flex-end',
        marginRight: 8,
    },
    points: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
    },
    pointsLabel: {
        color: '#888',
        fontSize: 11,
    },
    chevron: {
        color: '#666',
        fontSize: 24,
    },
    emptyCard: {
        margin: 16,
        padding: 40,
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
});

export default LeaderboardScreen;
