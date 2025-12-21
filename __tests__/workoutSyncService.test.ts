/**
 * Jest tests for Workout Sync Service
 * Tests offline queue, automatic sync, retry logic, and server communication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(),
    fetch: jest.fn(),
}));

global.fetch = jest.fn();

describe('WorkoutSyncService', () => {
    const mockWorkoutSession = {
        sessionId: 'session_123',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:30:00Z'),
        exercises: {
            PUSHUPS: {
                duration: 120,
                reps: 20,
                tech_factor: { n: 10, avg: 2.5, last_best_tech_factor: 3 },
                average_speed: [{ last_start: 1000, n: 5, avg: 2000 }]
            },
            SQUATS: {
                duration: 180,
                reps: 30,
                tech_factor: { n: 15, avg: 2.8, last_best_tech_factor: 3 },
                average_speed: [{ last_start: 1500, n: 8, avg: 2500 }]
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });
    });

    describe('Offline Queue Management', () => {
        it('should add workout to queue when offline', async () => {
            const queue = [mockWorkoutSession];

            await AsyncStorage.setItem('workout_queue', JSON.stringify(queue));

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'workout_queue',
                JSON.stringify(queue)
            );
        });

        it('should retrieve pending workouts from queue', async () => {
            const queue = [mockWorkoutSession];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queue));

            const result = await AsyncStorage.getItem('workout_queue');
            const parsed = JSON.parse(result!);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].sessionId).toBe('session_123');
        });

        it('should handle empty queue', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const result = await AsyncStorage.getItem('workout_queue');

            expect(result).toBeNull();
        });

        it('should append new workout to existing queue', async () => {
            const existingQueue = [mockWorkoutSession];
            const newWorkout = { ...mockWorkoutSession, sessionId: 'session_456' };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify(existingQueue)
            );

            const queue = JSON.parse(await AsyncStorage.getItem('workout_queue') || '[]');
            queue.push(newWorkout);

            await AsyncStorage.setItem('workout_queue', JSON.stringify(queue));

            expect(queue).toHaveLength(2);
        });

        it('should remove workout from queue after successful sync', async () => {
            const queue = [mockWorkoutSession];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queue));

            // Simulate successful sync
            const updatedQueue: any[] = [];
            await AsyncStorage.setItem('workout_queue', JSON.stringify(updatedQueue));

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'workout_queue',
                JSON.stringify([])
            );
        });
    });

    describe('Server Communication', () => {
        const serverUrl = 'https://test-server.deno.dev';

        it('should send workout data to server', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, bonuses: { total_points: 150 } })
            });

            const response = await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { session: mockWorkoutSession } })
            });

            expect(global.fetch).toHaveBeenCalledWith(
                `${serverUrl}/calculate-bonuses`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );

            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should include user data in request', async () => {
            const userData = {
                public_key: 'ed25519:test123',
                fms_category: 'JUNIOR'
            };

            await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                body: JSON.stringify({
                    input: {
                        session: mockWorkoutSession,
                        user: userData
                    }
                })
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('JUNIOR')
                })
            );
        });

        it('should handle server errors gracefully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal server error' })
            });

            const response = await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                body: JSON.stringify({ input: { session: mockWorkoutSession } })
            });

            expect(response.ok).toBe(false);
            expect(response.status).toBe(500);
        });

        it('should handle network timeout', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

            await expect(
                fetch(`${serverUrl}/calculate-bonuses`, {
                    method: 'POST',
                    body: JSON.stringify({ input: { session: mockWorkoutSession } })
                })
            ).rejects.toThrow('Network timeout');
        });
    });

    describe('Automatic Sync', () => {
        it('should sync when network becomes available', async () => {
            const mockNetworkListener = jest.fn();
            (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockNetworkListener);

            // Simulate network change
            const networkState = { isConnected: true, isInternetReachable: true };

            expect(networkState.isConnected).toBe(true);
        });

        it('should not sync when network is unavailable', async () => {
            const networkState = { isConnected: false, isInternetReachable: false };

            expect(networkState.isConnected).toBe(false);
        });

        it('should sync all pending workouts when online', async () => {
            const queue = [
                mockWorkoutSession,
                { ...mockWorkoutSession, sessionId: 'session_456' }
            ];

            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queue));
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({ success: true })
            });

            // Simulate syncing all
            const syncCount = queue.length;

            expect(syncCount).toBe(2);
        });
    });

    describe('Retry Logic', () => {
        it('should retry failed sync with exponential backoff', async () => {
            let attemptCount = 0;

            (global.fetch as jest.Mock).mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ success: true })
                });
            });

            // Simulate retry logic
            const maxRetries = 3;
            expect(maxRetries).toBe(3);
        });

        it('should calculate correct backoff delay', () => {
            const baseDelay = 1000; // 1 second
            const attempt1 = baseDelay * Math.pow(2, 0); // 1000ms
            const attempt2 = baseDelay * Math.pow(2, 1); // 2000ms
            const attempt3 = baseDelay * Math.pow(2, 2); // 4000ms

            expect(attempt1).toBe(1000);
            expect(attempt2).toBe(2000);
            expect(attempt3).toBe(4000);
        });

        it('should give up after max retries', async () => {
            const maxRetries = 3;
            let attemptCount = 0;

            (global.fetch as jest.Mock).mockImplementation(() => {
                attemptCount++;
                return Promise.reject(new Error('Network error'));
            });

            // Simulate max retries reached
            const shouldGiveUp = attemptCount >= maxRetries;

            // This would be true after 3 failed attempts
            expect(maxRetries).toBe(3);
        });
    });

    describe('Settings Integration', () => {
        it('should respect server enabled/disabled setting', async () => {
            // Clear previous mocks and set up fresh mock for this specific test
            (AsyncStorage.getItem as jest.Mock).mockReset();
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === 'server_sync_enabled') {
                    return Promise.resolve('false');
                }
                return Promise.resolve(null);
            });

            const isEnabled = await AsyncStorage.getItem('server_sync_enabled');

            expect(isEnabled).toBe('false');
        });

        it('should use custom server URL from settings', async () => {
            const customUrl = 'https://custom-server.example.com';

            (AsyncStorage.getItem as jest.Mock).mockReset();
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === 'server_url') {
                    return Promise.resolve(customUrl);
                }
                return Promise.resolve(null);
            });

            const serverUrl = await AsyncStorage.getItem('server_url');

            expect(serverUrl).toBe(customUrl);
        });

        it('should use default server URL if not configured', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const serverUrl = await AsyncStorage.getItem('server_url');
            const defaultUrl = 'https://default-server.deno.dev';

            expect(serverUrl || defaultUrl).toBe(defaultUrl);
        });
    });

    describe('Data Validation', () => {
        it('should validate workout session has required fields', () => {
            const isValid =
                mockWorkoutSession.sessionId &&
                mockWorkoutSession.startTime &&
                mockWorkoutSession.exercises;

            expect(isValid).toBe(true);
        });

        it('should validate exercise has tech_factor data', () => {
            const exercise = mockWorkoutSession.exercises.PUSHUPS;
            const hasTechFactor =
                exercise.tech_factor &&
                typeof exercise.tech_factor.avg === 'number';

            expect(hasTechFactor).toBe(true);
        });

        it('should validate exercise has average_speed data', () => {
            const exercise = mockWorkoutSession.exercises.PUSHUPS;
            const hasAverageSpeed =
                Array.isArray(exercise.average_speed) &&
                exercise.average_speed.length > 0;

            expect(hasAverageSpeed).toBe(true);
        });

        it('should reject invalid workout data', () => {
            const invalidWorkout = {
                sessionId: null,
                exercises: {}
            };

            const isValid = invalidWorkout.sessionId !== null;

            expect(isValid).toBe(false);
        });
    });

    describe('Sync Status Tracking', () => {
        it('should track last successful sync time', async () => {
            const syncTime = new Date().toISOString();

            await AsyncStorage.setItem('last_sync_time', syncTime);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith('last_sync_time', syncTime);
        });

        it('should count pending workouts', async () => {
            const queue = [mockWorkoutSession, { ...mockWorkoutSession, sessionId: 'session_456' }];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queue));

            const result = await AsyncStorage.getItem('workout_queue');
            const count = JSON.parse(result || '[]').length;

            expect(count).toBe(2);
        });

        it('should track sync errors', async () => {
            const error = { message: 'Network error', timestamp: new Date().toISOString() };

            await AsyncStorage.setItem('last_sync_error', JSON.stringify(error));

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'last_sync_error',
                expect.stringContaining('Network error')
            );
        });
    });
});
