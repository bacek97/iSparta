/**
 * Publications Feed Component
 * Displays list of workout publications from group members
 * Supports real-time updates via WebSocket subscription when auto-sync is enabled
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    StyleSheet,
    Image,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getUserFeedPublications, subscribeToGroupPublications } from '../publicationsService';
import { getAutoSyncEnabled } from '../autoSyncService';
import { getCurrentUser } from '../authService';
import { showNewPublicationNotification } from '../notificationService';
import type { PublicationWithWorkout } from '../common_types';
import { EXERCISE_NAMES } from '../common_types';
import { UserProfileModal } from './UserProfileModal';

interface Props {
    currentUserKey: string;
}

export const PublicationsFeed: React.FC<Props> = ({ currentUserKey }) => {
    const [publications, setPublications] = useState<PublicationWithWorkout[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

    const loadPublications = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            // Load publications from all user's groups and followed users
            const data = await getUserFeedPublications(currentUserKey);
            setPublications(data);
        } catch (err) {
            console.error('[PublicationsFeed] Error:', err);
            setError('Error loading publications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (currentUserKey) {
            loadPublications();
        }
    }, [currentUserKey]);

    const renderWorkoutSummary = (workout: PublicationWithWorkout['workout_session']) => {
        if (!workout?.exercise_sets) return null;

        return (
            <View style={styles.workoutSummary}>
                {workout.exercise_sets.map((set, idx) => {
                    const name = EXERCISE_NAMES[set.exercise_type] || set.exercise_type;
                    const details = [];

                    if (set.reps) details.push(`${set.reps} reps`);
                    if (set.kilometers) details.push(`${set.kilometers} km`);
                    if (set.seconds) details.push(`${Math.floor(set.seconds / 60)} min`);

                    return (
                        <Text key={idx} style={styles.exerciseText}>
                            {name}: {details.join(', ')}
                        </Text>
                    );
                })}
            </View>
        );
    };

    const renderPublication = ({ item }: { item: PublicationWithWorkout }) => (
        <View style={styles.publicationCard}>
            {/* User info - clickable */}
            <TouchableOpacity onPress={() => setSelectedUserKey(item.user_public_key)}>
                <Text style={styles.userText}>
                    {item.user_public_key.slice(0, 20)}...
                </Text>
            </TouchableOpacity>

            {/* Date */}
            <Text style={styles.dateText}>
                {new Date(item.created_at!).toLocaleDateString()}
            </Text>

            {/* Text content */}
            {item.text_content && (
                <Text style={styles.contentText}>{item.text_content}</Text>
            )}

            {/* Workout summary */}
            {renderWorkoutSummary(item.workout_session)}

            {/* Images */}
            {item.images && item.images.length > 0 && (
                <View style={styles.imagesContainer}>
                    {item.images.map((img, idx) => (
                        <Image
                            key={idx}
                            source={{ uri: img }}
                            style={styles.image}
                            testID={`publication-image-${idx}`}
                        />
                    ))}
                </View>
            )}

            {/* Running map */}
            {item.map_svg_path && (
                <View style={styles.mapContainer} testID="running-map-svg">
                    <Svg width="100%" height={200} viewBox="0 0 100 100">
                        <Path
                            d={item.map_svg_path}
                            stroke="#007AFF"
                            strokeWidth="2"
                            fill="none"
                        />
                    </Svg>
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading publications...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (publications.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>No publications yet</Text>
                <Text style={styles.emptySubtext}>
                    Share your workouts to see them here!
                </Text>
            </View>
        );
    }

    return (
        <>
            <FlatList
                data={publications}
                renderItem={renderPublication}
                keyExtractor={(item) => item.id!.toString()}
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContainer}
                nestedScrollEnabled={true}
                scrollEnabled={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadPublications(true)}
                    />
                }
                testID="publications-list"
            />
            <UserProfileModal
                visible={selectedUserKey !== null}
                onClose={() => setSelectedUserKey(null)}
                user={selectedUserKey ? {
                    ed25519_public_key: selectedUserKey,
                    nickname: null
                } : null}
                currentUserKey={currentUserKey}
            />
        </>
    );
};

const styles = StyleSheet.create({
    listContainer: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    errorText: {
        fontSize: 16,
        color: '#ff4444',
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    publicationCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 12,
        color: '#999',
        marginBottom: 12,
    },
    contentText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
        lineHeight: 22,
    },
    workoutSummary: {
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    exerciseText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    image: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    mapContainer: {
        height: 200,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        overflow: 'hidden',
    },
});
