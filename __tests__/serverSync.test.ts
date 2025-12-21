/**
 * Integration Tests for Server Sync Service
 * Connects to real Hasura instance
 */

import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';
import * as ServerSync from '../serverSyncService';

// Hasura Config
const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// Polyfill fetch if needed (Node 18+ has it native)
if (!global.fetch) {
    global.fetch = require('node-fetch');
}

describe('ServerSyncService - Integration', () => {
    const testPublicKey = `ed25519:test_integration_${Date.now()}`;

    beforeAll(async () => {
        // Create test user
        const mutation = `
            mutation CreateTestUser($pk: String!) {
                insert_users_one(object: {
                    ed25519_public_key: $pk,
                    fms_category: "JUNIOR"
                }) {
                    ed25519_public_key
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                query: mutation,
                variables: { pk: testPublicKey }
            })
        });

        const result = await response.json();
        if (result.errors) {
            console.error('Failed to create test user:', JSON.stringify(result.errors));
            throw new Error('Failed to create test user');
        }
    });

    it('should sync running session with new fields to Hasura', async () => {
        const session: SimpleWorkoutSession = {
            sessionId: `run_integ_${Date.now()}`,
            startTime: new Date(),
            exercises: {
                [EXERCISES.RUNNING]: {
                    duration: 1800,
                    kilometers: 5.5,
                    'svg:path[d]': 'M0 0 L10 10',
                    route_points: [{ lat: 10, lon: 10 }, { lat: 20, lon: 20 }],
                    route_bounds: { minLat: 0, maxLat: 20, minLon: 0, maxLon: 20 }
                }
            } as any
        };

        const userData = {
            publicKey: testPublicKey,
            fmsCategory: 'JUNIOR' as const
        };

        // Act
        const result = await ServerSync.syncWorkoutSession(session, userData);

        if (!result.success) {
            console.error('Sync failed with error:', result.error);
        }

        // Assert
        expect(result.success).toBe(true);
        expect(result.bonusData).toBeDefined();
        expect(result.bonusData?.sessionSignature).toBe(session.sessionId);

        // Verify data in DB
        const query = `
            query VerifySession($sig: String!) {
                workout_sessions_by_pk(signature: $sig) {
                    signature
                    exercise_sets {
                        exercise_type
                        kilometers
                        svg_path_d
                        route_points
                        route_bounds
                    }
                }
            }
        `;

        const verifyResponse = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                query: query,
                variables: { sig: session.sessionId }
            })
        });

        const verifyResult = await verifyResponse.json();
        const sessionData = verifyResult.data.workout_sessions_by_pk;

        expect(sessionData).toBeDefined();
        expect(sessionData.exercise_sets).toHaveLength(1);

        const runningSet = sessionData.exercise_sets[0];
        expect(runningSet.exercise_type).toBe('RUNNING');
        expect(runningSet.kilometers).toBe(5.5);
        expect(runningSet.svg_path_d).toBe('M0 0 L10 10');
        expect(runningSet.route_points).toEqual([{ lat: 10, lon: 10 }, { lat: 20, lon: 20 }]);
        expect(runningSet.route_bounds).toEqual({ minLat: 0, maxLat: 20, minLon: 0, maxLon: 20 });
    });
});
