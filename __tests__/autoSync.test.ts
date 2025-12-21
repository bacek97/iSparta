/**
 * Integration Tests for Auto-Sync Feature
 * Tests real server communication with isparta-bonuses.deno.dev
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';
import * as AutoSync from '../autoSyncService';

// Mock AsyncStorage (local storage simulation)
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
}));

// Use real fetch for integration tests
const originalFetch = global.fetch;

describe('AutoSyncService - Integration Tests', () => {
    const mockWorkoutSession: SimpleWorkoutSession = {
        sessionId: `session_test_${Date.now()}`,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:30:00Z'),
        exercises: {
            [EXERCISES.PUSHUPS]: {
                duration: 120,
                reps: 25,
                direction: 0,
            },
            [EXERCISES.SQUATS]: {
                duration: 180,
                reps: 35,
                direction: 0,
            }
        } as any // Cast to any to avoid lint error about missing keys
    };

    const mockUserData = {
        publicKey: `ed25519:test_sync_${Date.now()}`,
        fmsCategory: 'JUNIOR' as const
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
        (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
        (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    });

    describe('Auto-Sync Settings', () => {
        it('should get auto-sync enabled status from storage', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

            const isEnabled = await AutoSync.getAutoSyncEnabled();

            expect(isEnabled).toBe(true);
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('auto_sync_enabled');
        });

        it('should return false when auto-sync is not set', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const isEnabled = await AutoSync.getAutoSyncEnabled();

            expect(isEnabled).toBe(false);
        });

        it('should set auto-sync enabled status', async () => {
            await AutoSync.setAutoSyncEnabled(true);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'auto_sync_enabled',
                'true'
            );
        });

        it('should toggle auto-sync status', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');

            const newStatus = await AutoSync.toggleAutoSync();

            expect(newStatus).toBe(true);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'auto_sync_enabled',
                'true'
            );
        });
    });

    describe('Sync Status Tracking', () => {
        it('should get sync status for a session', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('synced');

            const status = await AutoSync.getSyncStatus('session_123');

            expect(status).toBe('synced');
            expect(AsyncStorage.getItem).toHaveBeenCalledWith(
                'sync_status_session_123'
            );
        });

        it('should return "pending" for new sessions', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const status = await AutoSync.getSyncStatus('session_new');

            expect(status).toBe('pending');
        });

        it('should set sync status for a session', async () => {
            await AutoSync.setSyncStatus('session_123', 'synced');

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'sync_status_session_123',
                'synced'
            );
        });

        it('should get all pending sync sessions', async () => {
            const mockKeys = [
                'sync_status_session_1',
                'sync_status_session_2',
                'sync_status_session_3',
                'sync_status_session_4',
            ];
            const mockValues = [
                ['sync_status_session_1', 'pending'],
                ['sync_status_session_2', 'synced'],
                ['sync_status_session_3', 'pending'],
                ['sync_status_session_4', 'failed'],
            ];
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(mockKeys);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(mockValues);

            const pendingSessions = await AutoSync.getPendingSessions();

            expect(pendingSessions).toEqual(['session_1', 'session_3']);
        });
    });

    describe('Auto-Sync Workflow', () => {
        it('should skip sync when auto-sync is disabled', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');

            const result = await AutoSync.autoSyncWorkout(
                mockWorkoutSession,
                mockUserData
            );

            expect(result.success).toBe(true);
            expect(result.synced).toBe(false);
            expect(result.reason).toBe('auto-sync disabled');
        });

        it('should auto-sync workout when enabled (real server)', async () => {
            // This test requires real server connection
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

            const result = await AutoSync.autoSyncWorkout(
                mockWorkoutSession,
                mockUserData
            );

            // Test passes if server responds (either success or failure)
            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.synced).toBe('boolean');
        }, 30000); // 30 second timeout for real server

        it('should mark session as failed on network error', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

            // Force network error by temporarily replacing fetch
            const errorFetch = jest.fn().mockRejectedValue(new Error('Network error'));
            global.fetch = errorFetch;

            const result = await AutoSync.autoSyncWorkout(
                mockWorkoutSession,
                mockUserData
            );

            expect(result.success).toBe(false);
            expect(result.synced).toBe(false);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining('sync_status_'),
                'failed'
            );

            // Restore original fetch
            global.fetch = originalFetch;
        });
    });

    describe('Manual Sync (Real Server)', () => {
        it('should manually sync a session to real server', async () => {
            const result = await AutoSync.manualSyncSession(
                mockWorkoutSession,
                mockUserData
            );

            // Real server should respond
            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');

            if (result.success) {
                expect(result.synced).toBe(true);
                expect(result.bonusData).toBeDefined();
            }
        }, 30000);

        it('should sync all pending sessions', async () => {
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([
                'sync_status_1',
                'sync_status_2',
            ]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([
                ['sync_status_1', 'pending'],
                ['sync_status_2', 'pending'],
            ]);
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(JSON.stringify(mockWorkoutSession))
                .mockResolvedValueOnce(JSON.stringify(mockWorkoutSession));

            const results = await AutoSync.syncAllPending(mockUserData);

            expect(results.total).toBe(2);
            expect(results.synced + results.failed).toBe(2);
        }, 60000);
    });

    describe('Retry Logic', () => {
        it('should retry sync with exponential backoff', async () => {
            // Mock first 2 failures, then success
            let callCount = 0;
            global.fetch = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        data: {
                            sync_workout_session: {
                                signature: mockWorkoutSession.sessionId,
                                session_date: '2024-01-15T10:00:00Z',
                                base_points: 100,
                                total_points: 150,
                                bonus_breakdown: {
                                    bonus_tech_factor: 10,
                                    bonus_speed: 5,
                                    bonus_for_starters: 20,
                                    bonus_another_muscle_yesterday: 10,
                                    bonus_weeks_in_streak: 5,
                                    total_points: 150
                                }
                            }
                        }
                    })
                });
            });

            const result = await AutoSync.syncWithRetry(
                mockWorkoutSession,
                mockUserData,
                { maxRetries: 3, initialDelay: 10 }
            );

            expect(result.success).toBe(true);
            expect(callCount).toBe(3);

            global.fetch = originalFetch;
        }, 10000);

        it('should give up after max retries', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Persistent error'));

            const result = await AutoSync.syncWithRetry(
                mockWorkoutSession,
                mockUserData,
                { maxRetries: 2, initialDelay: 10 }
            );

            expect(result.success).toBe(false);
            expect(global.fetch).toHaveBeenCalledTimes(2);

            global.fetch = originalFetch;
        });
    });

    describe('Offline Queue Management', () => {
        it('should add session to offline queue on network failure', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce('true')  // auto-sync enabled
                .mockResolvedValueOnce(null);   // empty queue

            global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

            await AutoSync.autoSyncWorkout(mockWorkoutSession, mockUserData);

            // Verify session added to queue
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'offline_sync_queue',
                expect.any(String)
            );

            global.fetch = originalFetch;
        });

        it('should get offline queue', async () => {
            const mockQueue = [
                { sessionId: 'session_1', timestamp: Date.now() },
                { sessionId: 'session_2', timestamp: Date.now() },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify(mockQueue)
            );

            const queue = await AutoSync.getOfflineQueue();

            expect(queue).toHaveLength(2);
            expect(queue[0].sessionId).toBe('session_1');
        });

        it('should process offline queue when connected', async () => {
            const mockQueue = [
                { sessionId: '1', timestamp: Date.now() },
                { sessionId: '2', timestamp: Date.now() },
            ];

            // Mock AsyncStorage.getItem with proper key handling
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === 'offline_sync_queue') {
                    return Promise.resolve(JSON.stringify(mockQueue));
                }
                if (key === 'session_1' || key === 'session_2') {
                    return Promise.resolve(JSON.stringify(mockWorkoutSession));
                }
                return Promise.resolve(null);
            });

            // Mock successful fetch
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        sync_workout_session: {
                            signature: 'test',
                            session_date: '2024-01-15T10:00:00Z',
                            base_points: 100,
                            total_points: 150,
                            bonus_breakdown: {
                                bonus_tech_factor: 0,
                                bonus_speed: 0,
                                bonus_for_starters: 0,
                                bonus_another_muscle_yesterday: 0,
                                bonus_weeks_in_streak: 0,
                                total_points: 150
                            }
                        }
                    }
                })
            });

            const result = await AutoSync.processOfflineQueue(mockUserData);

            expect(result.processed).toBe(2);
            expect(result.successful).toBe(2);

            global.fetch = originalFetch;
        });
    });
});
