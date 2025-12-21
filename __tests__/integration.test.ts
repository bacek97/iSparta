/**
 * Integration Tests for Server and Hasura
 * These tests make REAL HTTP requests to verify server is working
 */

import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

// Real production server URLs
const DENO_SERVER_URL = process.env.DENO_SERVER_URL || 'https://isparta.bacek97.deno.net';
const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('Integration Tests - Real Server', () => {
    const testWorkoutSession: SimpleWorkoutSession = {
        sessionId: `test_${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60 * 1000),
        exercises: {
            [EXERCISES.PUSHUPS]: {
                duration: 120,
                reps: 20,
                direction: 0,
            },
            [EXERCISES.SQUATS]: {
                duration: 180,
                reps: 30,
                direction: 0,
            }
        }
    };

    describe('Deno Server Health Check', () => {
        it('should respond to health check endpoint', async () => {
            const response = await fetch(`${DENO_SERVER_URL}/health`);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('status');
            expect(data.status).toBe('ok');
        }, 10000);

        it('should have calculate-bonuses endpoint available', async () => {
            const response = await fetch(`${DENO_SERVER_URL}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: {
                        signature: 'test',
                        user_public_key: 'ed25519:test',
                        session_date: new Date().toISOString(),
                        exercise_sets: []
                    },
                    user: {
                        public_key: 'ed25519:test',
                        fms_category: 'JUNIOR'
                    }
                })
            });

            expect(response.status).not.toBe(404);
        }, 10000);
    });

    describe('Bonus Calculation Endpoint', () => {
        it('should calculate bonuses for real workout data', async () => {
            const serverSession = {
                signature: testWorkoutSession.sessionId,
                user_public_key: 'ed25519:test123',
                session_date: testWorkoutSession.startTime.toISOString(),
                exercise_sets: [
                    {
                        hash_shazam: `${testWorkoutSession.sessionId}_PUSHUPS`,
                        exercise_type: 'PUSHUPS',
                        exercise_category: 'REPS' as const,
                        set_date: testWorkoutSession.startTime.toISOString(),
                        seconds: 120,
                        reps: 20
                    },
                    {
                        hash_shazam: `${testWorkoutSession.sessionId}_SQUATS`,
                        exercise_type: 'SQUATS',
                        exercise_category: 'REPS' as const,
                        set_date: testWorkoutSession.startTime.toISOString(),
                        seconds: 180,
                        reps: 30
                    }
                ]
            };

            const response = await fetch(`${DENO_SERVER_URL}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: serverSession,
                    user: {
                        public_key: 'ed25519:test123',
                        fms_category: 'JUNIOR'
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data).toHaveProperty('base_points');
            expect(data).toHaveProperty('total_points');
            expect(data).toHaveProperty('bonus_tech_factor');
            expect(data).toHaveProperty('bonus_speed');
            expect(data).toHaveProperty('exercise_breakdown');

            expect(data.base_points).toBeGreaterThan(0);
            expect(data.total_points).toBeGreaterThanOrEqual(data.base_points);
            expect(Array.isArray(data.exercise_breakdown)).toBe(true);
            expect(data.exercise_breakdown.length).toBeGreaterThan(0);

            console.log('✅ Server response:', JSON.stringify(data, null, 2));
        }, 15000);

        it('should handle different FMS categories', async () => {
            const categories: Array<'JUNIOR' | 'MIDDLE' | 'SENIOR'> = ['JUNIOR', 'MIDDLE', 'SENIOR'];

            for (const category of categories) {
                const response = await fetch(`${DENO_SERVER_URL}/calculate-bonuses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session: {
                            signature: `test_${category}`,
                            user_public_key: 'ed25519:test',
                            session_date: new Date().toISOString(),
                            exercise_sets: [{
                                hash_shazam: 'test',
                                exercise_type: 'PUSHUPS',
                                exercise_category: 'REPS',
                                set_date: new Date().toISOString(),
                                seconds: 60,
                                reps: 10
                            }]
                        },
                        user: {
                            public_key: 'ed25519:test',
                            fms_category: category
                        }
                    })
                });

                expect(response.ok).toBe(true);
                const data = await response.json();
                expect(data.total_points).toBeGreaterThan(0);

                console.log(`✅ ${category}: ${data.total_points} points`);
            }
        }, 20000);
    });

    describe('Hasura GraphQL Integration', () => {
        it('should be able to connect to Hasura', async () => {
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: '{ __schema { queryType { name } } }'
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data).toHaveProperty('data');
        }, 10000);

        it('should have workout_sessions table', async () => {
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `
                        query {
                            __type(name: "workout_sessions") {
                                name
                                fields {
                                    name
                                }
                            }
                        }
                    `
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();

            // Table MUST exist - test WILL FAIL if it doesn't
            expect(data.data).toBeDefined();
            expect(data.data.__type).not.toBeNull();
            expect(data.data.__type.name).toBe('workout_sessions');

            console.log('✅ workout_sessions table found with fields:',
                data.data.__type.fields.map((f: any) => f.name).join(', '));
        }, 10000);
    });

    describe('End-to-End Flow', () => {
        it('should complete bonus calculation', async () => {
            const bonusResponse = await fetch(`${DENO_SERVER_URL}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: {
                        signature: testWorkoutSession.sessionId,
                        user_public_key: 'ed25519:integration_test',
                        session_date: testWorkoutSession.startTime.toISOString(),
                        exercise_sets: [{
                            hash_shazam: `${testWorkoutSession.sessionId}_PUSHUPS`,
                            exercise_type: 'PUSHUPS',
                            exercise_category: 'REPS',
                            set_date: testWorkoutSession.startTime.toISOString(),
                            seconds: 120,
                            reps: 20
                        }]
                    },
                    user: {
                        public_key: 'ed25519:integration_test',
                        fms_category: 'JUNIOR'
                    }
                })
            });

            expect(bonusResponse.ok).toBe(true);
            const bonusData = await bonusResponse.json();
            expect(bonusData.total_points).toBeGreaterThan(0);

            console.log('✅ Bonuses calculated:', bonusData.total_points, 'points');

            expect(bonusData).toHaveProperty('session_signature');
            expect(bonusData.session_signature).toBe(testWorkoutSession.sessionId);
        }, 20000);
    });

    describe('Steps Sync via Workout Session', () => {
        const stepsSessionId = `steps_test_${Date.now()}`;

        it('should accept STEPS exercise category in bonus calculation', async () => {
            const response = await fetch(`${DENO_SERVER_URL}/calculate-bonuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: {
                        signature: stepsSessionId,
                        user_public_key: 'ed25519:steps_test_user',
                        session_date: new Date().toISOString(),
                        exercise_sets: [{
                            hash_shazam: `${stepsSessionId}_STEPS`,
                            exercise_type: 'STEPS',
                            exercise_category: 'STEPS',
                            set_date: new Date().toISOString(),
                            seconds: 0,
                            reps: 5000  // 5000 steps
                        }]
                    },
                    user: {
                        public_key: 'ed25519:steps_test_user',
                        fms_category: 'JUNIOR'
                    }
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data).toHaveProperty('total_points');
            expect(data).toHaveProperty('exercise_breakdown');
            expect(data.exercise_breakdown.length).toBe(1);
            expect(data.exercise_breakdown[0].exercise_type).toBe('STEPS');

            console.log('✅ Steps sync test passed:', data.total_points, 'points for 5000 steps');
        }, 15000);

        it('should validate STEPS category in exercise_sets', async () => {
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `{
                        __type(name: "exercise_sets") {
                            name
                            fields { name }
                        }
                    }`
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.data.__type).not.toBeNull();
            expect(data.data.__type.fields.some((f: any) => f.name === 'exercise_category')).toBe(true);

            console.log('✅ exercise_sets table has exercise_category field for STEPS');
        }, 10000);
    });
});
