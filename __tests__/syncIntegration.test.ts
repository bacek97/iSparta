/**
 * Integration Tests for Sync Service
 * Tests real production server: https://isparta.bacek97.deno.net
 * 
 * These tests verify:
 * 1. Deno server health
 * 2. Hasura Action sync_workout_session
 * 3. Data is actually saved to database
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const DENO_URL = 'https://isparta.bacek97.deno.net';

// Test user key (will be cleaned up)
const TEST_USER_KEY = `ed25519:test_sync_${Date.now()}`;
const TEST_SESSION_ID = `test_session_${Date.now()}`;

describe('Integration: Deno Deploy Server', () => {
    it('should respond to health check', async () => {
        const response = await fetch(`${DENO_URL}/health`);
        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.status).toBe('ok');
        expect(data.time).toBeDefined();
    });

    it('should handle /sync-workout endpoint directly', async () => {
        const session = {
            signature: `direct_test_${Date.now()}`,
            user_public_key: TEST_USER_KEY,
            session_date: new Date().toISOString(),
            exercise_sets: [
                {
                    hash_shazam: `hash_${Date.now()}`,
                    exercise_type: 'PUSHUPS',
                    exercise_category: 'REPS',
                    set_date: new Date().toISOString(),
                    seconds: 60,
                    reps: 20,
                }
            ]
        };

        const response = await fetch(`${DENO_URL}/sync-workout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session,
                user: {
                    public_key: TEST_USER_KEY,
                    fms_category: 'JUNIOR'
                }
            })
        });

        // Might fail due to user not existing, but endpoint should respond
        const data = await response.json();

        if (response.ok) {
            expect(data.signature).toBeDefined();
            expect(data.total_points).toBeDefined();
        } else {
            // Expected error if user doesn't exist
            expect(data.error || data.details).toBeDefined();
        }
    });
});

describe('Integration: Hasura Action sync_workout_session', () => {
    // First create test user
    beforeAll(async () => {
        const mutation = `
            mutation CreateTestUser($publicKey: String!) {
                insert_users_one(
                    object: { ed25519_public_key: $publicKey, fms_category: "JUNIOR" },
                    on_conflict: { constraint: users_pkey, update_columns: [] }
                ) {
                    ed25519_public_key
                }
            }
        `;

        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({ query: mutation, variables: { publicKey: TEST_USER_KEY } })
        });
    });

    // Cleanup after tests
    afterAll(async () => {
        // Delete test session first (due to foreign key)
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({
                query: `mutation { delete_workout_sessions(where: {user_public_key: {_eq: "${TEST_USER_KEY}"}}) { affected_rows } }`
            })
        });

        // Delete test user
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({
                query: `mutation { delete_users_by_pk(ed25519_public_key: "${TEST_USER_KEY}") { ed25519_public_key } }`
            })
        });
    });

    it('should sync workout and save to database via Hasura Action', async () => {
        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    session_date
                    base_points
                    total_points
                    bonus_breakdown {
                        bonus_tech_factor
                        bonus_speed
                        bonus_for_starters
                        bonus_another_muscle_yesterday
                        bonus_weeks_in_streak
                        total_points
                    }
                }
            }
        `;

        const variables = {
            session: {
                signature: TEST_SESSION_ID,
                user_public_key: TEST_USER_KEY,
                session_date: new Date().toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `hash_${Date.now()}_1`,
                        exercise_type: 'PUSHUPS',
                        exercise_category: 'REPS',
                        set_date: new Date().toISOString(),
                        seconds: 60,
                        reps: 20,
                    },
                    {
                        hash_shazam: `hash_${Date.now()}_2`,
                        exercise_type: 'SQUATS',
                        exercise_category: 'REPS',
                        set_date: new Date().toISOString(),
                        seconds: 90,
                        reps: 30,
                    }
                ]
            },
            user: {
                public_key: TEST_USER_KEY,
                fms_category: 'JUNIOR'
            }
        };

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({ query: mutation, variables })
        });

        expect(response.ok).toBe(true);

        const result = await response.json();

        if (result.errors) {
            console.log('Hasura Action error:', result.errors);
        }

        expect(result.errors).toBeUndefined();
        expect(result.data.sync_workout_session).toBeDefined();
        expect(result.data.sync_workout_session.signature).toBe(TEST_SESSION_ID);
        expect(result.data.sync_workout_session.total_points).toBeGreaterThanOrEqual(0);
        expect(result.data.sync_workout_session.bonus_breakdown).toBeDefined();
    });

    it('should verify workout is saved in database', async () => {
        const query = `
            query GetSession($signature: String!) {
                workout_sessions_by_pk(signature: $signature) {
                    signature
                    user_public_key
                    total_points
                    base_points
                    exercise_sets {
                        exercise_type
                        reps
                        points
                    }
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({ query, variables: { signature: TEST_SESSION_ID } })
        });

        const result = await response.json();

        expect(result.data.workout_sessions_by_pk).not.toBeNull();
        expect(result.data.workout_sessions_by_pk.signature).toBe(TEST_SESSION_ID);
        expect(result.data.workout_sessions_by_pk.user_public_key).toBe(TEST_USER_KEY);
        expect(result.data.workout_sessions_by_pk.exercise_sets.length).toBe(2);
    });
});

describe('Integration: Leaderboard Stats Query', () => {
    it('should query workout_sessions_aggregate', async () => {
        const query = `
            query GetStats($userKey: String!) {
                workout_sessions_aggregate(where: {user_public_key: {_eq: $userKey}}) {
                    aggregate {
                        count
                        sum {
                            total_points
                        }
                    }
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh'
            },
            body: JSON.stringify({ query, variables: { userKey: TEST_USER_KEY } })
        });

        const result = await response.json();

        expect(result.data.workout_sessions_aggregate).toBeDefined();
        expect(result.data.workout_sessions_aggregate.aggregate).toBeDefined();
        expect(typeof result.data.workout_sessions_aggregate.aggregate.count).toBe('number');
    });
});
