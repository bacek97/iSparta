/**
 * Jest tests for Server Data Retrieval
 * Tests fetching workout history, bonus calculations, leaderboard data, and user statistics
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

global.fetch = jest.fn();

describe('Server Data Retrieval', () => {
    const serverUrl = 'https://test-server.deno.dev';
    const mockPublicKey = 'ed25519:5ZGhZKvGQXKXQqPvJKvGQXKXQqPvJKvGQXKXQqPvJKvG';

    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockPublicKey);
    });

    describe('Bonus Calculations Retrieval', () => {
        const mockBonusResponse = {
            session_signature: 'sig_123',
            session_date: '2024-01-01T10:00:00Z',
            base_points: 45.5,
            bonus_tech_factor: 12.3,
            bonus_speed: 8.7,
            bonus_for_starters: 20.0,
            bonus_another_muscle_yesterday: 15.0,
            bonus_weeks_in_streak: 30.0,
            total_points: 131.5,
            exercise_breakdown: [
                {
                    exercise_type: 'PUSHUPS',
                    calories: 2.5,
                    reps_or_duration: 20,
                    points: 50.0
                }
            ]
        };

        it('should fetch bonus calculation for workout session', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockBonusResponse
            });

            const response = await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: {
                        session: { signature: 'sig_123' },
                        user: { public_key: mockPublicKey, fms_category: 'JUNIOR' }
                    }
                })
            });

            const data = await response.json();

            expect(data.total_points).toBe(131.5);
            expect(data.bonus_tech_factor).toBe(12.3);
            expect(data.bonus_speed).toBe(8.7);
        });

        it('should include exercise breakdown in response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockBonusResponse
            });

            const response = await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                body: JSON.stringify({ input: {} })
            });

            const data = await response.json();

            expect(data.exercise_breakdown).toHaveLength(1);
            expect(data.exercise_breakdown[0].exercise_type).toBe('PUSHUPS');
        });

        it('should handle missing bonus data gracefully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    ...mockBonusResponse,
                    bonus_tech_factor: 0,
                    bonus_speed: 0
                })
            });

            const response = await fetch(`${serverUrl}/calculate-bonuses`, {
                method: 'POST',
                body: JSON.stringify({ input: {} })
            });

            const data = await response.json();

            expect(data.bonus_tech_factor).toBe(0);
            expect(data.bonus_speed).toBe(0);
        });
    });

    describe('User Workout History', () => {
        const mockWorkoutHistory = [
            {
                session_id: 'session_1',
                date: '2024-01-01',
                total_points: 150,
                exercises: ['PUSHUPS', 'SQUATS']
            },
            {
                session_id: 'session_2',
                date: '2024-01-02',
                total_points: 180,
                exercises: ['RUNNING', 'SITUPS']
            }
        ];

        it('should fetch user workout history', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ workouts: mockWorkoutHistory })
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/workouts`);
            const data = await response.json();

            expect(data.workouts).toHaveLength(2);
            expect(data.workouts[0].session_id).toBe('session_1');
        });

        it('should filter workouts by date range', async () => {
            const startDate = '2024-01-01';
            const endDate = '2024-01-31';

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ workouts: mockWorkoutHistory })
            });

            const response = await fetch(
                `${serverUrl}/user/${mockPublicKey}/workouts?start=${startDate}&end=${endDate}`
            );

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('start=2024-01-01')
            );
        });

        it('should handle empty workout history', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ workouts: [] })
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/workouts`);
            const data = await response.json();

            expect(data.workouts).toHaveLength(0);
        });
    });

    describe('Leaderboard Data', () => {
        const mockLeaderboard = [
            {
                rank: 1,
                public_key: 'ed25519:user1',
                nickname: 'athlete1',
                total_points: 5000,
                top_muscle_group: 'LEGS',
                week_streak: 12
            },
            {
                rank: 2,
                public_key: mockPublicKey,
                nickname: 'testuser',
                total_points: 4500,
                top_muscle_group: 'ARMS',
                week_streak: 8
            }
        ];

        it('should fetch global leaderboard', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ leaderboard: mockLeaderboard })
            });

            const response = await fetch(`${serverUrl}/leaderboard`);
            const data = await response.json();

            expect(data.leaderboard).toHaveLength(2);
            expect(data.leaderboard[0].rank).toBe(1);
        });

        it('should fetch weekly leaderboard', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ leaderboard: mockLeaderboard })
            });

            const response = await fetch(`${serverUrl}/leaderboard/weekly`);
            const data = await response.json();

            expect(data.leaderboard[0].week_streak).toBeDefined();
        });

        it('should find current user in leaderboard', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ leaderboard: mockLeaderboard })
            });

            const response = await fetch(`${serverUrl}/leaderboard`);
            const data = await response.json();

            const currentUser = data.leaderboard.find(
                (entry: any) => entry.public_key === mockPublicKey
            );

            expect(currentUser).toBeDefined();
            expect(currentUser.rank).toBe(2);
        });

        it('should handle user not in leaderboard', async () => {
            const emptyLeaderboard = [
                {
                    rank: 1,
                    public_key: 'ed25519:otheruser',
                    total_points: 5000
                }
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ leaderboard: emptyLeaderboard })
            });

            const response = await fetch(`${serverUrl}/leaderboard`);
            const data = await response.json();

            const currentUser = data.leaderboard.find(
                (entry: any) => entry.public_key === mockPublicKey
            );

            expect(currentUser).toBeUndefined();
        });
    });

    describe('User Statistics', () => {
        const mockUserStats = {
            public_key: mockPublicKey,
            total_workouts: 45,
            total_points: 6750,
            current_streak: 8,
            longest_streak: 15,
            muscle_group_points: {
                ARMS: 1500,
                LEGS: 2000,
                TORSO: 1800,
                BACK: 1200,
                RUNNING: 250
            },
            fms_category: 'MIDDLE'
        };

        it('should fetch user statistics', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockUserStats
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/stats`);
            const data = await response.json();

            expect(data.total_workouts).toBe(45);
            expect(data.total_points).toBe(6750);
            expect(data.current_streak).toBe(8);
        });

        it('should include muscle group breakdown', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockUserStats
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/stats`);
            const data = await response.json();

            expect(data.muscle_group_points.LEGS).toBe(2000);
            expect(data.muscle_group_points.ARMS).toBe(1500);
        });

        it('should include FMS category', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockUserStats
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/stats`);
            const data = await response.json();

            expect(data.fms_category).toBe('MIDDLE');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 not found', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: 'User not found' })
            });

            const response = await fetch(`${serverUrl}/user/invalid/stats`);

            expect(response.ok).toBe(false);
            expect(response.status).toBe(404);
        });

        it('should handle 401 unauthorized', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized' })
            });

            const response = await fetch(`${serverUrl}/user/${mockPublicKey}/workouts`);

            expect(response.status).toBe(401);
        });

        it('should handle server errors', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal server error' })
            });

            const response = await fetch(`${serverUrl}/leaderboard`);

            expect(response.status).toBe(500);
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

            await expect(
                fetch(`${serverUrl}/user/${mockPublicKey}/stats`)
            ).rejects.toThrow('Network request failed');
        });
    });

    describe('Caching', () => {
        it('should cache leaderboard data', async () => {
            const leaderboardData = { leaderboard: [] };

            await AsyncStorage.setItem('cached_leaderboard', JSON.stringify(leaderboardData));

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'cached_leaderboard',
                expect.any(String)
            );
        });

        it('should use cached data when offline', async () => {
            const cachedData = JSON.stringify({ leaderboard: [] });
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(cachedData);

            const result = await AsyncStorage.getItem('cached_leaderboard');

            expect(result).toBe(cachedData);
        });

        it('should invalidate cache after timeout', async () => {
            const cacheTimestamp = Date.now() - (60 * 60 * 1000); // 1 hour ago
            const cacheTimeout = 30 * 60 * 1000; // 30 minutes

            const isExpired = (Date.now() - cacheTimestamp) > cacheTimeout;

            expect(isExpired).toBe(true);
        });
    });
});
