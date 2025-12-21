/**
 * TDD Tests for Session Sync - Date Serialization Issue
 * 
 * Problem: When session is loaded from AsyncStorage, startTime is a string (from JSON.parse),
 * not a Date object. This causes `session.startTime.toISOString is not a function` error.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AutoSync from '../autoSyncService';
import { sendWorkoutToServer, convertToServerFormat, normalizeToISOString } from '../serverSyncService';
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

// Mock fetch
const originalFetch = global.fetch;

// Helper to create Hasura Action mock response
function createHasuraActionResponse(sessionId: string, totalPoints: number = 120) {
    return {
        ok: true,
        json: async () => ({
            data: {
                sync_workout_session: {
                    signature: sessionId,
                    session_date: '2024-01-15T10:00:00.000Z',
                    base_points: 100,
                    total_points: totalPoints,
                    bonus_breakdown: {
                        bonus_tech_factor: 0,
                        bonus_speed: 0,
                        bonus_for_starters: 20,
                        bonus_another_muscle_yesterday: 0,
                        bonus_weeks_in_streak: 0,
                        total_points: totalPoints
                    }
                }
            }
        })
    };
}

describe('Session Date Serialization - TDD', () => {
    const mockUserData = {
        publicKey: 'ed25519:test_user_123',
        fmsCategory: 'JUNIOR' as const
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = originalFetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    describe('Session loaded from AsyncStorage', () => {
        it('should handle session with string dates (from JSON.parse)', () => {
            // This is what happens when loading from AsyncStorage:
            // JSON.stringify converts Date to ISO string
            // JSON.parse keeps it as string

            const originalSession: SimpleWorkoutSession = {
                sessionId: 'test_123',
                startTime: new Date('2024-01-15T10:00:00Z'),
                endTime: new Date('2024-01-15T10:30:00Z'),
                exercises: {
                    [EXERCISES.PUSHUPS]: {
                        duration: 120,
                        reps: 25,
                        direction: 0,
                    }
                } as any
            };

            // Simulate AsyncStorage serialization/deserialization
            const serialized = JSON.stringify(originalSession);
            const deserialized = JSON.parse(serialized);

            // After JSON.parse, startTime is a STRING, not Date
            expect(typeof deserialized.startTime).toBe('string');
            expect(deserialized.startTime).toBe('2024-01-15T10:00:00.000Z');
        });

        it('convertToServerFormat should handle string dates', () => {
            // Session as it would come from AsyncStorage (with string dates)
            const sessionFromStorage = {
                sessionId: 'test_456',
                startTime: '2024-01-15T10:00:00.000Z', // STRING, not Date
                endTime: '2024-01-15T10:30:00.000Z',
                exercises: {}
            } as unknown as SimpleWorkoutSession;

            // This should NOT throw an error
            expect(() => {
                convertToServerFormat(sessionFromStorage, 'ed25519:test');
            }).not.toThrow();
        });

        it('syncAllPendingAndFailed should handle sessions with string dates', async () => {
            const sessionId = 'session_with_string_dates';

            // Mock getPendingSessions
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([]);

            // Mock getFailedSessions  
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([`sync_status_${sessionId}`]);
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([[`sync_status_${sessionId}`, 'failed']]);

            // Mock getItem - return session with STRING dates (as stored in AsyncStorage)
            const sessionWithStringDates = {
                sessionId: sessionId,
                startTime: '2024-01-15T10:00:00.000Z', // STRING from JSON.parse
                endTime: '2024-01-15T10:30:00.000Z',
                exercises: {
                    PUSHUPS: { duration: 60, reps: 10 }
                }
            };

            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === `session_${sessionId}`) {
                    return Promise.resolve(JSON.stringify(sessionWithStringDates));
                }
                return Promise.resolve(null);
            });

            // Mock Hasura Action response (new format)
            global.fetch = jest.fn().mockResolvedValue(createHasuraActionResponse(sessionId, 120));

            // This should NOT throw "toISOString is not a function"
            const result = await AutoSync.syncAllPendingAndFailed(mockUserData);

            expect(result.total).toBe(1);
            expect(result.synced).toBe(1);
            expect(result.failed).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('manualSyncSession should handle sessions with string dates', async () => {
            const sessionWithStringDates = {
                sessionId: 'manual_sync_test',
                startTime: '2024-01-15T10:00:00.000Z',
                endTime: '2024-01-15T10:30:00.000Z',
                exercises: {}
            } as unknown as SimpleWorkoutSession;

            // Mock Hasura Action response (new format)
            global.fetch = jest.fn().mockResolvedValue(createHasuraActionResponse('manual_sync_test', 0));

            // This should NOT throw
            const result = await AutoSync.manualSyncSession(sessionWithStringDates, mockUserData);

            expect(result.success).toBe(true);
        });
    });

    describe('Date normalization helper', () => {
        it('should convert string to ISO string', () => {
            const dateString = '2024-01-15T10:00:00.000Z';
            const result = normalizeToISOString(dateString);
            expect(result).toBe('2024-01-15T10:00:00.000Z');
        });

        it('should convert Date object to ISO string', () => {
            const dateObj = new Date('2024-01-15T10:00:00.000Z');
            const result = normalizeToISOString(dateObj);
            expect(result).toBe('2024-01-15T10:00:00.000Z');
        });

        it('should return current date for null/undefined', () => {
            // Now returns current date instead of empty string
            const resultUndefined = normalizeToISOString(undefined);
            const resultNull = normalizeToISOString(null);

            // Should be a valid ISO date string
            expect(resultUndefined).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(resultNull).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
});
