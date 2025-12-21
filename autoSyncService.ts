/**
 * Auto-Sync Service
 * Handles automatic synchronization of workout sessions to the server
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleWorkoutSession } from './exerciseTrackingService';
import { sendWorkoutToServer, UserData, BonusResponse } from './serverSyncService';

// Storage keys
const STORAGE_KEYS = {
    AUTO_SYNC_ENABLED: 'auto_sync_enabled',
    SYNC_STATUS_PREFIX: 'sync_status_',
    OFFLINE_QUEUE: 'offline_sync_queue',
};

// Sync status types
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface AutoSyncResult {
    success: boolean;
    synced: boolean;
    reason?: string;
    error?: string;
    bonusData?: BonusResponse;
}

export interface SyncAllResult {
    total: number;
    synced: number;
    failed: number;
    errors: string[];
}

export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
}

export interface OfflineQueueItem {
    sessionId: string;
    timestamp: number;
}

export interface ProcessQueueResult {
    processed: number;
    successful: number;
    failed: number;
}

/**
 * Get auto-sync enabled status
 */
export async function getAutoSyncEnabled(): Promise<boolean> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
        return value === 'true';
    } catch (error) {
        console.error('Error getting auto-sync status:', error);
        return false;
    }
}

/**
 * Set auto-sync enabled status
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(
            STORAGE_KEYS.AUTO_SYNC_ENABLED,
            enabled.toString()
        );
    } catch (error) {
        console.error('Error setting auto-sync status:', error);
        throw error;
    }
}

/**
 * Toggle auto-sync status
 */
export async function toggleAutoSync(): Promise<boolean> {
    const currentStatus = await getAutoSyncEnabled();
    const newStatus = !currentStatus;
    await setAutoSyncEnabled(newStatus);
    return newStatus;
}

/**
 * Get sync status for a session
 */
export async function getSyncStatus(sessionId: string): Promise<SyncStatus> {
    try {
        const key = `${STORAGE_KEYS.SYNC_STATUS_PREFIX}${sessionId}`;
        const value = await AsyncStorage.getItem(key);
        return (value as SyncStatus) || 'pending';
    } catch (error) {
        console.error('Error getting sync status:', error);
        return 'pending';
    }
}

/**
 * Set sync status for a session
 */
export async function setSyncStatus(
    sessionId: string,
    status: SyncStatus
): Promise<void> {
    try {
        const key = `${STORAGE_KEYS.SYNC_STATUS_PREFIX}${sessionId}`;
        await AsyncStorage.setItem(key, status);
    } catch (error) {
        console.error('Error setting sync status:', error);
        throw error;
    }
}

/**
 * Get all pending sync sessions
 */
export async function getPendingSessions(): Promise<string[]> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const syncKeys = allKeys.filter(key =>
            key.startsWith(STORAGE_KEYS.SYNC_STATUS_PREFIX)
        );

        const statusPairs = await AsyncStorage.multiGet(syncKeys);
        const pendingSessions: string[] = [];

        statusPairs.forEach(([key, value]) => {
            if (value === 'pending') {
                const sessionId = key.replace(STORAGE_KEYS.SYNC_STATUS_PREFIX, '');
                pendingSessions.push(sessionId);
            }
        });

        return pendingSessions;
    } catch (error) {
        console.error('Error getting pending sessions:', error);
        return [];
    }
}

/**
 * Get all failed sync sessions
 */
export async function getFailedSessions(): Promise<string[]> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const syncKeys = allKeys.filter(key =>
            key.startsWith(STORAGE_KEYS.SYNC_STATUS_PREFIX)
        );

        const statusPairs = await AsyncStorage.multiGet(syncKeys);
        const failedSessions: string[] = [];

        statusPairs.forEach(([key, value]) => {
            if (value === 'failed') {
                const sessionId = key.replace(STORAGE_KEYS.SYNC_STATUS_PREFIX, '');
                failedSessions.push(sessionId);
            }
        });

        return failedSessions;
    } catch (error) {
        console.error('Error getting failed sessions:', error);
        return [];
    }
}

/**
 * Auto-sync workout session (checks if auto-sync is enabled)
 */
