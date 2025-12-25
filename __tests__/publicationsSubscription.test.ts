/**
 * TDD: Publications Subscription Integration Tests
 * 
 * Tests real-time GraphQL subscription for group publications.
 * Creates test users, group, workout session, publication and verifies
 * subscription delivery via WebSocket.
 * 
 * NO MOCKS - Real Hasura integration tests
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('Publications Subscription TDD', () => {
    // Unique IDs for this test run
    const timestamp = Date.now();
    const user1 = `ed25519:pub_sub_test_user1_${timestamp}`;
    const user2 = `ed25519:pub_sub_test_user2_${timestamp}`;
    const groupId = `group_pub_sub_${timestamp}`;
    const sessionSignature = `sig_pub_sub_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

    // Helper: Execute GraphQL query/mutation
    async function hasuraQuery(query: string, variables?: any) {
        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({ query, variables })
        });
        const data = await response.json();
        if (data.errors) {
            console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
            throw new Error(data.errors[0].message);
        }
        return data.data;
    }

    // Helper: Create user
    async function createUser(publicKey: string) {
        await hasuraQuery(`
            mutation InsertUser($publicKey: String!) {
                insert_users_one(
                    object: { ed25519_public_key: $publicKey, fms_category: "JUNIOR" }
                    on_conflict: { constraint: users_pkey, update_columns: [] }
                ) {
                    ed25519_public_key
                }
            }
        `, { publicKey });
    }

    // Helper: Create group with member
    async function createGroupWithMembers(gId: string, creatorKey: string, memberKeys: string[]) {
        // Create group with creator as admin
        await hasuraQuery(`
            mutation CreateGroup($groupId: String!, $createdBy: String!) {
                insert_user_groups_one(object: {
                    group_id: $groupId,
                    group_name: "Test Publication Group",
                    created_by: $createdBy,
                    members: {
                        data: [{ user_public_key: $createdBy, is_admin: true }]
                    }
                }) {
                    group_id
                }
            }
        `, { groupId: gId, createdBy: creatorKey });

        // Add other members
        if (memberKeys.length > 0) {
            await hasuraQuery(`
                mutation AddMembers($members: [group_members_insert_input!]!) {
                    insert_group_members(objects: $members) {
                        affected_rows
                    }
                }
            `, {
                members: memberKeys.map(key => ({
                    group_id: gId,
                    user_public_key: key,
                    is_admin: false
                }))
            });
        }
    }

    // Helper: Create workout session
    async function createWorkoutSession(signature: string, userKey: string) {
        await hasuraQuery(`
            mutation CreateSession($signature: String!, $userKey: String!) {
                insert_workout_sessions_one(object: {
                    signature: $signature,
                    user_public_key: $userKey,
                    session_date: "${new Date().toISOString()}",
                    base_points: 100,
                    total_points: 120,
                    bonus_tech_factor: 10,
                    bonus_speed: 5,
                    bonus_for_starters: 5,
                    bonus_another_muscle_yesterday: 0,
                    bonus_weeks_in_streak: 0
                }) {
                    signature
                }
            }
        `, { signature, userKey });
    }

    // Helper: Create publication
    async function createPublication(sessionSig: string, userKey: string, gId: string) {
        const result = await hasuraQuery(`
            mutation CreatePublication($sessionSig: String!, $userKey: String!, $groupId: String!) {
                insert_workout_publications_one(object: {
                    session_signature: $sessionSig,
                    user_public_key: $userKey,
                    group_id: $groupId,
                    text_content: "Test publication from TDD"
                }) {
                    id
                    session_signature
                    user_public_key
                    text_content
                    created_at
                }
            }
        `, { sessionSig: sessionSig, userKey, groupId: gId });
        return result.insert_workout_publications_one;
    }

    // ==================== SETUP ====================
    beforeAll(async () => {
        console.log('📝 Setting up test data...');
        console.log('   User1:', user1);
        console.log('   User2:', user2);
        console.log('   Group:', groupId);

        // Create test users
        await createUser(user1);
        await createUser(user2);
        console.log('✅ Users created');

        // Create group with both users
        await createGroupWithMembers(groupId, user1, [user2]);
        console.log('✅ Group created with members');

        // Create workout session for user1
        await createWorkoutSession(sessionSignature, user1);
        console.log('✅ Workout session created');
    }, 30000);

    // ==================== TESTS ====================

    describe('Subscription receives group publications', () => {
        it('should receive real-time publication when group member posts', async () => {
            const wsUrl = HASURA_URL.replace('https://', 'wss://').replace('/v1/graphql', '/v1/graphql');
            const ws = new WebSocket(wsUrl, 'graphql-ws');

            const subscription = `
                subscription OnGroupPublications($groupId: String!) {
                    workout_publications(
                        where: { group_id: { _eq: $groupId } }
                        order_by: { created_at: desc }
                        limit: 10
                    ) {
                        id
                        session_signature
                        user_public_key
                        group_id
                        text_content
                        created_at
                        workout_session {
                            signature
                            total_points
                            session_date
                        }
                    }
                }
            `;

            let receivedPublication: any = null;
            let subscriptionReady = false;

            const result = await new Promise<any>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Timeout waiting for subscription data'));
                }, 15000);

                ws.onopen = () => {
                    console.log('🔌 WebSocket connected');
                    ws.send(JSON.stringify({
                        type: 'connection_init',
                        payload: {
                            headers: {
                                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                            }
                        }
                    }));
                };

                ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data);
                    console.log('📩 Message type:', message.type);

                    if (message.type === 'connection_ack') {
                        console.log('✅ Connection acknowledged, starting subscription...');
                        ws.send(JSON.stringify({
                            id: 'pub-subscription',
                            type: 'start',
                            payload: {
                                query: subscription,
                                variables: { groupId }
                            }
                        }));
                    } else if (message.type === 'data') {
                        const publications = message.payload.data.workout_publications;
                        console.log('📬 Received publications:', publications.length);

                        if (!subscriptionReady) {
                            // First data message - subscription is ready
                            subscriptionReady = true;
                            console.log('📡 Subscription ready, creating publication...');

                            // Now create the publication (triggers subscription update)
                            try {
                                await createPublication(sessionSignature, user1, groupId);
                                console.log('✅ Publication created, waiting for subscription update...');
                            } catch (err) {
                                clearTimeout(timeout);
                                ws.close();
                                reject(err);
                            }
                        } else {
                            // Subsequent data message - should contain our publication
                            const createdPub = publications.find(
                                (p: any) => p.session_signature === sessionSignature
                            );

                            if (createdPub) {
                                receivedPublication = createdPub;
                                console.log('🎉 Received publication via subscription!');
                                console.log('   ID:', createdPub.id);
                                console.log('   User:', createdPub.user_public_key);
                                console.log('   Text:', createdPub.text_content);

                                clearTimeout(timeout);
                                ws.close();
                                resolve(createdPub);
                            }
                        }
                    } else if (message.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(JSON.stringify(message.payload)));
                    }
                };

                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(error);
                };
            });

            // Assertions
            expect(result).toBeDefined();
            expect(result.session_signature).toBe(sessionSignature);
            expect(result.user_public_key).toBe(user1);
            expect(result.group_id).toBe(groupId);
            expect(result.text_content).toBe('Test publication from TDD');
            expect(result.workout_session).toBeDefined();
            expect(result.workout_session.total_points).toBe(120);

            console.log('✅ All subscription assertions passed!');
        }, 20000);

        it('should extract notification data from publication', async () => {
            // Fetch the created publication
            const result = await hasuraQuery(`
                query GetPublication($sessionSig: String!) {
                    workout_publications(where: { session_signature: { _eq: $sessionSig } }) {
                        id
                        user_public_key
                        text_content
                        workout_session {
                            total_points
                            exercise_sets {
                                exercise_type
                                reps
                                seconds
                            }
                        }
                    }
                }
            `, { sessionSig: sessionSignature });

            const publication = result.workout_publications[0];
            expect(publication).toBeDefined();

            // Extract notification content (what will be shown in push notification)
            const userDisplay = publication.user_public_key.slice(0, 12) + '...';
            const points = publication.workout_session?.total_points || 0;
            const exerciseCount = publication.workout_session?.exercise_sets?.length || 0;

            const notificationTitle = '🏋️ Новая публикация';
            const notificationBody = `${userDisplay} поделился тренировкой (${exerciseCount} упр., ${points} очков)`;

            console.log('📱 Notification preview:');
            console.log('   Title:', notificationTitle);
            console.log('   Body:', notificationBody);

            expect(userDisplay).toContain('ed25519:pub_');
            expect(points).toBe(120);
        }, 10000);
    });

    describe('Subscription isolation', () => {
        it('should not receive publications from other groups', async () => {
            const otherGroupId = `group_other_${timestamp}`;
            const user3 = `ed25519:pub_sub_other_${timestamp}`;
            const otherSessionSig = `sig_other_${timestamp}`;

            // Create user3 and their own group
            await createUser(user3);
            await createGroupWithMembers(otherGroupId, user3, []);
            await createWorkoutSession(otherSessionSig, user3);

            const wsUrl = HASURA_URL.replace('https://', 'wss://');
            const ws = new WebSocket(wsUrl, 'graphql-ws');

            // Subscribe to user2's view (original group only)
            const subscription = `
                subscription OnGroupPublications($groupId: String!) {
                    workout_publications(
                        where: { group_id: { _eq: $groupId } }
                        order_by: { created_at: desc }
                    ) {
                        id
                        group_id
                        session_signature
                    }
                }
            `;

            const receivedFromOtherGroup = await new Promise<boolean>((resolve) => {
                let subscriptionStarted = false;

                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        type: 'connection_init',
                        payload: { headers: { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET } }
                    }));
                };

                ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data);

                    if (message.type === 'connection_ack') {
                        ws.send(JSON.stringify({
                            id: 'isolation-test',
                            type: 'start',
                            payload: {
                                query: subscription,
                                variables: { groupId } // Subscribe to original group
                            }
                        }));
                    } else if (message.type === 'data') {
                        if (!subscriptionStarted) {
                            subscriptionStarted = true;
                            // Create publication in OTHER group
                            await createPublication(otherSessionSig, user3, otherGroupId);

                            // Wait a bit then check
                            setTimeout(() => {
                                ws.close();
                                resolve(false); // Did not receive from other group
                            }, 3000);
                        } else {
                            // Check if we received from other group
                            const pubs = message.payload.data.workout_publications;
                            const fromOtherGroup = pubs.some((p: any) => p.group_id === otherGroupId);
                            if (fromOtherGroup) {
                                ws.close();
                                resolve(true); // Incorrectly received from other group!
                            }
                        }
                    }
                };

                ws.onerror = () => resolve(false);
            });

            expect(receivedFromOtherGroup).toBe(false);
            console.log('✅ Subscription correctly isolated to own group');

            // Cleanup
            await hasuraQuery(`
                mutation Cleanup($sessionSig: String!, $groupId: String!, $userKey: String!) {
                    delete_workout_publications(where: { session_signature: { _eq: $sessionSig } }) { affected_rows }
                    delete_workout_sessions(where: { signature: { _eq: $sessionSig } }) { affected_rows }
                    delete_user_groups(where: { group_id: { _eq: $groupId } }) { affected_rows }
                    delete_users(where: { ed25519_public_key: { _eq: $userKey } }) { affected_rows }
                }
            `, { sessionSig: otherSessionSig, groupId: otherGroupId, userKey: user3 });
        }, 20000);
    });

    // ==================== CLEANUP ====================
    afterAll(async () => {
        console.log('🧹 Cleaning up test data...');

        try {
            // Delete in reverse order of dependencies
            await hasuraQuery(`
                mutation DeletePublication($sessionSig: String!) {
                    delete_workout_publications(where: { session_signature: { _eq: $sessionSig } }) {
                        affected_rows
                    }
                }
            `, { sessionSig: sessionSignature });

            await hasuraQuery(`
                mutation DeleteSession($signature: String!) {
                    delete_workout_sessions(where: { signature: { _eq: $signature } }) {
                        affected_rows
                    }
                }
            `, { signature: sessionSignature });

            await hasuraQuery(`
                mutation DeleteGroup($groupId: String!) {
                    delete_user_groups(where: { group_id: { _eq: $groupId } }) {
                        affected_rows
                    }
                }
            `, { groupId });

            await hasuraQuery(`
                mutation DeleteUsers($user1: String!, $user2: String!) {
                    delete_users(where: { ed25519_public_key: { _in: [$user1, $user2] } }) {
                        affected_rows
                    }
                }
            `, { user1, user2 });

            console.log('✅ Cleanup complete');
        } catch (error) {
            console.error('⚠️ Cleanup error:', error);
        }
    }, 15000);
});
