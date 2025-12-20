import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { runningTracker, RunningMetrics, RunningSession } from './runningTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock data for friends' activities
interface FriendActivity {
    id: string;
    userName: string;
    avatar: string;
    distance: number;
    duration: number;
    pace: number;
    timeAgo: string;
    likes: number;
}

const MOCK_FRIENDS_ACTIVITIES: FriendActivity[] = [
    {
        id: '1',
        userName: 'Alex Petrov',
        avatar: '🏃',
        distance: 5.2,
        duration: 1560, // 26 minutes
        pace: 5.0,
        timeAgo: '2h ago',
        likes: 12,
    },
    {
        id: '2',
        userName: 'Maria K.',
        avatar: '🏃‍♀️',
        distance: 10.5,
        duration: 3240, // 54 minutes
        pace: 5.14,
        timeAgo: '5h ago',
        likes: 24,
    },
    {
        id: '3',
        userName: 'Dmitry S.',
        avatar: '💪',
        distance: 3.8,
        duration: 1140, // 19 minutes
        pace: 5.0,
        timeAgo: '1d ago',
        likes: 8,
    },
    {
        id: '4',
        userName: 'Elena V.',
        avatar: '⚡',
        distance: 7.2,
        duration: 2160, // 36 minutes
        pace: 5.0,
        timeAgo: '1d ago',
        likes: 15,
    },
    {
        id: '5',
        userName: 'Ivan R.',
        avatar: '🔥',
        distance: 12.0,
        duration: 3720, // 62 minutes
        pace: 5.17,
        timeAgo: '2d ago',
        likes: 31,
    },
];

