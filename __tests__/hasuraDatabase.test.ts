/**
 * Hasura Database Integration Tests
 * Tests for CRUD operations and GraphQL subscriptions
 */

import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('Hasura Database Integration Tests', () => {
    const testUserId = `ed25519:test_${Date.now()}`;
    const testSessionId = `session_${Date.now()}`;

    describe('INSERT Operations', () => {
        it('should insert a new user', async () => {
            const mutation = `
                mutation InsertUser($publicKey: String!, $fmsCategory: String!) {
                    insert_users_one(object: {
                        ed25519_public_key: $publicKey,
                        fms_category: $fmsCategory
                    }) {
                        ed25519_public_key
                        fms_category
                        created_at
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        publicKey: testUserId,
                        fmsCategory: 'JUNIOR'
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.data).toBeDefined();
            expect(data.data.insert_users_one).toBeDefined();
            expect(data.data.insert_users_one.ed25519_public_key).toBe(testUserId);
            expect(data.data.insert_users_one.fms_category).toBe('JUNIOR');

            console.log('✅ User inserted:', data.data.insert_users_one);
        }, 10000);

        it('should insert a workout session with exercise sets', async () => {
            const mutation = `
                mutation InsertWorkoutSession(
                    $signature: String!,
                    $userPublicKey: String!,
                    $sessionDate: timestamptz!,
                    $basePoints: numeric!,
                    $totalPoints: numeric!,
                    $exerciseSets: [exercise_sets_insert_input!]!
                ) {
                    insert_workout_sessions_one(object: {
                        signature: $signature,
                        user_public_key: $userPublicKey,
                        session_date: $sessionDate,
                        base_points: $basePoints,
                        total_points: $totalPoints,
                        exercise_sets: {
                            data: $exerciseSets
                        }
                    }) {
                        signature
                        session_date
                        base_points
                        total_points
                        exercise_sets {
                            hash_shazam
                            exercise_type
                            reps
                            seconds
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        signature: testSessionId,
                        userPublicKey: testUserId,
                        sessionDate: new Date().toISOString(),
                        basePoints: 10.5,
                        totalPoints: 15.5,
                        exerciseSets: [
                            {
                                hash_shazam: `${testSessionId}_PUSHUPS`,
                                exercise_type: 'PUSHUPS',
                                exercise_category: 'REPS',
                                set_date: new Date().toISOString(),
                                seconds: 120,
                                reps: 20,
                                calories: 0.26,
                                points: 5.2
                            },
                            {
                                hash_shazam: `${testSessionId}_SQUATS`,
                                exercise_type: 'SQUATS',
                                exercise_category: 'REPS',
                                set_date: new Date().toISOString(),
                                seconds: 180,
                                reps: 30,
                                calories: 0.3,
                                points: 9.0
                            }
                        ]
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            if (data.errors) {
                console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
            }

            expect(data.data).toBeDefined();
            expect(data.data.insert_workout_sessions_one).toBeDefined();
            expect(data.data.insert_workout_sessions_one.signature).toBe(testSessionId);
            expect(data.data.insert_workout_sessions_one.exercise_sets.length).toBe(2);

            console.log('✅ Workout session inserted with',
                data.data.insert_workout_sessions_one.exercise_sets.length, 'exercises');
        }, 10000);

        it('should prevent duplicate session insertion (signature constraint)', async () => {
            const mutation = `
                mutation InsertWorkoutSession($signature: String!, $userPublicKey: String!) {
                    insert_workout_sessions_one(object: {
                        signature: $signature,
                        user_public_key: $userPublicKey,
                        session_date: "${new Date().toISOString()}",
                        base_points: 10,
                        total_points: 15
                    }) {
                        signature
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        signature: testSessionId, // Same signature as previous test
                        userPublicKey: testUserId
                    }
                })
            });

            const data = await response.json();

            // Should have error due to unique constraint
            expect(data.errors).toBeDefined();
            expect(data.errors[0].message).toContain('Uniqueness violation');

            console.log('✅ Duplicate prevention working');
        }, 10000);
    });

    describe('QUERY Operations', () => {
        it('should query user by public key', async () => {
            const query = `
                query GetUser($publicKey: String!) {
                    users_by_pk(ed25519_public_key: $publicKey) {
                        ed25519_public_key
                        fms_category
                        created_at
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        publicKey: testUserId
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.data).toBeDefined();
            expect(data.data.users_by_pk).toBeDefined();
            expect(data.data.users_by_pk.ed25519_public_key).toBe(testUserId);

            console.log('✅ User queried:', data.data.users_by_pk.fms_category);
        }, 10000);

        it('should query workout sessions with relationships', async () => {
            const query = `
                query GetWorkoutSessions($userPublicKey: String!) {
                    workout_sessions(
                        where: { user_public_key: { _eq: $userPublicKey } },
                        order_by: { session_date: desc }
                    ) {
                        signature
                        session_date
                        base_points
                        total_points
                        user {
                            ed25519_public_key
                            fms_category
                        }
                        exercise_sets {
                            hash_shazam
                            exercise_type
                            reps
                            seconds
                            points
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        userPublicKey: testUserId
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.data).toBeDefined();
            expect(data.data.workout_sessions).toBeDefined();
            expect(Array.isArray(data.data.workout_sessions)).toBe(true);
            expect(data.data.workout_sessions.length).toBeGreaterThan(0);

            const session = data.data.workout_sessions[0];
            expect(session.user).toBeDefined();
            expect(session.exercise_sets).toBeDefined();
            expect(session.exercise_sets.length).toBeGreaterThan(0);

            console.log('✅ Queried', data.data.workout_sessions.length,
                'sessions with relationships');
        }, 10000);

        it('should aggregate workout statistics', async () => {
            const query = `
                query GetUserStats($userPublicKey: String!) {
                    workout_sessions_aggregate(
                        where: { user_public_key: { _eq: $userPublicKey } }
                    ) {
                        aggregate {
                            count
                            sum {
                                total_points
                                base_points
                            }
                            avg {
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
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        userPublicKey: testUserId
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.data).toBeDefined();
            expect(data.data.workout_sessions_aggregate).toBeDefined();
            expect(data.data.workout_sessions_aggregate.aggregate.count).toBeGreaterThan(0);

            console.log('✅ Stats:', data.data.workout_sessions_aggregate.aggregate);
        }, 10000);
    });

    describe('SUBSCRIPTION Operations', () => {
        it('should establish WebSocket connection for subscriptions', async () => {
            // GraphQL subscriptions use WebSocket protocol
            const wsUrl = HASURA_URL.replace('https://', 'wss://').replace('http://', 'ws://');

            // Test WebSocket connection
            const ws = new WebSocket(wsUrl, 'graphql-ws');

            await new Promise((resolve, reject) => {
                ws.onopen = () => {
                    console.log('✅ WebSocket connected');

                    // Send connection_init
                    ws.send(JSON.stringify({
                        type: 'connection_init',
                        payload: {
                            headers: {
                                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                            }
                        }
                    }));
                };

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    if (message.type === 'connection_ack') {
                        console.log('✅ WebSocket connection acknowledged');
                        ws.close();
                        resolve(true);
                    }
                };

                ws.onerror = (error) => {
                    reject(error);
                };

                setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
            });

            // Wait a bit for close to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            expect([WebSocket.CLOSING, WebSocket.CLOSED]).toContain(ws.readyState);
        }, 10000);

        it('should receive real-time updates on OTHER users workouts (for push notifications)', async () => {
            const wsUrl = HASURA_URL.replace('https://', 'wss://').replace('http://', 'ws://');
            const ws = new WebSocket(wsUrl, 'graphql-ws');

            // Subscribe to OTHER users' workouts (not current user)
            // This is for motivational push notifications
            const subscription = `
                subscription OnOtherUsersWorkouts($excludeUserPublicKey: String!) {
                    workout_sessions(
                        where: { user_public_key: { _neq: $excludeUserPublicKey } },
                        order_by: { session_date: desc },
                        limit: 5
                    ) {
                        signature
                        session_date
                        total_points
                        user {
                            ed25519_public_key
                            fms_category
                        }
                    }
                }
            `;

            const receivedUpdates: any[] = [];

            await new Promise((resolve, reject) => {
                ws.onopen = () => {
                    // Initialize connection
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

                    if (message.type === 'connection_ack') {
                        // Start subscription - exclude current user's workouts
                        ws.send(JSON.stringify({
                            id: '1',
                            type: 'start',
                            payload: {
                                query: subscription,
                                variables: {
                                    excludeUserPublicKey: testUserId
                                }
                            }
                        }));
                    } else if (message.type === 'data') {
                        receivedUpdates.push(message.payload.data);
                        const sessions = message.payload.data.workout_sessions;
                        console.log('✅ Received subscription update:',
                            sessions.length, 'OTHER users workouts');

                        // Verify we're NOT receiving current user's workouts
                        if (sessions.length > 0) {
                            const hasOwnWorkout = sessions.some(
                                (s: any) => s.user.ed25519_public_key === testUserId
                            );
                            if (hasOwnWorkout) {
                                console.warn('⚠️  Received own workout in subscription!');
                            }
                        }

                        // Close after receiving first update
                        ws.close();
                        resolve(true);
                    } else if (message.type === 'error') {
                        reject(new Error(message.payload.message));
                    }
                };

                ws.onerror = (error) => {
                    reject(error);
                };

                setTimeout(() => {
                    ws.close();
                    if (receivedUpdates.length > 0) {
                        resolve(true);
                    } else {
                        reject(new Error('No subscription updates received'));
                    }
                }, 5000);
            });

            expect(receivedUpdates.length).toBeGreaterThan(0);
            expect(receivedUpdates[0].workout_sessions).toBeDefined();
        }, 10000);
    });

    describe('CLEANUP', () => {
        it('should delete test data', async () => {
            // Delete workout sessions (cascade will delete exercise_sets)
            const deleteSessionsMutation = `
                mutation DeleteSessions($signature: String!) {
                    delete_workout_sessions_by_pk(signature: $signature) {
                        signature
                    }
                }
            `;

            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: deleteSessionsMutation,
                    variables: { signature: testSessionId }
                })
            });

            // Delete user
            const deleteUserMutation = `
                mutation DeleteUser($publicKey: String!) {
                    delete_users_by_pk(ed25519_public_key: $publicKey) {
                        ed25519_public_key
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: deleteUserMutation,
                    variables: { publicKey: testUserId }
                })
            });

            expect(response.ok).toBe(true);
            console.log('✅ Test data cleaned up');
        }, 10000);
    });
});
