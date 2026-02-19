/**
 * GlobalLeaderboardComponent
 * Component for displaying global leaderboard across all users
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { getGlobalLeaderboard, GlobalLeaderboardEntry } from '../statsService';
import { FollowButton } from './FollowButton';

interface GlobalLeaderboardComponentProps {
    currentUserKey: string;
    onUserSelect?: (user: GlobalLeaderboardEntry) => void;
}

export const GlobalLeaderboardComponent: React.FC<GlobalLeaderboardComponentProps> = ({
    currentUserKey,
    onUserSelect
}) => {
    const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadLeaderboard = useCallback(async () => {
        try {
            const data = await getGlobalLeaderboard(100, 0);
            setLeaderboard(data);
        } catch (error) {
            console.error('[GlobalLeaderboard] Load error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadLeaderboard();
    }, [loadLeaderboard]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadLeaderboard();
    };

    const renderLeaderboardItem = ({ item }: { item: GlobalLeaderboardEntry }) => {
        const isCurrentUser = item.user_public_key === currentUserKey;

        return (
            <TouchableOpacity
                style={[styles.userItem, isCurrentUser && styles.currentUserItem]}
                onPress={() => onUserSelect?.(item)}
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
                    <Text style={styles.publicKey} numberOfLines={1}>
                        {item.user_public_key.slice(0, 20)}...
                    </Text>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.points}>
                        {item.total_points.toLocaleString()}
                    </Text>
                    <Text style={styles.pointsLabel}>очков</Text>
                </View>

                {!isCurrentUser && (
                    <FollowButton
                        currentUserKey={currentUserKey}
                        targetUserKey={item.user_public_key}
                    />
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Загрузка рейтинга...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🏆 Глобальный рейтинг</Text>
                <Text style={styles.subtitle}>
                    {leaderboard.length} участников
                </Text>
            </View>

            <FlatList
                data={leaderboard}
                keyExtractor={(item) => item.user_public_key}
                renderItem={renderLeaderboardItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#4CAF50"
                    />
                }
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            Нет участников в рейтинге
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

function getRankStyle(rank: number) {
    switch (rank) {
        case 1:
            return { color: '#FFD700' }; // Gold
        case 2:
            return { color: '#C0C0C0' }; // Silver
        case 3:
            return { color: '#CD7F32' }; // Bronze
        default:
            return { color: '#fff' };
    }
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
    loadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#888',
        fontSize: 14,
        marginTop: 4,
    },
    listContent: {
        padding: 16,
    },
    userItem: {
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
        marginBottom: 2,
    },
    currentUserText: {
        color: '#4CAF50',
    },
    publicKey: {
        color: '#888',
        fontSize: 11,
    },
    statsContainer: {
        alignItems: 'flex-end',
        marginRight: 12,
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
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
    },
});

export default GlobalLeaderboardComponent;
