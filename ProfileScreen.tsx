import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
} from 'react-native';
import { loadUserProfile, loadWorkoutSessions, getStorageInfo, clearAllData, createDefaultProfile } from './storageService';
import { getCurrentWeekStats, getNRAHistory } from './nraCalculationService';
import { getVirtualDate, getDateInfo } from './testingUtils';
import { UserProfile, WeeklyStats, WorkoutSession, getExerciseConfig } from './types';

interface ProfileScreenProps {
    onNavigateToLeaderboard?: () => void;
    onNavigateToWorkout?: () => void;
}

function ProfileScreen({ onNavigateToLeaderboard, onNavigateToWorkout }: ProfileScreenProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [currentWeek, setCurrentWeek] = useState<WeeklyStats | null>(null);
    const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
    const [nraHistory, setNraHistory] = useState<WeeklyStats[]>([]);
    const [dateInfo, setDateInfo] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load profile
            const userProfile = await loadUserProfile();
            setProfile(userProfile);

            // Load current week stats
            const weekStats = await getCurrentWeekStats();
            setCurrentWeek(weekStats);

            // Load recent sessions (last 10)
            const allSessions = await loadWorkoutSessions();
            const recent = allSessions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10);
            setRecentSessions(recent);

            // Load NRA history (last 8 weeks)
            const history = await getNRAHistory(8);
            setNraHistory(history);

            // Get date info
            const info = await getDateInfo();
            setDateInfo(info);

            // Get storage info for debugging
            const storageInfo = await getStorageInfo();
            console.log('[ProfileScreen] Storage info:', storageInfo);
        } catch (error) {
            console.error('[ProfileScreen] Error loading data:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            'Очистить статистику',
            'Вы уверены? Это действие удалит все ваши тренировки и прогресс безвозвратно.',
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await clearAllData();
                            await createDefaultProfile();
                            await loadData();
                            Alert.alert('Успешно', 'Вся статистика была очищена.');
                        } catch (error) {
                            console.error('Error clearing data:', error);
                            Alert.alert('Ошибка', 'Не удалось очистить данные.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>No profile found</Text>
                <TouchableOpacity style={styles.button} onPress={loadData}>
                    <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const screenWidth = Dimensions.get('window').width;

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.nameText}>{profile.name}</Text>
                    <Text style={styles.dateText}>{dateInfo}</Text>
                </View>
            </View>

            {/* NRA Score Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Недельный Рейтинг Активности (НРА)</Text>
                <View style={styles.nraScoreContainer}>
                    <Text style={styles.nraScore}>{profile.currentNRA}</Text>
                    <Text style={styles.nraLabel}>текущий НРА</Text>
                </View>

                {currentWeek && (
                    <View style={styles.nraComponents}>
                        <View style={styles.nraComponent}>
                            <Text style={styles.componentValue}>{currentWeek.nraComponents.wds.toFixed(0)}</Text>
                            <Text style={styles.componentLabel}>WDS</Text>
                            <Text style={styles.componentSubLabel}>Дисциплина</Text>
                        </View>
                        <View style={styles.nraComponent}>
                            <Text style={styles.componentValue}>{currentWeek.nraComponents.multiplier.toFixed(2)}x</Text>
                            <Text style={styles.componentLabel}>МС</Text>
                            <Text style={styles.componentSubLabel}>Множитель</Text>
                        </View>
                        <View style={styles.nraComponent}>
                            <Text style={styles.componentValue}>{currentWeek.nraComponents.was.toFixed(0)}</Text>
                            <Text style={styles.componentLabel}>WAS</Text>
                            <Text style={styles.componentSubLabel}>Объем</Text>
                        </View>
                        <View style={styles.nraComponent}>
                            <Text style={styles.componentValue}>{currentWeek.nraComponents.wms.toFixed(0)}</Text>
                            <Text style={styles.componentLabel}>WMS</Text>
                            <Text style={styles.componentSubLabel}>Мастерство</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{profile.currentStreakWeeks}</Text>
                    <Text style={styles.statLabel}>Стрик (недель)</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{profile.totalWorkouts}</Text>
                    <Text style={styles.statLabel}>Тренировок</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{profile.totalReps}</Text>
                    <Text style={styles.statLabel}>Повторений</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{profile.totalMinutes}</Text>
                    <Text style={styles.statLabel}>Минут</Text>
                </View>
            </View>

            {/* Current Week Progress */}
            {currentWeek && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Текущая неделя</Text>
                    <View style={styles.weekInfo}>
                        <Text style={styles.weekText}>
                            {new Date(currentWeek.weekStartDate).toLocaleDateString()} - {new Date(currentWeek.weekEndDate).toLocaleDateString()}
                        </Text>
                        <Text style={styles.weekStat}>Активных дней: {currentWeek.daysActive}/7</Text>
                        <Text style={styles.weekStat}>Объем: {currentWeek.totalVolume}</Text>
                        <Text style={styles.weekStat}>
                            Группы мышц: {currentWeek.muscleGroupsWorked.join(', ') || 'Нет'}
                        </Text>
                    </View>
                </View>
            )}

            {/* NRA History Chart (Simple) */}
            {nraHistory.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>История НРА (последние 8 недель)</Text>
                    <View style={styles.chartContainer}>
                        {nraHistory.map((week, index) => {
                            const maxNRA = Math.max(...nraHistory.map(w => w.nraScore), 100);
                            const barHeight = (week.nraScore / maxNRA) * 150;

                            return (
                                <View key={index} style={styles.chartBar}>
                                    <View style={[styles.bar, { height: barHeight }]}>
                                        <Text style={styles.barValue}>{week.nraScore}</Text>
                                    </View>
                                    <Text style={styles.barLabel}>
                                        {new Date(week.weekStartDate).toLocaleDateString('ru', { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Recent Sessions */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Последние тренировки</Text>
                {recentSessions.length === 0 ? (
                    <Text style={styles.emptyText}>Нет тренировок</Text>
                ) : (
                    recentSessions.map((session, index) => (
                        <View key={session.id} style={styles.sessionItem}>
                            <View style={styles.sessionHeader}>
                                <Text style={styles.sessionDate}>
                                    {new Date(session.date).toLocaleDateString('ru', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </Text>
                                <Text style={styles.sessionDuration}>
                                    {Math.floor(session.totalDurationSeconds / 60)} мин
                                </Text>
                            </View>
                            <View style={{ marginTop: 4 }}>
                                {session.exercises.map((exercise, idx) => {
                                    const config = getExerciseConfig(exercise.exerciseName);
                                    const displayName = config ? config.displayName : exercise.exerciseName;
                                    const details = [];
                                    if (exercise.reps) details.push(`${exercise.reps} повт.`);
                                    if (exercise.durationSeconds) details.push(`${Math.round(exercise.durationSeconds)} сек.`);

                                    return (
                                        <Text key={idx} style={styles.sessionExercises}>
                                            • {displayName}: {details.join(' + ')}
                                        </Text>
                                    );
                                })}
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonPrimary]}
                    onPress={onNavigateToWorkout}
                >
                    <Text style={styles.navButtonText}>🏋️ Начать тренировку</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonSecondary]}
                    onPress={onNavigateToLeaderboard}
                >
                    <Text style={styles.navButtonText}>🏆 Таблица лидеров</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonInfo]}
                    onPress={loadData}
                >
                    <Text style={styles.navButtonText}>🔄 Обновить</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.dangerZone}>
                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonDanger]}
                    onPress={handleClearData}
                >
                    <Text style={styles.navButtonText}>🗑️ Очистить статистику</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
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
    errorText: {
        color: '#ff6b6b',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 100,
    },
    header: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4a9eff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerInfo: {
        marginLeft: 15,
        flex: 1,
    },
    nameText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    dateText: {
        color: '#999',
        fontSize: 14,
        marginTop: 4,
    },
    card: {
        backgroundColor: '#2a2a2a',
        margin: 10,
        padding: 15,
        borderRadius: 10,
    },
    cardTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    nraScoreContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    nraScore: {
        color: '#4a9eff',
        fontSize: 48,
        fontWeight: 'bold',
    },
    nraLabel: {
        color: '#999',
        fontSize: 14,
    },
    nraComponents: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    nraComponent: {
        alignItems: 'center',
    },
    componentValue: {
        color: '#4a9eff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    componentLabel: {
        color: 'white',
        fontSize: 12,
        marginTop: 4,
    },
    componentSubLabel: {
        color: '#666',
        fontSize: 10,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 10,
        marginBottom: 10,
    },
    statCard: {
        backgroundColor: '#2a2a2a',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    statValue: {
        color: '#4a9eff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    weekInfo: {
        gap: 8,
    },
    weekText: {
        color: 'white',
        fontSize: 14,
    },
    weekStat: {
        color: '#999',
        fontSize: 14,
    },
    chartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 180,
        paddingTop: 20,
    },
    chartBar: {
        alignItems: 'center',
        flex: 1,
    },
    bar: {
        backgroundColor: '#4a9eff',
        width: 30,
        borderRadius: 5,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 5,
    },
    barValue: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    barLabel: {
        color: '#999',
        fontSize: 10,
        marginTop: 5,
        textAlign: 'center',
    },
    sessionItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#3a3a3a',
        paddingVertical: 12,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sessionDate: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    sessionDuration: {
        color: '#4a9eff',
        fontSize: 14,
    },
    sessionExercises: {
        color: '#999',
        fontSize: 12,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
    navigationButtons: {
        padding: 10,
        gap: 10,
    },
    navButton: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    navButtonPrimary: {
        backgroundColor: '#28a745',
    },
    navButtonSecondary: {
        backgroundColor: '#ffc107',
    },
    navButtonInfo: {
        backgroundColor: '#17a2b8',
    },
    navButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#4a9eff',
        padding: 15,
        borderRadius: 10,
        margin: 20,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dangerZone: {
        padding: 10,
        marginTop: 20,
        marginBottom: 20,
    },
    navButtonDanger: {
        backgroundColor: '#dc3545',
    },
});

export default ProfileScreen;
