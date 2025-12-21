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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISE_NAMES, EXERCISES } from './common_types';
import { SimpleWorkoutSession, SimpleExerciseRecord } from './exerciseTrackingService';
import WeeklyStreakCalendar from './WeeklyStreakCalendar';
import { getTodaySteps, subscribeToSteps, startStepCounter, getStepsForDate } from './stepCounterService';
import { getVirtualDate } from './testingUtils';
import { filterSessionsByDate, getRunningKilometersForDate } from './profileHelpers';
import { getAutoSyncEnabled } from './autoSyncService';
import { getUserAllSessions, ServerWorkoutSession } from './statsService';
import { getCurrentUser } from './authService';

// Optional navigation import - don't crash if not available
let useNavigation: (() => any) | null = null;
try {
    useNavigation = require('@react-navigation/native').useNavigation;
} catch (e) {
    console.log('Navigation not available');
}

interface ProfileScreenProps {
    onNavigateToHome?: () => void;
    onNavigateToLeaderboard?: () => void;
}

interface SessionDisplay {
    id: string;
    date: Date;
    totalDurationSeconds: number;
    exercises: Array<{
        exerciseName: EXERCISES;
        reps?: number;
        durationSeconds: number;
    }>;
}

function ProfileScreen({ onNavigateToHome, onNavigateToLeaderboard }: ProfileScreenProps = {}) {
    // Try to get navigation from context, but don't crash if not available
    let navigation: any = null;
    try {
        if (useNavigation) {
            navigation = useNavigation();
        }
    } catch (e) {
        // Navigation context not available - that's okay
    }

    const [recentSessions, setRecentSessions] = useState<SessionDisplay[]>([]);
    const [allSessions, setAllSessions] = useState<SimpleWorkoutSession[]>([]);
    const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
    const [totalReps, setTotalReps] = useState<number>(0);
    const [totalMinutes, setTotalMinutes] = useState<number>(0);
    const [todaySteps, setTodaySteps] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedDateSteps, setSelectedDateSteps] = useState<number>(0);
    const [selectedDateKm, setSelectedDateKm] = useState<number>(0);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load SimpleWorkoutSession data from AsyncStorage
            const keys = await AsyncStorage.getAllKeys();
            const sessionKeys = keys.filter(key => key.startsWith('session_'));

            const localSessions: SimpleWorkoutSession[] = [];
            for (const key of sessionKeys) {
                const sessionData = await AsyncStorage.getItem(key);
                if (sessionData) {
                    localSessions.push(JSON.parse(sessionData));
                }
            }

            let sessions: SimpleWorkoutSession[] = [...localSessions];

            // Check if auto-sync is enabled - if so, fetch from server
            const autoSyncEnabled = await getAutoSyncEnabled();
            if (autoSyncEnabled) {
                try {
                    const user = await getCurrentUser();
                    if (user?.publicKey) {
                        console.log('[ProfileScreen] Auto-sync enabled, fetching from server...');
                        const serverSessions = await getUserAllSessions(user.publicKey);
                        console.log('[ProfileScreen] Got', serverSessions.length, 'sessions from server');

                        // Process server sessions - extract steps and save separately
                        for (const serverSession of serverSessions) {
                            for (const set of serverSession.exercise_sets) {
                                // If this is a STEPS exercise, save to steps storage
                                if (set.exercise_type === 'STEPS' && set.reps) {
                                    const sessionDate = new Date(serverSession.session_date);
                                    const dateStr = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
                                    const stepsKey = `@iSparta:steps_${dateStr}`;

                                    // Check if we already have steps for this date
                                    const existingSteps = await AsyncStorage.getItem(stepsKey);
                                    const existingValue = existingSteps ? parseInt(existingSteps, 10) : 0;

                                    // Only update if server has more steps
                                    if (set.reps > existingValue) {
                                        await AsyncStorage.setItem(stepsKey, set.reps.toString());
                                        console.log('[ProfileScreen] Saved steps from server:', set.reps, 'for date:', dateStr);
                                    }
                                }
                            }
                        }

                        // Convert server sessions to local format (excluding pure STEPS sessions)
                        const convertedServerSessions: SimpleWorkoutSession[] = serverSessions
                            .filter(serverSession => {
                                // Filter out sessions that ONLY contain STEPS exercises
                                const nonStepsExercises = serverSession.exercise_sets.filter(
                                    set => set.exercise_type !== 'STEPS'
                                );
                                return nonStepsExercises.length > 0;
                            })
                            .map((serverSession: ServerWorkoutSession) => {
                                // Create exercises record from server exercise sets
                                const exercises: Record<EXERCISES, SimpleExerciseRecord> =
                                    Object.values(EXERCISES).reduce((acc, ex) => {
                                        acc[ex] = { duration: 0, reps: undefined };
                                        return acc;
                                    }, {} as Record<EXERCISES, SimpleExerciseRecord>);

                                // Populate from server data (skip STEPS - handled separately)
                                serverSession.exercise_sets.forEach(set => {
                                    if (set.exercise_type === 'STEPS') return; // Skip STEPS

                                    const exerciseType = set.exercise_type as EXERCISES;
                                    if (exercises[exerciseType]) {
                                        exercises[exerciseType] = {
                                            duration: set.seconds || 0,
                                            reps: set.reps || undefined,
                                        };
                                    }
                                });

                                return {
                                    sessionId: serverSession.signature,
                                    startTime: new Date(serverSession.session_date),
                                    exercises,
                                };
                            });

                        // Merge: use Map to avoid duplicates (server data takes priority)
                        const sessionMap = new Map<string, SimpleWorkoutSession>();

                        // Add local sessions first
                        localSessions.forEach(s => sessionMap.set(s.sessionId, s));

                        // Server sessions override local (they have confirmed data)
                        convertedServerSessions.forEach(s => sessionMap.set(s.sessionId, s));

                        sessions = Array.from(sessionMap.values());
                        console.log('[ProfileScreen] Merged to', sessions.length, 'unique sessions');
                    }
                } catch (serverError) {
                    console.warn('[ProfileScreen] Failed to fetch from server, using local only:', serverError);
                    // Continue with local sessions only
                }
            }

            // Convert SimpleWorkoutSession to SessionDisplay format
            const displaySessions: SessionDisplay[] = sessions.map(session => {
                const exercises: Array<{
                    exerciseName: EXERCISES;
                    reps?: number;
                    durationSeconds: number;
                }> = [];

                // Extract exercises with non-zero activity
                Object.entries(session.exercises).forEach(([exerciseName, record]) => {
                    if (record.duration > 0 || (record.reps && record.reps > 0)) {
                        exercises.push({
                            exerciseName: exerciseName as EXERCISES,
                            reps: record.reps,
                            durationSeconds: record.duration
                        });
                    }
                });

                const totalDuration = Object.values(session.exercises).reduce(
                    (sum, ex) => sum + ex.duration, 0
                );

                return {
                    id: session.sessionId,
                    date: new Date(session.startTime),
                    totalDurationSeconds: totalDuration,
                    exercises
                };
            });

            // Sort by date and take last 10
            const recent = displaySessions
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 10);
            setRecentSessions(recent);
            setAllSessions(sessions);

            // Calculate totals
            setTotalWorkouts(sessions.length);
            const totalRepsCount = displaySessions.reduce((sum, session) => {
                return sum + session.exercises.reduce((exSum, ex) => exSum + (ex.reps || 0), 0);
            }, 0);
            setTotalReps(totalRepsCount);

            const totalSeconds = displaySessions.reduce((sum, session) => sum + session.totalDurationSeconds, 0);
            setTotalMinutes(Math.floor(totalSeconds / 60));

            // Load today's steps
            const steps = await getTodaySteps();
            setTodaySteps(steps);

            console.log('[ProfileScreen] Loaded', sessions.length, 'sessions (local + server)');
        } catch (error) {
            console.error('[ProfileScreen] Error loading data:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to step counter updates
    useEffect(() => {
        console.log('[ProfileScreen] Starting step counter subscription');

        // Start step counter and set initial value
        startStepCounter().then((initialSteps) => {
            console.log('[ProfileScreen] Initial steps:', initialSteps);
            setTodaySteps(initialSteps);
        });

        const unsubscribe = subscribeToSteps((steps) => {
            console.log('[ProfileScreen] Steps updated:', steps);
            setTodaySteps(steps);
        });

        return () => {
            console.log('[ProfileScreen] Unsubscribing from step counter');
            unsubscribe();
        };
    }, []);

    // Initialize selectedDate from virtual date - also reload on focus
    useEffect(() => {
        const loadVirtualDate = async () => {
            const virtualDate = await getVirtualDate();
            console.log('[ProfileScreen] Setting selectedDate to virtual date:', virtualDate);
            setSelectedDate(virtualDate);

            // Also load steps for virtual date
            const steps = await getStepsForDate(virtualDate);
            setSelectedDateSteps(steps);
        };

        loadVirtualDate();

        // If navigation is available, reload on focus
        if (navigation) {
            const unsubscribe = navigation.addListener('focus', () => {
                console.log('[ProfileScreen] Screen focused - reloading virtual date');
                loadVirtualDate();
                loadData();
            });
            return unsubscribe;
        }
    }, [navigation]);

    // Handle date selection from calendar
    const handleDateSelect = async (date: Date) => {
        console.log('[ProfileScreen] Date selected:', date);
        setSelectedDate(date);

        // Load steps for selected date
        const steps = await getStepsForDate(date);
        setSelectedDateSteps(steps);

        // Calculate km for selected date
        const km = getRunningKilometersForDate(allSessions, date);
        setSelectedDateKm(km);

        console.log('[ProfileScreen] Selected date data - steps:', steps, 'km:', km);
    };

    // Update selected date data when allSessions changes
    useEffect(() => {
        if (allSessions.length > 0) {
            handleDateSelect(selectedDate);
        }
    }, [allSessions]);

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
                            // Clear all session_* keys
                            const keys = await AsyncStorage.getAllKeys();
                            const sessionKeys = keys.filter(key => key.startsWith('session_'));
                            await AsyncStorage.multiRemove(sessionKeys);
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

    const screenWidth = Dimensions.get('window').width;

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>S</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.nameText}>iSparta Profile</Text>
                    <Text style={styles.dateText}>Workout Statistics</Text>
                </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalWorkouts}</Text>
                    <Text style={styles.statLabel}>Всего тренировок</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalReps}</Text>
                    <Text style={styles.statLabel}>Всего повторений</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>{totalMinutes}</Text>
                    <Text style={styles.statLabel}>Всего минут</Text>
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statValue}>👟 {selectedDateSteps}</Text>
                    <Text style={styles.statLabel}>Шагов ({selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'short' })})</Text>
                </View>
            </View>

            {/* Weekly Streak Calendar */}
            <WeeklyStreakCalendar
                sessions={allSessions}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
            />

            {/* Selected Date Stats */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>
                    📅 {selectedDate.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { flex: 1, marginRight: 5 }]}>
                        <Text style={styles.statValue}>👟 {selectedDateSteps}</Text>
                        <Text style={styles.statLabel}>Шагов</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1, marginLeft: 5 }]}>
                        <Text style={styles.statValue}>🏃 {selectedDateKm} км</Text>
                        <Text style={styles.statLabel}>Пробежка</Text>
                    </View>
                </View>
                {filterSessionsByDate(allSessions, selectedDate).length === 0 ? (
                    <Text style={styles.emptyText}>Нет тренировок в этот день</Text>
                ) : (
                    filterSessionsByDate(allSessions, selectedDate).map((session, index) => (
                        <TouchableOpacity
                            key={session.sessionId}
                            style={styles.sessionItem}
                            onPress={() => {
                                // Check if session has running data
                                const runningExercise = session.exercises['RUNNING'];
                                if (runningExercise && runningExercise['svg:path[d]']) {
                                    if (navigation?.navigate) {
                                        navigation.navigate('Running', {
                                            screen: 'RunningMap', // Assuming RunningMapScreen is the component for 'Running' tab or nested
                                            params: {
                                                mode: 'VIEWING',
                                                routePoints: runningExercise.route_points,
                                                routeBounds: runningExercise.route_bounds
                                            }
                                        });
                                        // Or if 'Running' tab IS the RunningMapScreen, we might need to pass params differently
                                        // Since TabNavigator maps 'Running' to RunningMapScreen directly:
                                        navigation.navigate('Running', {
                                            mode: 'VIEWING',
                                            routePoints: runningExercise.route_points,
                                            routeBounds: runningExercise.route_bounds
                                        });
                                    }
                                }
                            }}
                        >
                            <Text style={styles.sessionDate}>
                                Тренировка {index + 1}
                            </Text>
                            {Object.entries(session.exercises).map(([exerciseName, record]) => {
                                if (!record.duration && !record.reps && !record.kilometers) return null;
                                const displayName = EXERCISE_NAMES[exerciseName as EXERCISES] || exerciseName;
                                const details = [];
                                if (record.reps) details.push(`${record.reps} повт.`);
                                if (record.duration) details.push(`${Math.round(record.duration)} сек.`);
                                if (record.kilometers) details.push(`${record.kilometers.toFixed(2)} км`);
                                return (
                                    <Text key={exerciseName} style={styles.sessionExercises}>
                                        • {displayName}: {details.join(' + ')}
                                    </Text>
                                );
                            })}
                        </TouchableOpacity>
                    ))
                )}
            </View>

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
                                    const displayName = EXERCISE_NAMES[exercise.exerciseName] || exercise.exerciseName;
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
                    onPress={() => {
                        if (onNavigateToHome) {
                            onNavigateToHome();
                        } else if (navigation?.navigate) {
                            navigation.navigate('Home' as never);
                        }
                    }}
                >
                    <Text style={styles.navButtonText}>🏋️ Начать тренировку</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navButton, styles.navButtonSecondary]}
                    onPress={() => {
                        if (onNavigateToLeaderboard) {
                            onNavigateToLeaderboard();
                        } else if (navigation?.navigate) {
                            navigation.navigate('Leaderboard' as never);
                        }
                    }}
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