export async function autoSyncWorkout(
    session: SimpleWorkoutSession,
    userData: UserData
): Promise<AutoSyncResult> {
    try {
        // Check if auto-sync is enabled
        const isEnabled = await getAutoSyncEnabled();

        if (!isEnabled) {
            return {
                success: true,
                synced: false,
                reason: 'auto-sync disabled',
            };
        }

        // Attempt to sync
        try {
            const bonusData = await sendWorkoutToServer(session, userData);
            await setSyncStatus(session.sessionId, 'synced');

            return {
                success: true,
                synced: true,
                bonusData,
            };
        } catch (error) {
            // Mark as failed and add to queue
            await setSyncStatus(session.sessionId, 'failed');
            await addToOfflineQueue(session.sessionId);

            return {
                success: false,
                synced: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    } catch (error) {
        console.error('Auto-sync error:', error);
        return {
            success: false,
            synced: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Manually sync a specific session
 */
export async function manualSyncSession(
    session: SimpleWorkoutSession,
    userData: UserData
): Promise<AutoSyncResult> {
    try {
        const bonusData = await sendWorkoutToServer(session, userData);
        await setSyncStatus(session.sessionId, 'synced');
        await removeFromOfflineQueue(session.sessionId);

        return {
            success: true,
            synced: true,
            bonusData,
        };
    } catch (error) {
        console.error('[AutoSync] manualSyncSession error:', error);
        await setSyncStatus(session.sessionId, 'failed');

        return {
            success: false,
            synced: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Sync all pending sessions
 */
export async function syncAllPending(userData: UserData): Promise<SyncAllResult> {
    const pendingSessions = await getPendingSessions();
    const result: SyncAllResult = {
        total: pendingSessions.length,
        synced: 0,
        failed: 0,
        errors: [],
    };

    for (const sessionId of pendingSessions) {
        try {
            // Load session from storage
            const sessionData = await AsyncStorage.getItem(`session_${sessionId}`);
            if (!sessionData) {
                result.failed++;
                result.errors.push(`Session ${sessionId} not found`);
                continue;
            }

            const session: SimpleWorkoutSession = JSON.parse(sessionData);
            const syncResult = await manualSyncSession(session, userData);

            if (syncResult.success) {
                result.synced++;
            } else {
                result.failed++;
                result.errors.push(syncResult.error || 'Unknown error');
            }
        } catch (error) {
            result.failed++;
            result.errors.push(
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }

    return result;
}

/**
 * Sync all pending AND failed sessions
 * This is what the "Sync All" button should call
 */
export async function syncAllPendingAndFailed(userData: UserData): Promise<SyncAllResult> {
    const pendingSessions = await getPendingSessions();
    const failedSessions = await getFailedSessions();

    // Combine and deduplicate
    const allSessions = [...new Set([...pendingSessions, ...failedSessions])];

    const result: SyncAllResult = {
        total: allSessions.length,
        synced: 0,
        failed: 0,
        errors: [],
    };

    for (const sessionId of allSessions) {
        try {
            // Load session from storage
            const sessionData = await AsyncStorage.getItem(`session_${sessionId}`);
            if (!sessionData) {
                result.failed++;
                result.errors.push(`Session ${sessionId} not found`);
                continue;
            }

            const session: SimpleWorkoutSession = JSON.parse(sessionData);
            const syncResult = await manualSyncSession(session, userData);

            if (syncResult.success) {
                result.synced++;
            } else {
                result.failed++;
                result.errors.push(syncResult.error || 'Unknown error');
            }
        } catch (error) {
            result.failed++;
            result.errors.push(
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }

    return result;
}

/**
 * Sync with retry logic and exponential backoff
 */
export async function syncWithRetry(
    session: SimpleWorkoutSession,
    userData: UserData,
    options: RetryOptions = { maxRetries: 3, initialDelay: 1000 }
): Promise<AutoSyncResult> {
    let lastError: Error | null = null;
    let delay = options.initialDelay;

    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
        try {
            const bonusData = await sendWorkoutToServer(session, userData);
            await setSyncStatus(session.sessionId, 'synced');
            await removeFromOfflineQueue(session.sessionId);

            return {
                success: true,
                synced: true,
                bonusData,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');

            // Wait before retry (exponential backoff)
            if (attempt < options.maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }

    // All retries failed
    await setSyncStatus(session.sessionId, 'failed');

    return {
        success: false,
        synced: false,
        error: lastError?.message || 'All retries failed',
    };
}

/**
 * Add session to offline queue
 */
async function addToOfflineQueue(sessionId: string): Promise<void> {
    try {
        const queueData = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        const queue: OfflineQueueItem[] = queueData ? JSON.parse(queueData) : [];

        // Check if already in queue
        if (!queue.find(item => item.sessionId === sessionId)) {
            queue.push({
                sessionId,
                timestamp: Date.now(),
            });
            await AsyncStorage.setItem(
                STORAGE_KEYS.OFFLINE_QUEUE,
                JSON.stringify(queue)
            );
        }
    } catch (error) {
        console.error('Error adding to offline queue:', error);
    }
}

/**
 * Remove session from offline queue
 */
async function removeFromOfflineQueue(sessionId: string): Promise<void> {
    try {
        const queueData = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        if (!queueData) return;

        const queue: OfflineQueueItem[] = JSON.parse(queueData);
        const filteredQueue = queue.filter(item => item.sessionId !== sessionId);

        await AsyncStorage.setItem(
            STORAGE_KEYS.OFFLINE_QUEUE,
            JSON.stringify(filteredQueue)
        );
    } catch (error) {
        console.error('Error removing from offline queue:', error);
    }
}

/**
 * Get offline queue
 */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
        const queueData = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
        console.error('Error getting offline queue:', error);
        return [];
    }
}

/**
 * Process offline queue
 */
export async function processOfflineQueue(
    userData: UserData
): Promise<ProcessQueueResult> {
    const queue = await getOfflineQueue();
    const result: ProcessQueueResult = {
        processed: queue.length,
        successful: 0,
        failed: 0,
    };

    for (const item of queue) {
        try {
            const sessionData = await AsyncStorage.getItem(`session_${item.sessionId}`);
            if (!sessionData) {
                result.failed++;
                continue;
            }

            const session: SimpleWorkoutSession = JSON.parse(sessionData);
            const syncResult = await manualSyncSession(session, userData);

            if (syncResult.success) {
                result.successful++;
            } else {
                result.failed++;
            }
        } catch (error) {
            result.failed++;
        }
    }

    return result;
}
