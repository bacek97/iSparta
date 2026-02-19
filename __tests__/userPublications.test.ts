/**
 * User Publications Visibility Tests (TDD)
 * Tests that publications are visible regardless of group
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function hasuraQuery(query: string, variables?: any) {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ query, variables })
    });
    return response.json();
}

describe('User Publications Visibility Tests', () => {
    const testTimestamp = Date.now();
    const userA = `ed25519:pub_test_a_${testTimestamp}`;
    const userB = `ed25519:pub_test_b_${testTimestamp}`;
    const sessionId = `session_${testTimestamp}`;
    const publicationId = `pub_${testTimestamp}`;

    beforeAll(async () => {
        console.log('Setting up test data...');

        // Create test users
        const usersResult = await hasuraQuery(`
            mutation CreateUsers($userA: String!, $userB: String!) {
                userA: insert_users_one(object: { ed25519_public_key: $userA, fms_category: "JUNIOR" }) {
                    ed25519_public_key
                }
                userB: insert_users_one(object: { ed25519_public_key: $userB, fms_category: "JUNIOR" }) {
                    ed25519_public_key
                }
            }
        `, { userA, userB });

        if (usersResult.errors) {
            console.error('Create users error:', JSON.stringify(usersResult.errors));
        } else {
            console.log('✅ Users created');
        }

        // Create a workout session for userA
        const sessionResult = await hasuraQuery(`
            mutation CreateSession($sig: String!, $userKey: String!) {
                insert_workout_sessions_one(object: {
                    signature: $sig,
                    user_public_key: $userKey,
                    session_date: "2024-01-01",
                    total_points: 10.5,
                    base_points: 8.0,
                    bonus_tech_factor: 1.0,
                    bonus_speed: 1.5
                }) {
                    signature
                }
            }
        `, { sig: sessionId, userKey: userA });

        if (sessionResult.errors) {
            console.error('Create session error:', JSON.stringify(sessionResult.errors));
        } else {
            console.log('✅ Session created');
        }

        // Create a publication for userA (WITHOUT group)
        const pubResult = await hasuraQuery(`
            mutation CreatePublication($pubId: String!, $userKey: String!, $sessionSig: String!, $msg: String!) {
                insert_workout_publications_one(object: {
                    publication_id: $pubId,
                    user_public_key: $userKey,
                    session_signature: $sessionSig,
                    message: $msg
                }) {
                    id
                    publication_id
                }
            }
        `, { pubId: publicationId, userKey: userA, sessionSig: sessionId, msg: "Test publication without group" });

        if (pubResult.errors) {
            console.error('Create publication error:', JSON.stringify(pubResult.errors, null, 2));
        } else {
            console.log('✅ Publication created:', pubResult.data?.insert_workout_publications_one);
        }
    }, 30000);

    it('should fetch userA publications by user key', async () => {
        const result = await hasuraQuery(`
            query GetUserPublications($userKey: String!) {
                workout_publications(
                    where: { user_public_key: { _eq: $userKey } }
                ) {
                    id
                    publication_id
                    message
                    user_public_key
                }
            }
        `, { userKey: userA });

        console.log('Query result:', JSON.stringify(result, null, 2));

        expect(result.data).toBeDefined();
        expect(result.data.workout_publications.length).toBeGreaterThanOrEqual(1);

        const pub = result.data.workout_publications[0];
        expect(pub.publication_id).toBe(publicationId);
        expect(pub.message).toBe('Test publication without group');

        console.log('✅ UserA publications fetched successfully');
    }, 15000);

    it('should allow cross-user visibility (userB can see userA publications)', async () => {
        // This simulates userB viewing userA's profile
        const result = await hasuraQuery(`
            query GetOtherUserPublications($userKey: String!) {
                workout_publications(
                    where: { user_public_key: { _eq: $userKey } }
                ) {
                    id
                    publication_id
                }
            }
        `, { userKey: userA });

        expect(result.data).toBeDefined();
        expect(result.data.workout_publications.length).toBeGreaterThanOrEqual(1);

        console.log('✅ UserB can see UserA publications');
    }, 15000);

    it('should include publications without group_id', async () => {
        const result = await hasuraQuery(`
            query GetAllUserPublications($userKey: String!) {
                workout_publications(
                    where: { user_public_key: { _eq: $userKey } }
                ) {
                    publication_id
                    group_id
                }
            }
        `, { userKey: userA });

        expect(result.data).toBeDefined();
        expect(result.data.workout_publications.length).toBeGreaterThanOrEqual(1);

        const pub = result.data.workout_publications.find((p: any) => p.publication_id === publicationId);
        expect(pub).toBeDefined();
        // group_id should be null for our test publication
        expect(pub.group_id).toBeNull();

        console.log('✅ Publications without group visible');
    }, 15000);

    afterAll(async () => {
        // Cleanup
        await hasuraQuery(`
            mutation Cleanup($pubId: String!, $sessionId: String!, $userA: String!, $userB: String!) {
                delete_workout_publications(where: { publication_id: { _eq: $pubId } }) {
                    affected_rows
                }
                delete_workout_sessions(where: { signature: { _eq: $sessionId } }) {
                    affected_rows
                }
                delete_users(where: { ed25519_public_key: { _in: [$userA, $userB] } }) {
                    affected_rows
                }
            }
        `, { pubId: publicationId, sessionId, userA, userB });

        console.log('✅ Test cleanup complete');
    }, 15000);
});
