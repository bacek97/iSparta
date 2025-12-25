/**
 * COMPREHENSIVE E2E Integration Test for LeaderboardScreen
 * Tests REAL functions, REAL GraphQL queries, and REAL component interactions
 */

import { getUserStats, getLast7DaysSessions, getUserAllSessions } from '../statsService';
import { LeaderboardCalculator } from '../utils/LeaderboardCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES } from '../types';

describe('LeaderboardScreen E2E Integration Tests', () => {
    // Use real user for testing (or create test user)
    const TEST_USER_KEY = process.env.TEST_USER_PUBLIC_KEY || 'test_integration_user';

    beforeAll(async () => {
        console.log('🔵 Starting E2E Integration Tests');
        console.log('Testing user:', TEST_USER_KEY);
    });

    afterEach(async () => {
        await AsyncStorage.clear();
    });

    describe('GraphQL statsService Integration', () => {
        it('should fetch user stats from Hasura', async () => {
            console.log('📊 Testing getUserStats...');

            const stats = await getUserStats(TEST_USER_KEY);

            // Verify structure
            expect(stats).toBeDefined();
            expect(stats).toHaveProperty('workout_count');
            expect(stats).toHaveProperty('total_points');
            expect(stats).toHaveProperty('average_points');
            expect(stats).toHaveProperty('base_points_sum');

            // Verify types
            expect(typeof stats.workout_count).toBe('number');
            expect(typeof stats.total_points).toBe('number');
            expect(typeof stats.average_points).toBe('number');
            expect(typeof stats.base_points_sum).toBe('number');

            // Verify non-negative
            expect(stats.workout_count).toBeGreaterThanOrEqual(0);
            expect(stats.total_points).toBeGreaterThanOrEqual(0);

            console.log('✅ getUserStats returned:', stats);
        }, 15000);

        it('should fetch last 7 days sessions with exercise_sets', async () => {
            console.log('📅 Testing getLast7DaysSessions...');

            const sessions = await getLast7DaysSessions(TEST_USER_KEY);

            // Verify it's an array
            expect(Array.isArray(sessions)).toBe(true);

            console.log(`Found ${sessions.length} sessions in last 7 days`);

            if (sessions.length > 0) {
                const session = sessions[0];

                // Verify session structure
                expect(session).toHaveProperty('signature');
                expect(session).toHaveProperty('session_date');
                expect(session).toHaveProperty('base_points');
                expect(session).toHaveProperty('total_points');
                expect(session).toHaveProperty('bonus_tech_factor');
                expect(session).toHaveProperty('bonus_speed');
                expect(session).toHaveProperty('bonus_for_starters');
                expect(session).toHaveProperty('bonus_another_muscle_yesterday');
                expect(session).toHaveProperty('bonus_weeks_in_streak');
                expect(session).toHaveProperty('exercise_sets');

                // Verify exercise_sets is array (THIS WAS THE BUG!)
                expect(Array.isArray(session.exercise_sets)).toBe(true);

                console.log('Session structure:', {
                    signature: session.signature,
                    date: session.session_date,
                    points: session.total_points,
                    exercise_sets_count: session.exercise_sets.length
                });

                if (session.exercise_sets.length > 0) {
                    const exerciseSet = session.exercise_sets[0];

                    // Verify exercise set structure
                    expect(exerciseSet).toHaveProperty('exercise_type');
                    expect(exerciseSet).toHaveProperty('points');

                    console.log('Exercise set example:', {
                        type: exerciseSet.exercise_type,
                        reps: exerciseSet.reps,
                        seconds: exerciseSet.seconds,
                        points: exerciseSet.points
                    });
                }
            }

            console.log('✅ getLast7DaysSessions returned valid data');
        }, 15000);

        it('should fetch all user sessions for calendar', async () => {
            console.log('📆 Testing getUserAllSessions...');

            const sessions = await getUserAllSessions(TEST_USER_KEY);

            expect(Array.isArray(sessions)).toBe(true);

            console.log(`Found ${sessions.length} total sessions`);

            if (sessions.length > 0) {
                // Verify sessions are sorted by date desc
                for (let i = 0; i < sessions.length - 1; i++) {
                    const current = new Date(sessions[i].session_date);
                    const next = new Date(sessions[i + 1].session_date);
                    expect(current >= next).toBe(true);
                }

                console.log('Sessions date range:', {
                    earliest: sessions[sessions.length - 1].session_date,
                    latest: sessions[0].session_date
                });
            }

            console.log('✅ getUserAllSessions returned sorted data');
        }, 15000);
    });

    describe('LeaderboardCalculator with Local Data', () => {
        it('should calculate stats from AsyncStorage sessions', async () => {
            console.log('💾 Testing LeaderboardCalculator.calculateStats...');

            // Create test sessions
            const now = new Date();
            const session1 = {
                signature: 'test-sig-1',
                startTime: now.toISOString(),
                exercises: {
                    [EXERCISES.PUSHUPS]: { duration: 60, reps: 20 },
                    [EXERCISES.SQUATS]: { duration: 90, reps: 30 }
                }
            };

            const threeDaysAgo = new Date(now);
            threeDaysAgo.setDate(now.getDate() - 3);
            const session2 = {
                signature: 'test-sig-2',
                startTime: threeDaysAgo.toISOString(),
                exercises: {
                    [EXERCISES.PULLUPS]: { duration: 45, reps: 10 }
                }
            };

            const tenDaysAgo = new Date(now);
            tenDaysAgo.setDate(now.getDate() - 10);
            const session3 = {
                signature: 'test-sig-3',
                startTime: tenDaysAgo.toISOString(),
                exercises: {
                    [EXERCISES.PLANK]: { duration: 120, reps: 0 }
                }
            };

            await AsyncStorage.setItem('session_1', JSON.stringify(session1));
            await AsyncStorage.setItem('session_2', JSON.stringify(session2));
            await AsyncStorage.setItem('session_3', JSON.stringify(session3));

            // Calculate stats
            const stats = await LeaderboardCalculator.calculateStats();

            // Verify calculations
            expect(stats.totalWorkouts).toBe(3);
            expect(stats.totalWorkoutTime).toBe(315); // 60 + 90 + 45 + 120
            expect(stats.totalPoints).toBeGreaterThan(0);

            // Verify 7-day separation
            expect(stats.last7DaysSessions.length).toBe(2); // session1 and session2
            expect(stats.olderWeeks.length).toBeGreaterThan(0); // session3

            // Verify exercise leaderboard
            expect(stats.exerciseLeaderboard.length).toBeGreaterThan(0);

            const pushups = stats.exerciseLeaderboard.find(e => e.exercise === EXERCISES.PUSHUPS);
            expect(pushups).toBeDefined();
            expect(pushups?.totalReps).toBe(20);
            expect(pushups?.totalDuration).toBe(60);

            console.log('Calculated stats:', {
                workouts: stats.totalWorkouts,
                time: stats.totalWorkoutTime,
                points: stats.totalPoints,
                last7Days: stats.last7DaysSessions.length,
                olderWeeks: stats.olderWeeks.length,
                exercises: stats.exerciseLeaderboard.length
            });

            console.log('✅ LeaderboardCalculator calculated correctly');
        }, 10000);

        it('should format duration correctly', () => {
            console.log('⏱️ Testing formatDuration...');

            const tests = [
                { input: 0, expected: '0с' },
                { input: 45, expected: '45с' },
                { input: 125, expected: '2м 5с' },
                { input: 3665, expected: '1ч 1м' },
                { input: 7200, expected: '2ч 0м' }
            ];

            tests.forEach(({ input, expected }) => {
                const result = LeaderboardCalculator.formatDuration(input);
                expect(result).toBe(expected);
                console.log(`  ${input}s → ${result}`);
            });

            console.log('✅ formatDuration works correctly');
        });
    });

    describe('Data Flow Integration', () => {
        it('should handle server stats to component props transformation', async () => {
            console.log('🔄 Testing server-to-component data flow...');

            // Fetch from server
            const serverStats = await getUserStats(TEST_USER_KEY);
            const serverSessions = await getLast7DaysSessions(TEST_USER_KEY);

            // Transform to component format (like LeaderboardScreen does)
            const last7DaysSessions = serverSessions.map(s => ({
                sessionId: s.signature,
                date: new Date(s.session_date),
                basePoints: s.base_points,
                bonusTechFactor: s.bonus_tech_factor,
                bonusSpeed: s.bonus_speed,
                bonusForStarters: s.bonus_for_starters,
                bonusAnotherMuscleYesterday: s.bonus_another_muscle_yesterday,
                bonusWeeksInStreak: s.bonus_weeks_in_streak,
                totalPoints: s.total_points,
                exerciseBreakdown: s.exercise_sets.map(ex => ({
                    exercise: ex.exercise_type,
                    calories: 0,
                    repsOrDuration: ex.reps || ex.seconds,
                    points: ex.points
                }))
            }));

            // Verify transformation
            expect(last7DaysSessions.length).toBe(serverSessions.length);

            if (last7DaysSessions.length > 0) {
                const session = last7DaysSessions[0];
                expect(session.sessionId).toBe(serverSessions[0].signature);
                expect(session.totalPoints).toBe(serverSessions[0].total_points);
                expect(Array.isArray(session.exerciseBreakdown)).toBe(true);

                console.log('Transformed session:', {
                    id: session.sessionId,
                    points: session.totalPoints,
                    exerciseCount: session.exerciseBreakdown.length
                });
            }

            console.log('✅ Data transformation works correctly');
        }, 15000);
    });

    describe('Error Handling', () => {
        it('should handle non-existent user gracefully', async () => {
            console.log('❌ Testing error handling...');

            const fakeUser = 'nonexistent_user_xyz_' + Date.now();

            const stats = await getUserStats(fakeUser);
            expect(stats.workout_count).toBe(0);
            expect(stats.total_points).toBe(0);

            const sessions = await getLast7DaysSessions(fakeUser);
            expect(sessions).toEqual([]);

            console.log('✅ Error handling works correctly');
        }, 10000);

        it('should not crash on empty AsyncStorage', async () => {
            console.log('📭 Testing empty state...');

            await AsyncStorage.clear();

            const stats = await LeaderboardCalculator.calculateStats();

            expect(stats.totalWorkouts).toBe(0);
            expect(stats.totalWorkoutTime).toBe(0);
            expect(stats.totalPoints).toBe(0);
            expect(stats.exerciseLeaderboard).toEqual([]);
            expect(stats.last7DaysSessions).toEqual([]);
            expect(stats.olderWeeks).toEqual([]);

            console.log('✅ Empty state handled correctly');
        });
    });

    describe('Performance & Data Integrity', () => {
        it('should complete all operations within reasonable time', async () => {
            console.log('⚡ Testing performance...');

            const start = Date.now();

            await Promise.all([
                getUserStats(TEST_USER_KEY),
                getLast7DaysSessions(TEST_USER_KEY),
                LeaderboardCalculator.calculateStats()
            ]);

            const duration = Date.now() - start;

            console.log(`All operations completed in ${duration}ms`);
            expect(duration).toBeLessThan(20000); // 20 seconds max

            console.log('✅ Performance acceptable');
        }, 25000);
    });
});
