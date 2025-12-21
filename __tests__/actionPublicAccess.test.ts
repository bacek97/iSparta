/**
 * TDD Test: Hasura Action should be accessible without admin secret
 * 
 * Problem: App fails with "x-hasura-admin-secret required" when calling sync_workout_session
 * Solution: Configure Hasura Action with public permissions (anonymous role)
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';

describe('TDD: Hasura Action Public Access', () => {
    it('should call sync_workout_session WITHOUT admin secret', async () => {
        // This is what the app does - NO admin secret
        const mutation = `
            mutation SyncWorkout($session: WorkoutSessionInput!, $user: UserInput!) {
                sync_workout_session(session: $session, user: $user) {
                    signature
                    total_points
                }
            }
        `;

        const testSessionId = `public_test_${Date.now()}`;
        const testUserKey = 'ed25519:Ca8zVYnaGch2gGrHxGMYtygammdRqSX1uqdQrrRD47tY'; // Existing user

        const variables = {
            session: {
                signature: testSessionId,
                user_public_key: testUserKey,
                session_date: new Date().toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `hash_${Date.now()}`,
                        exercise_type: 'PUSHUPS',
                        exercise_category: 'REPS',
                        set_date: new Date().toISOString(),
                        seconds: 60,
                        reps: 10,
                    }
                ]
            },
            user: {
                public_key: testUserKey,
                fms_category: 'JUNIOR'
            }
        };

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-role': 'anonymous'
            },
            body: JSON.stringify({ query: mutation, variables })
        });

        const result = await response.json();

        // Test should pass when Hasura Action has public permissions
        if (result.errors) {
            console.log('Error (expected if permissions not set):', result.errors[0].message);
        }

        // THIS IS THE FIX WE NEED:
        // Should NOT have access-denied error
        expect(result.errors?.[0]?.extensions?.code).not.toBe('access-denied');

        // Should have data
        expect(result.data?.sync_workout_session).toBeDefined();
        expect(result.data?.sync_workout_session?.signature).toBe(testSessionId);
    });
});
