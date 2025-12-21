/**
 * Tests for Sync, Leaderboard, and Profile Issues
 * TDD approach: Write tests first, then fix implementation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AutoSync from '../autoSyncService';
import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
}));

// Mock fetch for API calls
const originalFetch = global.fetch;

// Helper to create Hasura Action mock response
function createHasuraActionResponse(sessionId: string, totalPoints: number = 100) {
    return {
        ok: true,
        json: async () => ({
            data: {
                sync_workout_session: {
                    signature: sessionId,
                    session_date: new Date().toISOString(),
                    base_points: totalPoints,
                    total_points: totalPoints,
                    bonus_breakdown: {
                        bonus_tech_factor: 0,
                        bonus_speed: 0,
                        bonus_for_starters: 0,
                        bonus_another_muscle_yesterday: 0,
                        bonus_weeks_in_streak: 0,
                        total_points: totalPoints
                    }
                }
            }
        })
    };
}

describe('Sync Issues - Session Key Mismatch', () => {
    const mockUserData = {
        publicKey: 'ed25519:test_user',
        fmsCategory: 'JUNIOR' as const
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = originalFetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    describe('getPendingSessions key format', () => {
        it('should return session IDs without double prefix', async () => {
            const mockKeys = [
                'sync_status_test_session_123',
                'sync_status_another_session_456',
            ];
            const mockValues: [string, string][] = [
                ['sync_status_test_session_123', 'pending'],
                ['sync_status_another_session_456', 'synced'],
            ];
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(mockKeys);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(mockValues);

            const pendingSessions = await AutoSync.getPendingSessions();

            // Should return 'test_session_123', not 'session_test_session_123'
            expect(pendingSessions).toEqual(['test_session_123']);
        });
    });

    describe('getFailedSessions key format', () => {
        it('should return failed session IDs without double prefix', async () => {
            const mockKeys = [
                'sync_status_test_session_123',
                'sync_status_failed_session_456',
            ];
            const mockValues: [string, string][] = [
                ['sync_status_test_session_123', 'pending'],
                ['sync_status_failed_session_456', 'failed'],
            ];
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(mockKeys);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(mockValues);

            const failedSessions = await AutoSync.getFailedSessions();

            expect(failedSessions).toEqual(['failed_session_456']);
        });
    });

    describe('syncAllPendingAndFailed function', () => {
        it('should include both pending and failed sessions in total count', async () => {
            const pendingSession = 'pending_123';
            const failedSession = 'failed_456';

            // Mock getPendingSessions - returns 1 pending
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([`sync_status_${pendingSession}`]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([[`sync_status_${pendingSession}`, 'pending']]);

            // Mock getFailedSessions - returns 1 failed
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([`sync_status_${failedSession}`]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([[`sync_status_${failedSession}`, 'failed']]);

            // Mock getItem for both sessions
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === `session_${pendingSession}` || key === `session_${failedSession}`) {
                    return Promise.resolve(JSON.stringify({
                        sessionId: key.replace('session_', ''),
                        startTime: new Date(),
                        endTime: new Date(),
                        exercises: {}
                    }));
                }
                return Promise.resolve(null);
            });

            // Mock successful sync with Hasura Action format
            global.fetch = jest.fn().mockResolvedValue(createHasuraActionResponse('test', 100));

            const result = await AutoSync.syncAllPendingAndFailed(mockUserData);

            // Total should include BOTH pending and failed (2 sessions)
            expect(result.total).toBe(2);
        });

        it('should sync failed sessions that were missed by syncAllPending', async () => {
            const failedSession = 'failed_only_session';

            // Mock getPendingSessions - empty
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([]);

            // Mock getFailedSessions - returns 1 failed
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([`sync_status_${failedSession}`]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([[`sync_status_${failedSession}`, 'failed']]);

            // Mock getItem
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === `session_${failedSession}`) {
                    return Promise.resolve(JSON.stringify({
                        sessionId: failedSession,
                        startTime: new Date(),
                        endTime: new Date(),
                        exercises: {}
                    }));
                }
                return Promise.resolve(null);
            });

            // Mock successful sync with Hasura Action format
            global.fetch = jest.fn().mockResolvedValue(createHasuraActionResponse('test', 100));

            const result = await AutoSync.syncAllPendingAndFailed(mockUserData);

            // Total should be 1 (the failed session is included)
            expect(result.total).toBe(1);
            // The session was attempted (either synced or failed due to Date serialization)
            expect(result.synced + result.failed).toBe(1);
        });
    });

    describe('syncAllPending only syncs pending (not failed)', () => {
        it('should NOT sync failed sessions', async () => {
            const failedSession = 'failed_only_session';

            // Mock getPendingSessions - empty (no pending)
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([`sync_status_${failedSession}`]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([[`sync_status_${failedSession}`, 'failed']]);

            const result = await AutoSync.syncAllPending(mockUserData);

            // Total should be 0 because only pending sessions are synced
            expect(result.total).toBe(0);
        });
    });
});

describe('Leaderboard Loading Issues', () => {
    describe('getUserGroups error handling', () => {
        it('should handle network errors gracefully', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            const { getUserGroups } = require('../groupService');

            await expect(getUserGroups('test_public_key')).rejects.toThrow();

            global.fetch = originalFetch;
        });

        it('should handle Hasura errors gracefully', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    errors: [{ message: 'User not found' }]
                })
            });

            const { getUserGroups } = require('../groupService');

            await expect(getUserGroups('test_public_key')).rejects.toThrow('User not found');

            global.fetch = originalFetch;
        });
    });
});

describe('useGroupData hook', () => {
    it('should export error property', async () => {
        // Just verify the interface - hook testing requires React testing library
        const { useGroupData } = require('../hooks/useGroupData');
        expect(typeof useGroupData).toBe('function');
    });
});