function RunningScreen() {
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [metrics, setMetrics] = useState<RunningMetrics>({
        distance: 0,
        duration: 0,
        currentPace: 0,
        averagePace: 0,
        currentSpeed: 0,
        averageSpeed: 0,
        calories: 0,
    });

    // Timer for duration display
    useEffect(() => {
        let interval: any;
        if (isTracking && !isPaused) {
            interval = setInterval(() => {
                const session = runningTracker.getCurrentSession();
                if (session) {
                    const currentTime = Date.now();
                    const duration = Math.floor((currentTime - session.startTime - session.pausedDuration) / 1000);
                    setMetrics(prev => ({ ...prev, duration }));
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTracking, isPaused]);

    const handleStart = async () => {
        const started = await runningTracker.startTracking((newMetrics) => {
            setMetrics(newMetrics);
        });

        if (started) {
            setIsTracking(true);
            setIsPaused(false);
        } else {
            Alert.alert(
                'Permission Required',
                'Location permission is required for running tracking. Please enable it in settings.',
                [{ text: 'OK' }]
            );
        }
    };

    const handlePause = () => {
        if (isPaused) {
            runningTracker.resumeTracking();
            setIsPaused(false);
        } else {
            runningTracker.pauseTracking();
            setIsPaused(true);
        }
    };

    const handleStop = async () => {
        Alert.alert(
            'End Workout',
            'Are you sure you want to end this running session?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End',
                    style: 'destructive',
                    onPress: async () => {
                        const session = runningTracker.stopTracking();
                        if (session) {
                            // Save session to storage
                            try {
                                await AsyncStorage.setItem(
                                    `running_${session.sessionId}`,
                                    JSON.stringify(session)
                                );
                                Alert.alert(
                                    'Workout Saved',
                                    `Distance: ${session.metrics.distance.toFixed(2)} km\nDuration: ${formatDuration(session.metrics.duration)}\nCalories: ${Math.round(session.metrics.calories)} kcal`,
                                    [{ text: 'OK' }]
                                );
                            } catch (error) {
                                console.error('Error saving running session:', error);
                            }
                        }
                        setIsTracking(false);
                        setIsPaused(false);
                        setMetrics({
                            distance: 0,
                            duration: 0,
                            currentPace: 0,
                            averagePace: 0,
                            currentSpeed: 0,
                            averageSpeed: 0,
                            calories: 0,
                        });
                    },
                },
            ]
        );
    };

    const FriendActivityCard = ({ activity }: { activity: FriendActivity }) => {
        const formatPaceShort = (pace: number): string => {
            const minutes = Math.floor(pace);
            const seconds = Math.floor((pace - minutes) * 60);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const formatDurationShort = (seconds: number): string => {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m`;
        };

        return (
            <View style={styles.activityCard}>
                <View style={styles.activityHeader}>
                    <Text style={styles.activityAvatar}>{activity.avatar}</Text>
                    <View style={styles.activityUserInfo}>
                        <Text style={styles.activityUserName}>{activity.userName}</Text>
                        <Text style={styles.activityTime}>{activity.timeAgo}</Text>
                    </View>
                </View>

                <View style={styles.activityStats}>
                    <View style={styles.activityStatItem}>
                        <Text style={styles.activityStatValue}>{activity.distance.toFixed(1)}</Text>
                        <Text style={styles.activityStatLabel}>km</Text>
                    </View>
                    <View style={styles.activityStatDivider} />
                    <View style={styles.activityStatItem}>
                        <Text style={styles.activityStatValue}>{formatDurationShort(activity.duration)}</Text>
                        <Text style={styles.activityStatLabel}>time</Text>
                    </View>
                    <View style={styles.activityStatDivider} />
                    <View style={styles.activityStatItem}>
                        <Text style={styles.activityStatValue}>{formatPaceShort(activity.pace)}</Text>
                        <Text style={styles.activityStatLabel}>pace</Text>
                    </View>
                </View>

                <View style={styles.activityFooter}>
                    <Text style={styles.activityLikes}>❤️ {activity.likes}</Text>
                </View>
            </View>
        );
    };

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatPace = (pace: number): string => {
        if (pace === 0 || !isFinite(pace)) return '--:--';
        const minutes = Math.floor(pace);
        const seconds = Math.floor((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>🏃 Running Tracker</Text>
                    <Text style={styles.subtitle}>
                        {isTracking ? (isPaused ? 'Paused' : 'Tracking...') : 'Ready to run'}
                    </Text>
                </View>

                {/* Main Stats */}
                <View style={styles.mainStats}>
                    <View style={styles.mainStatCard}>
                        <Text style={styles.mainStatLabel}>Distance</Text>
                        <Text style={styles.mainStatValue}>{metrics.distance.toFixed(2)}</Text>
                        <Text style={styles.mainStatUnit}>km</Text>
                    </View>
                    <View style={styles.mainStatCard}>
                        <Text style={styles.mainStatLabel}>Duration</Text>
                        <Text style={styles.mainStatValue}>{formatDuration(metrics.duration)}</Text>
                        <Text style={styles.mainStatUnit}>time</Text>
                    </View>
                </View>

                {/* Secondary Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Avg Pace</Text>
                        <Text style={styles.statValue}>{formatPace(metrics.averagePace)}</Text>
                        <Text style={styles.statUnit}>min/km</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Current Pace</Text>
                        <Text style={styles.statValue}>{formatPace(metrics.currentPace)}</Text>
                        <Text style={styles.statUnit}>min/km</Text>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Avg Speed</Text>
                        <Text style={styles.statValue}>{metrics.averageSpeed.toFixed(1)}</Text>
                        <Text style={styles.statUnit}>km/h</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Calories</Text>
                        <Text style={styles.statValue}>{Math.round(metrics.calories)}</Text>
                        <Text style={styles.statUnit}>kcal</Text>
                    </View>
                </View>

                {/* Control Buttons */}
                <View style={styles.controlsContainer}>
                    {!isTracking ? (
                        <TouchableOpacity
                            style={[styles.controlButton, styles.startButton]}
                            onPress={handleStart}
                        >
                            <Text style={styles.controlButtonText}>▶ Start Running</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.controlButton, isPaused ? styles.resumeButton : styles.pauseButton]}
                                onPress={handlePause}
                            >
                                <Text style={styles.controlButtonText}>
                                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.controlButton, styles.stopButton]}
                                onPress={handleStop}
                            >
                                <Text style={styles.controlButtonText}>⏹ Stop</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Friends' Activity Feed */}
                {!isTracking && (
                    <View style={styles.feedSection}>
                        <Text style={styles.feedTitle}>🌟 Friends' Activity</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.feedContainer}
                        >
                            {MOCK_FRIENDS_ACTIVITIES.map((activity) => (
                                <FriendActivityCard key={activity.id} activity={activity} />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Info */}
                {!isTracking && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>📍 GPS Tracking</Text>
                        <Text style={styles.infoText}>
                            • High accuracy GPS tracking{'\n'}
                            • Real-time distance & pace{'\n'}
                            • Automatic calorie calculation{'\n'}
                            • Route recording for map view
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    content: {
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#999',
    },
    mainStats: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
    },
    mainStatCard: {
        flex: 1,
        backgroundColor: '#2a2a2a',
        padding: 25,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#16B139',
    },
    mainStatLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    mainStatValue: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 4,
    },
    mainStatUnit: {
        fontSize: 14,
        color: '#666',
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 15,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#2a2a2a',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 6,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 2,
    },
    statUnit: {
        fontSize: 11,
        color: '#666',
    },
    controlsContainer: {
        marginTop: 20,
        marginBottom: 20,
        gap: 12,
    },
    controlButton: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    startButton: {
        backgroundColor: '#16B139',
    },
    pauseButton: {
        backgroundColor: '#FF9800',
    },
    resumeButton: {
        backgroundColor: '#16B139',
    },
    stopButton: {
        backgroundColor: '#dc3545',
    },
    controlButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    infoBox: {
        backgroundColor: '#2a2a2a',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#16B139',
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 24,
    },
    // Friends' Activity Feed Styles
    feedSection: {
        marginBottom: 20,
    },
    feedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 15,
        paddingHorizontal: 4,
    },
    feedContainer: {
        gap: 15,
        paddingRight: 20,
    },
    activityCard: {
        width: 200,
        backgroundColor: '#2a2a2a',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#16B139',
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    activityAvatar: {
        fontSize: 32,
        marginRight: 10,
    },
    activityUserInfo: {
        flex: 1,
    },
    activityUserName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 2,
    },
    activityTime: {
        fontSize: 11,
        color: '#999',
    },
    activityStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    activityStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    activityStatValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#16B139',
        marginBottom: 2,
    },
    activityStatLabel: {
        fontSize: 10,
        color: '#666',
        textTransform: 'uppercase',
    },
    activityStatDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#333',
    },
    activityFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityLikes: {
        fontSize: 13,
        color: '#999',
        fontWeight: '600',
    },
});

export default RunningScreen;
