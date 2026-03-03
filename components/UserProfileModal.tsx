/**
 * UserProfileModal Component
 * Shows user profile with follow, teacher options, and publications
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ScrollView,
    FlatList,
} from 'react-native';
import {
    isFollowing,
    followUser,
    unfollowUser,
    isMyTeacher,
    setMyTeacher,
    removeMyTeacher,
    getMyTeacher,
    getFollowersCount,
    getFollowingCount,
    getStudentsCount,
} from '../userRelationsService';
import { getUserStats, getUserAllSessions, ServerWorkoutSession } from '../statsService';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

interface Publication {
    publication_id: string;
    message: string;
    created_at: string;
    workout_session?: {
        total_points: number;
        exercise_sets: Array<{
            exercise_type: string;
            reps: number;
            seconds: number;
        }>;
    };
}

interface UserProfileModalProps {
    visible: boolean;
    onClose: () => void;
    user: {
        ed25519_public_key: string;
        nickname: string | null;
        fms_category?: string;
        total_points?: number;
        workout_count?: number;
    } | null;
    currentUserKey: string;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    visible,
    onClose,
    user,
    currentUserKey,
}) => {
    const [following, setFollowing] = useState(false);
    const [isTeacher, setIsTeacher] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [stats, setStats] = useState({ followers: 0, following: 0, students: 0, points: 0, workouts: 0 });
    const [publications, setPublications] = useState<Publication[]>([]);
    const [publicationsLoading, setPublicationsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'publications'>('stats');
    const [userTeacher, setUserTeacher] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ServerWorkoutSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    const isOwnProfile = user?.ed25519_public_key === currentUserKey;

    useEffect(() => {
        if (visible && user) {
            loadUserData();
            loadPublications();
            loadSessions();
        }
    }, [visible, user]);

    const loadUserData = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const [
                followingStatus,
                teacherStatus,
                followersCount,
                followingCount,
                studentsCount,
                userStats,
                teacherOfUser,
            ] = await Promise.all([
                isOwnProfile ? Promise.resolve(false) : isFollowing(currentUserKey, user.ed25519_public_key),
                isOwnProfile ? Promise.resolve(false) : isMyTeacher(currentUserKey, user.ed25519_public_key),
                getFollowersCount(user.ed25519_public_key),
                getFollowingCount(user.ed25519_public_key),
                getStudentsCount(user.ed25519_public_key),
                getUserStats(user.ed25519_public_key).catch(() => ({ total_points: 0, workout_count: 0 })),
                getMyTeacher(user.ed25519_public_key),
            ]);

            setFollowing(followingStatus);
            setIsTeacher(teacherStatus);
            setUserTeacher(teacherOfUser);
            setStats({
                followers: followersCount,
                following: followingCount,
                students: studentsCount,
                points: userStats.total_points || user.total_points || 0,
                workouts: userStats.workout_count || user.workout_count || 0,
            });
        } catch (error) {
            console.error('[UserProfileModal] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPublications = async () => {
        if (!user) return;

        setPublicationsLoading(true);
        try {
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `
                        query GetUserPublications($userKey: String!) {
                            workout_publications(
                                where: { user_public_key: { _eq: $userKey } },
                                order_by: { created_at: desc },
                                limit: 20
                            ) {
                                publication_id
                                message
                                created_at
                                workout_session {
                                    total_points
                                    exercise_sets {
                                        exercise_type
                                        reps
                                        seconds
                                    }
                                }
                            }
                        }
                    `,
                    variables: { userKey: user.ed25519_public_key }
                })
            });

            const data = await response.json();
            if (data.data?.workout_publications) {
                setPublications(data.data.workout_publications);
            }
        } catch (error) {
            console.error('[UserProfileModal] Load publications error:', error);
        } finally {
            setPublicationsLoading(false);
        }
    };

    const loadSessions = async () => {
        if (!user) return;

        setSessionsLoading(true);
        try {
            const userSessions = await getUserAllSessions(user.ed25519_public_key);
            setSessions(userSessions);
        } catch (error) {
            console.error('[UserProfileModal] Load sessions error:', error);
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!user || actionLoading) return;

        setActionLoading(true);
        try {
            if (following) {
                await unfollowUser(currentUserKey, user.ed25519_public_key);
                setFollowing(false);
                setStats(s => ({ ...s, followers: s.followers - 1 }));
            } else {
                await followUser(currentUserKey, user.ed25519_public_key);
                setFollowing(true);
                setStats(s => ({ ...s, followers: s.followers + 1 }));
            }
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось выполнить действие');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTeacher = async () => {
        if (!user || actionLoading) return;

        setActionLoading(true);
        try {
            if (isTeacher) {
                // Remove this user as my teacher
                await removeMyTeacher(currentUserKey, user.ed25519_public_key);
                setIsTeacher(false);
                setStats(s => ({ ...s, students: s.students - 1 }));
                Alert.alert('Готово', 'Учитель удалён');
            } else {
                // Set this user as my teacher
                await setMyTeacher(currentUserKey, user.ed25519_public_key);
                setIsTeacher(true);
                setStats(s => ({ ...s, students: s.students + 1 }));
                Alert.alert('Готово', 'Этот пользователь теперь ваш учитель');
            }
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось выполнить действие');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getExerciseSummary = (exercises: Array<{ exercise_type: string; reps: number; seconds: number }>) => {
        return exercises.map(ex => {
            const value = ex.reps || Math.round(ex.seconds / 60);
            const unit = ex.reps ? '' : ' мин';
            return `${ex.exercise_type}: ${value}${unit}`;
        }).join(', ');
    };

    const renderPublication = ({ item }: { item: Publication }) => (
        <View style={styles.publicationCard}>
            <View style={styles.publicationHeader}>
                <Text style={styles.publicationDate}>{formatDate(item.created_at)}</Text>
                {item.workout_session && (
                    <Text style={styles.publicationPoints}>
                        +{item.workout_session.total_points.toFixed(1)} очков
                    </Text>
                )}
            </View>
            {item.message && (
                <Text style={styles.publicationMessage}>{item.message}</Text>
            )}
            {item.workout_session?.exercise_sets && (
                <Text style={styles.publicationExercises}>
                    {getExerciseSummary(item.workout_session.exercise_sets)}
                </Text>
            )}
        </View>
    );

    if (!user) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>

                    <ScrollView
                        style={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                    >
                        {loading ? (
                            <ActivityIndicator size="large" color="#4CAF50" style={{ marginVertical: 40 }} />
                        ) : (
                            <>
                                {/* Profile Header */}
                                <View style={styles.header}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>
                                            {(user.nickname?.[0] || user.ed25519_public_key[8] || '?').toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.nickname}>
                                        {user.nickname || 'Без никнейма'}
                                    </Text>
                                    <Text style={styles.publicKey} numberOfLines={1}>
                                        {user.ed25519_public_key}
                                    </Text>
                                    {user.fms_category && (
                                        <View style={styles.categoryBadge}>
                                            <Text style={styles.categoryText}>{user.fms_category}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Stats */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.points.toLocaleString()}</Text>
                                        <Text style={styles.statLabel}>очков</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.workouts}</Text>
                                        <Text style={styles.statLabel}>тренировок</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.followers}</Text>
                                        <Text style={styles.statLabel}>подписчиков</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{publications.length}</Text>
                                        <Text style={styles.statLabel}>публикаций</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.students}</Text>
                                        <Text style={styles.statLabel}>учеников</Text>
                                    </View>
                                </View>

                                {/* Teacher Info */}
                                {userTeacher && (
                                    <View style={styles.teacherInfo}>
                                        <Text style={styles.teacherLabel}>👨‍🏫 Учитель:</Text>
                                        <Text style={styles.teacherValue} numberOfLines={1}>
                                            {userTeacher.substring(0, 20)}...
                                        </Text>
                                    </View>
                                )}

                                {/* Actions */}
                                {!isOwnProfile && (
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, following && styles.activeButton]}
                                            onPress={handleFollow}
                                            disabled={actionLoading}
                                        >
                                            <Text style={styles.actionIcon}>
                                                {following ? '✓' : '+'}
                                            </Text>
                                            <Text style={[styles.actionText, following && styles.activeText]}>
                                                {following ? 'Подписан' : 'Подписаться'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.teacherButton, isTeacher && styles.activeTeacher]}
                                            onPress={handleTeacher}
                                            disabled={actionLoading}
                                        >
                                            <Text style={styles.actionIcon}>👨‍🏫</Text>
                                            <Text style={[styles.actionText, isTeacher && styles.activeText]}>
                                                {isTeacher ? 'Мой учитель' : 'Указать учителем'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {isOwnProfile && (
                                    <View style={styles.ownProfileBadge}>
                                        <Text style={styles.ownProfileText}>Это ваш профиль</Text>
                                    </View>
                                )}

                                {/* Tab Switcher */}
                                <View style={styles.tabSwitcher}>
                                    <TouchableOpacity
                                        style={[styles.tabButton, activeTab === 'stats' && styles.activeTabButton]}
                                        onPress={() => setActiveTab('stats')}
                                    >
                                        <Text style={[styles.tabButtonText, activeTab === 'stats' && styles.activeTabButtonText]}>
                                            📊 Статистика
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.tabButton, activeTab === 'publications' && styles.activeTabButton]}
                                        onPress={() => setActiveTab('publications')}
                                    >
                                        <Text style={[styles.tabButtonText, activeTab === 'publications' && styles.activeTabButtonText]}>
                                            📰 Публикации ({publications.length})
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Tab Content */}
                                {activeTab === 'stats' && (
                                    <View style={styles.statsDetails}>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Подписки</Text>
                                            <Text style={styles.detailValue}>{stats.following}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Учеников</Text>
                                            <Text style={styles.detailValue}>{stats.students}</Text>
                                        </View>

                                        {/* Workout Sessions History */}
                                        <Text style={styles.sessionsTitle}>🏋️ История тренировок</Text>
                                        {sessionsLoading ? (
                                            <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 10 }} />
                                        ) : sessions.length === 0 ? (
                                            <Text style={styles.emptyText}>Нет тренировок</Text>
                                        ) : (
                                            sessions.slice(0, 10).map((session, index) => (
                                                <View key={session.signature || index} style={styles.sessionCard}>
                                                    <View style={styles.sessionHeader}>
                                                        <Text style={styles.sessionDate}>
                                                            {new Date(session.session_date).toLocaleDateString('ru-RU', {
                                                                day: 'numeric', month: 'short', year: 'numeric'
                                                            })}
                                                        </Text>
                                                        <Text style={styles.sessionPoints}>
                                                            +{session.total_points.toFixed(1)} очков
                                                        </Text>
                                                    </View>
                                                    <View style={styles.sessionExercises}>
                                                        {session.exercise_sets.slice(0, 4).map((ex, i) => (
                                                            <Text key={i} style={styles.sessionExercise}>
                                                                {ex.exercise_type}: {ex.exercise_type === 'UNUSED_MINUTES' ? `${Math.round(ex.seconds / 60)} мин.` : `${ex.reps || 0} повт.`}
                                                            </Text>
                                                        ))}
                                                        {session.exercise_sets.length > 4 && (
                                                            <Text style={styles.sessionMoreExercises}>
                                                                +{session.exercise_sets.length - 4} ещё...
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            ))
                                        )}
                                        {sessions.length > 10 && (
                                            <Text style={styles.moreSessionsText}>
                                                Показано 10 из {sessions.length} тренировок
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {activeTab === 'publications' && (
                                    <View style={styles.publicationsContainer}>
                                        {publicationsLoading ? (
                                            <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 20 }} />
                                        ) : publications.length === 0 ? (
                                            <View style={styles.emptyPublications}>
                                                <Text style={styles.emptyText}>Нет публикаций</Text>
                                            </View>
                                        ) : (
                                            publications.map(pub => (
                                                <View key={pub.publication_id} style={styles.publicationCard}>
                                                    <View style={styles.publicationHeader}>
                                                        <Text style={styles.publicationDate}>{formatDate(pub.created_at)}</Text>
                                                        {pub.workout_session && (
                                                            <Text style={styles.publicationPoints}>
                                                                +{pub.workout_session.total_points.toFixed(1)} очков
                                                            </Text>
                                                        )}
                                                    </View>
                                                    {pub.message && (
                                                        <Text style={styles.publicationMessage}>{pub.message}</Text>
                                                    )}
                                                    {pub.workout_session?.exercise_sets && (
                                                        <Text style={styles.publicationExercises}>
                                                            {getExerciseSummary(pub.workout_session.exercise_sets)}
                                                        </Text>
                                                    )}
                                                </View>
                                            ))
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#2a2a2a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
        padding: 8,
    },
    closeText: {
        color: '#888',
        fontSize: 20,
    },
    header: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    nickname: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    publicKey: {
        color: '#666',
        fontSize: 12,
        paddingHorizontal: 40,
    },
    categoryBadge: {
        backgroundColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    categoryText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#888',
        fontSize: 11,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        padding: 14,
        gap: 8,
    },
    activeButton: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    teacherButton: {
        backgroundColor: '#2196F3',
    },
    activeTeacher: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#2196F3',
    },
    actionIcon: {
        fontSize: 18,
    },
    actionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    activeText: {
        color: '#888',
    },
    ownProfileBadge: {
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    ownProfileText: {
        color: '#888',
        fontSize: 14,
    },
    tabSwitcher: {
        flexDirection: 'row',
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTabButton: {
        backgroundColor: '#4CAF50',
    },
    tabButtonText: {
        color: '#888',
        fontSize: 13,
    },
    activeTabButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    statsDetails: {
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    detailLabel: {
        color: '#888',
        fontSize: 14,
    },
    detailValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    publicationsContainer: {
        paddingBottom: 20,
    },
    publicationCard: {
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    publicationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    publicationDate: {
        color: '#888',
        fontSize: 12,
    },
    publicationPoints: {
        color: '#4CAF50',
        fontSize: 13,
        fontWeight: '600',
    },
    publicationMessage: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 8,
    },
    publicationExercises: {
        color: '#aaa',
        fontSize: 12,
    },
    emptyPublications: {
        padding: 30,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
    },
    teacherInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a3a2a',
        padding: 12,
        borderRadius: 10,
        marginTop: 15,
        marginHorizontal: 15,
    },
    teacherLabel: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
        marginRight: 8,
    },
    teacherValue: {
        color: '#fff',
        fontSize: 13,
        flex: 1,
    },
    sessionsTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
    },
    sessionCard: {
        backgroundColor: '#1a221a',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sessionDate: {
        color: '#aaa',
        fontSize: 13,
    },
    sessionPoints: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
    },
    sessionExercises: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    sessionExercise: {
        color: '#ccc',
        fontSize: 12,
        backgroundColor: '#2a2a2a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sessionMoreExercises: {
        color: '#888',
        fontSize: 12,
        fontStyle: 'italic',
    },
    moreSessionsText: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 10,
    },
});

export default UserProfileModal;
