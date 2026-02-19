/**
 * Publication Creator Component
 * Modal for creating workout publications with text, images, and map
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    ScrollView,
    Modal,
    StyleSheet,
    Alert,
    Switch,
    ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';
import { createPublication } from '../publicationsService';
import { getCurrentUser } from '../authService';

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';

// Helper to get user's group
async function getUserGroup(userKey: string): Promise<{ group_id: string } | null> {
    const query = `
        query GetUserGroup($user: String!) {
            group_members(where: {user_public_key: {_eq: $user}}, limit: 1) {
                group_id
            }
        }
    `;

    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-role': 'anonymous',
        },
        body: JSON.stringify({ query, variables: { user: userKey } }),
    });

    const result = await response.json();

    if (result.errors) {
        console.error('[getUserGroup] GraphQL error:', result.errors);
        return null;
    }

    return result.data?.group_members?.[0] || null;
}

// Helper to check if session exists in database
async function checkSessionInDatabase(sessionSignature: string): Promise<boolean> {
    const query = `
        query CheckSession($sig: String!) {
            workout_sessions(where: {signature: {_eq: $sig}}, limit: 1) {
                signature
            }
        }
    `;

    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-role': 'anonymous',
        },
        body: JSON.stringify({ query, variables: { sig: sessionSignature } }),
    });

    const result = await response.json();
    return result.data?.workout_sessions?.length > 0;
}

// Helper to sync session to server
async function syncSessionToServer(session: SimpleWorkoutSession, user: any): Promise<boolean> {
    try {
        // Import syncWorkoutSession from serverSyncService
        const { syncWorkoutSession } = require('../serverSyncService');

        const result = await syncWorkoutSession(session, {
            publicKey: user.publicKey,
            fmsCategory: user.fmsCategory || 'MIDDLE',
        });

        return result.success;
    } catch (error) {
        console.error('[syncSessionToServer] Error:', error);
        return false;
    }
}

interface Props {
    session: SimpleWorkoutSession;
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const PublicationCreator: React.FC<Props> = ({
    session,
    visible,
    onClose,
    onSuccess,
}) => {
    const [text, setText] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [includeMap, setIncludeMap] = useState(true);
    const [loading, setLoading] = useState(false);

    // Check if session has RUNNING exercise
    const hasRunning = session.exercises[EXERCISES.RUNNING] !== undefined;

    const pickImages = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 5 - images.length,
                includeBase64: true,
                maxWidth: 1024,
                maxHeight: 1024,
                quality: 0.8,
            });

            if (result.assets) {
                const newImages = result.assets
                    .filter(asset => asset.base64)
                    .map(asset => `data:image/jpeg;base64,${asset.base64}`);

                setImages([...images, ...newImages]);
            }
        } catch (error) {
            console.error('[PublicationCreator] Image picker error:', error);
            Alert.alert('Error', 'Failed to pick images');
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handlePublish = async () => {
        if (!text.trim() && images.length === 0) {
            Alert.alert('Error', 'Please add some text or images');
            return;
        }

        setLoading(true);
        try {
            const user = await getCurrentUser();
            if (!user?.publicKey) {
                throw new Error('User not authenticated');
            }

            // Get user's group (required for publication)
            const userGroup = await getUserGroup(user.publicKey);
            if (!userGroup) {
                Alert.alert('Error', 'You must join a group to share workouts');
                setLoading(false);
                return;
            }

            // IMPORTANT: Check if session exists in database, sync if not
            const sessionExists = await checkSessionInDatabase(session.sessionId);
            if (!sessionExists) {
                console.log('[PublicationCreator] Session not in DB, syncing...');
                Alert.alert('Syncing', 'Uploading workout to server...');

                // Sync session to server first
                const syncSuccess = await syncSessionToServer(session, user);
                if (!syncSuccess) {
                    Alert.alert('Error', 'Failed to sync workout. Please check internet connection.');
                    setLoading(false);
                    return;
                }
            }

            // Get SVG path from session if available
            const runningSvg = session.exercises[EXERCISES.RUNNING]?.['svg:path[d]'] || undefined;

            await createPublication(
                {
                    session_signature: session.sessionId,
                    group_id: userGroup.group_id,
                    text_content: text.trim() || undefined,
                    images: images.length > 0 ? images : undefined,
                    include_map: hasRunning && includeMap,
                    map_svg_path: runningSvg,
                },
                user.publicKey
            );

            Alert.alert('Success', 'Workout published! 🎉');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('[PublicationCreator] Publish error:', error);
            Alert.alert('Error', `Failed to publish: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const resetAndClose = () => {
        setText('');
        setImages([]);
        setIncludeMap(true);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={resetAndClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={resetAndClose}>
                        <Text style={styles.cancelButton}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Share Workout</Text>
                    <TouchableOpacity onPress={handlePublish} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#007AFF" />
                        ) : (
                            <Text style={styles.publishButton}>Publish</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {/* Text Input */}
                    <TextInput
                        style={styles.textInput}
                        placeholder="Share your thoughts... 💪"
                        placeholderTextColor="#999"
                        value={text}
                        onChangeText={setText}
                        multiline
                        maxLength={500}
                        textAlignVertical="top"
                    />

                    {/* Map Toggle for RUNNING */}
                    {hasRunning && (
                        <View style={styles.mapToggle}>
                            <Text style={styles.mapToggleText}>Include Running Map</Text>
                            <Switch
                                value={includeMap}
                                onValueChange={setIncludeMap}
                                trackColor={{ false: '#ddd', true: '#007AFF' }}
                            />
                        </View>
                    )}

                    {/* Image Picker */}
                    <TouchableOpacity
                        style={styles.imagePickerButton}
                        onPress={pickImages}
                        disabled={images.length >= 5}
                    >
                        <Text style={styles.imagePickerText}>
                            📷 Add Photos ({images.length}/5)
                        </Text>
                    </TouchableOpacity>

                    {/* Selected Images */}
                    {images.length > 0 && (
                        <ScrollView horizontal style={styles.imagesContainer}>
                            {images.map((img, index) => (
                                <View key={index} style={styles.imageWrapper}>
                                    <Image source={{ uri: img }} style={styles.image} />
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => removeImage(index)}
                                    >
                                        <Text style={styles.removeButtonText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Workout Summary */}
                    <View style={styles.workoutSummary}>
                        <Text style={styles.summaryTitle}>Workout Summary</Text>
                        {Object.entries(session.exercises).map(([exerciseKey, record]) => (
                            <Text key={exerciseKey} style={styles.summaryItem}>
                                • {exerciseKey}: {record.duration}s
                                {record.reps && ` (${record.reps} reps)`}
                                {record.kilometers && ` (${record.kilometers} km)`}
                            </Text>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelButton: {
        color: '#666',
        fontSize: 16,
    },
    publishButton: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    textInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        minHeight: 120,
        marginBottom: 16,
    },
    mapToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    mapToggleText: {
        fontSize: 16,
    },
    imagePickerButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    imagePickerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    imagesContainer: {
        marginBottom: 16,
    },
    imageWrapper: {
        marginRight: 12,
        position: 'relative',
    },
    image: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    removeButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#FF3B30',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    workoutSummary: {
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 12,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    summaryItem: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
});
