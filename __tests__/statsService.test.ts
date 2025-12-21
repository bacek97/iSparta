/**
 * Stats Service Tests (TDD - RED Phase)
 * These tests will FAIL until we create statsService.ts
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('Stats Service (TDD)', () => {
    const testUser = `ed25519:stats_test_${Date.now()}`;
    let testSessionId: string;

    beforeAll(async () => {
        // Create test user
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `mutation { insert_users_one(object: {ed25519_public_key: "${testUser}", fms_category: "JUNIOR"}) { ed25519_public_key } }`
            })
        });

        // Create test workout session
        const sessionResponse = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `
                    mutation {
                        insert_workout_sessions_one(object: {
                            signature: "test_session_${Date.now()}",
                            user_public_key: "${testUser}",
                            session_date: "${new Date().toISOString()}",
                            base_points: 10,
                            total_points: 15
                        }) {
                            signature
                        }
                    }
                `
            })
        });

        const data = await sessionResponse.json();
        testSessionId = data.data.insert_workout_sessions_one.signature;
    });

    describe('getUserStats', () => {
        it('should fetch user workout statistics', async () => {
            const { getUserStats } = require('../statsService');

            const stats = await getUserStats(testUser);

            expect(stats).toBeDefined();
            expect(stats.workout_count).toBeGreaterThan(0);
            expect(stats.total_points).toBeGreaterThan(0);
        });

        it('should calculate total points', async () => {
            const { getUserStats } = require('../statsService');

            const stats = await getUserStats(testUser);

            expect(stats.total_points).toBeDefined();
            expect(typeof stats.total_points).toBe('number');
        });

        it('should return workout count', async () => {
            const { getUserStats } = require('../statsService');

            const stats = await getUserStats(testUser);

            expect(stats.workout_count).toBeDefined();
            expect(stats.workout_count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getWorkoutHistory', () => {
        it('should return recent workouts', async () => {
            const { getWorkoutHistory } = require('../statsService');

            const history = await getWorkoutHistory(testUser, 10);

            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBeGreaterThan(0);
        });

        it('should include exercise breakdown', async () => {
            const { getWorkoutHistory } = require('../statsService');

            const history = await getWorkoutHistory(testUser, 10);
            const workout = history[0];

            expect(workout.signature).toBeDefined();
            expect(workout.total_points).toBeDefined();
            expect(workout.session_date).toBeDefined();
        });

        it('should support pagination', async () => {
            const { getWorkoutHistory } = require('../statsService');

            const history = await getWorkoutHistory(testUser, 5);

            expect(history.length).toBeLessThanOrEqual(5);
        });
    });

    describe('subscribeToGroupWorkouts', () => {
        it('should receive real-time updates', async () => {
            const { subscribeToGroupWorkouts } = require('../statsService');

            const updates: any[] = [];
            const unsubscribe = subscribeToGroupWorkouts(testUser, (workout) => {
                updates.push(workout);
            });

            // Wait a bit for subscription to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
        }, 10000);

        it('should filter by group membership', async () => {
            const { subscribeToGroupWorkouts } = require('../statsService');

            let receivedWorkout = false;
            const unsubscribe = subscribeToGroupWorkouts(testUser, (workout) => {
                receivedWorkout = true;
                // Should not receive own workouts
                expect(workout.user_public_key).not.toBe(testUser);
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
            unsubscribe();
        }, 10000);

        it('should exclude own workouts', async () => {
            const { subscribeToGroupWorkouts } = require('../statsService');

            const ownWorkouts: any[] = [];
            const unsubscribe = subscribeToGroupWorkouts(testUser, (workout) => {
                if (workout.user_public_key === testUser) {
                    ownWorkouts.push(workout);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(ownWorkouts.length).toBe(0);
            unsubscribe();
        }, 10000);
    });

    afterAll(async () => {
        // Cleanup
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `mutation { delete_workout_sessions_by_pk(signature: "${testSessionId}") { signature } }`
            })
        });

        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `mutation { delete_users_by_pk(ed25519_public_key: "${testUser}") { ed25519_public_key } }`
            })
        });
    });
});
