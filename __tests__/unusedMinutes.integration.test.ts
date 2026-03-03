import { getEarnedMinutesForDay } from '../../deno_isparta/index'; // Though we can't directly import from Deno backend in this test, we will hit the Hasura action

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

const TEST_USER_KEY = `ed25519:test_unused_${Date.now()}`;
const TEST_REGULAR_SESSION = `test_reg_${Date.now()}`;
const TEST_VIRTUAL_SESSION = `test_virt_${Date.now()}`;

describe('Integration: Leaderboard Unused Minutes Logic', () => {
    // 1. Create test user
    beforeAll(async () => {
        const mutation = `
            mutation CreateTestUser($publicKey: String!) {
                insert_users_one(
                    object: {
                        ed25519_public_key: $publicKey,
                        fms_category: "JUNIOR",
                        nickname: "UnusedTester"
                    }
                ) {
                    ed25519_public_key
                }
            }
        `;

        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({ query: mutation, variables: { publicKey: TEST_USER_KEY } })
        });
    });

    // 2. Cleanup after tests
    afterAll(async () => {
        // Delete test sessions first to respect foreign keys
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `mutation { delete_workout_sessions(where: { user_public_key: { _eq: "${TEST_USER_KEY}" } }) { affected_rows } }`
            })
        });

        // Delete test user
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `mutation { delete_users_by_pk(ed25519_public_key: "${TEST_USER_KEY}") { ed25519_public_key } }`
            })
        });
    });

    it('should assign 0 total_points to a regular workout session', async () => {
        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    total_points
                }
            }
        `;

        const variables = {
            session: {
                signature: TEST_REGULAR_SESSION,
                user_public_key: TEST_USER_KEY,
                session_date: new Date().toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `hash_squats_${Date.now()}`,
                        exercise_type: 'SQUATS',
                        exercise_category: 'REPS',
                        set_date: new Date().toISOString(),
                        seconds: 60,
                        reps: 20 // 20 squats = 10 earned minutes later 
                    },
                    {
                        hash_shazam: `hash_pushups_${Date.now()}`,
                        exercise_type: 'PUSHUPS',
                        exercise_category: 'REPS',
                        set_date: new Date().toISOString(),
                        seconds: 60,
                        reps: 10 // 10 pushups = 20 earned minutes later
                    }
                ]
            },
            user: {
                public_key: TEST_USER_KEY,
                fms_category: "JUNIOR"
            }
        };

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET // using admin purely to test the exact action directly if needed, though action itself doesn't require admin
            },
            body: JSON.stringify({ query: mutation, variables })
        });

        const result = await response.json();
        expect(result.errors).toBeUndefined();
        expect(result.data.sync_workout_session).toBeDefined();

        // Regular session should yield exactly 0 points for the leaderboard!
        expect(result.data.sync_workout_session.total_points).toBe(0);
    });

    it('should assign correct total_points to an UNUSED_MINUTES session based on validation', async () => {
        // Now that the user has 30 earned minutes from the previous test for today, 
        // let's try to sync 25 unused minutes. Server should allow 25 points.
        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    total_points
                }
            }
        `;

        const variables = {
            session: {
                signature: TEST_VIRTUAL_SESSION,
                user_public_key: TEST_USER_KEY,
                session_date: new Date().toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `hash_virtual_${Date.now()}`,
                        exercise_type: 'UNUSED_MINUTES',
                        exercise_category: 'SECONDS',
                        set_date: new Date().toISOString(),
                        seconds: 25 * 60, // Requesting 25 unused minutes
                    }
                ]
            },
            user: {
                public_key: TEST_USER_KEY,
                fms_category: "JUNIOR"
            }
        };

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({ query: mutation, variables })
        });

        const result = await response.json();
        expect(result.errors).toBeUndefined();
        expect(result.data.sync_workout_session).toBeDefined();

        // Because 25 <= 30 (earned), it should give exactly 25 points
        expect(result.data.sync_workout_session.total_points).toBe(25);
    });

    it('should cap total_points if requested unused_minutes exceeds earned minutes', async () => {
        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    total_points
                }
            }
        `;

        const variables = {
            session: {
                signature: `test_virt_cap_${Date.now()}`,
                user_public_key: TEST_USER_KEY,
                session_date: new Date().toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `hash_virtual_cap_${Date.now()}`,
                        exercise_type: 'UNUSED_MINUTES',
                        exercise_category: 'SECONDS',
                        set_date: new Date().toISOString(),
                        seconds: 100 * 60, // Requesting 100 unused minutes (more than actual 30)
                    }
                ]
            },
            user: {
                public_key: TEST_USER_KEY,
                fms_category: "JUNIOR"
            }
        };

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({ query: mutation, variables })
        });

        const result = await response.json();

        // Because 100 > 30 (earned), the server should cap it at the 30 earned minutes.
        expect(result.data.sync_workout_session.total_points).toBe(30);
    });
});
