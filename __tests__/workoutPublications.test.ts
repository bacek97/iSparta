/**
 * Workout Publications Integration Tests
 * TDD Approach: Write failing tests first, then implement
 * NO MOCKS - Real Hasura integration tests
 */

import {
    WorkoutPublication,
    CreatePublicationInput,
    PublicationWithWorkout,
    WorkoutSession,
    EXERCISES
} from '../common_types';

// Test configuration
const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const TEST_USER_KEY = `ed25519:test_pub_${Date.now()}`;
const TEST_GROUP_ID = 'test_group_publications';

describe('Workout Publications Integration Tests (NO MOCKS)', () => {
    let testSessionSignature: string;
    let testRunningSessionSignature: string;

    beforeAll(async () => {
        // Create test user in Hasura
        await createTestUser(TEST_USER_KEY);

        // Create test workout session
        testSessionSignature = await createTestWorkoutSession(TEST_USER_KEY, false);

        // Create test RUNNING session with route
        testRunningSessionSignature = await createTestRunningSession(TEST_USER_KEY);
    });

    afterAll(async () => {
        // Cleanup test data
        await deleteTestPublications();
        await deleteTestSessions();
        await deleteTestUser();
    });

    describe('Create Publication', () => {
        it('should create publication with text only', async () => {
            const input: CreatePublicationInput = {
                session_signature: testSessionSignature,
                text_content: 'Great workout today! 💪',
            };

            const publication = await createPublication(input, TEST_USER_KEY);

            expect(publication.id).toBeDefined();
            expect(publication.session_signature).toBe(testSessionSignature);
            expect(publication.user_public_key).toBe(TEST_USER_KEY);
            expect(publication.text_content).toBe('Great workout today! 💪');
            expect(publication.images).toEqual([]);
            expect(publication.created_at).toBeDefined();
        });

        it('should create publication with 1-5 images', async () => {
            const images = [
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            ];

            const input: CreatePublicationInput = {
                session_signature: testSessionSignature,
                text_content: 'Post-workout selfie!',
                images,
            };

            const publication = await createPublication(input, TEST_USER_KEY);

            expect(publication.images).toHaveLength(2);
            expect(publication.images![0]).toContain('data:image/png;base64');
        });

        it('should reject more than 5 images', async () => {
            const images = Array(6).fill('data:image/png;base64,iVBORw0KGg...');

            const input: CreatePublicationInput = {
                session_signature: testSessionSignature,
                images,
            };

            await expect(createPublication(input, TEST_USER_KEY)).rejects.toThrow('Maximum 5 images allowed');
        });

        it('should auto-attach map SVG path for RUNNING workout', async () => {
            const input: CreatePublicationInput = {
                session_signature: testRunningSessionSignature,
                text_content: '5K morning run! 🏃',
                include_map: true,
            };

            const publication = await createPublication(input, TEST_USER_KEY);

            expect(publication.map_svg_path).toBeDefined();
            expect(publication.map_svg_path!.startsWith('M')).toBe(true); // SVG path format
            expect(publication.map_svg_path!.length).toBeGreaterThan(10);
        });

        it('should NOT attach map if include_map is false', async () => {
            const input: CreatePublicationInput = {
                session_signature: testRunningSessionSignature,
                text_content: 'Run without map',
                include_map: false,
            };

            const publication = await createPublication(input, TEST_USER_KEY);

            expect(publication.map_svg_path).toBeNull();
        });

        it('should prevent duplicate publications for same session', async () => {
            const input: CreatePublicationInput = {
                session_signature: testSessionSignature,
                text_content: 'First publication',
            };

            await createPublication(input, TEST_USER_KEY);

            // Try to create another publication for same session
            await expect(createPublication({ ...input, text_content: 'Duplicate!' }, TEST_USER_KEY))
                .rejects.toThrow('Publication already exists for this session');
        });
    });

    describe('Fetch Publications', () => {
        beforeEach(async () => {
            // Create some test publications
            await createPublication({
                session_signature: testSessionSignature,
                text_content: 'Test publication 1',
            }, TEST_USER_KEY);
        });

        it('should fetch publications for group members', async () => {
            const publications = await getGroupPublications(TEST_GROUP_ID);

            expect(Array.isArray(publications)).toBe(true);
            expect(publications.length).toBeGreaterThan(0);
        });

        it('should include workout session data', async () => {
            const publications = await getGroupPublications(TEST_GROUP_ID);
            const pub = publications[0];

            expect(pub.workout_session).toBeDefined();
            expect(pub.workout_session.signature).toBeDefined();
            expect(pub.workout_session.exercise_sets).toBeDefined();
            expect(Array.isArray(pub.workout_session.exercise_sets)).toBe(true);
        });

        it('should order publications by created_at DESC', async () => {
            const publications = await getGroupPublications(TEST_GROUP_ID);

            for (let i = 0; i < publications.length - 1; i++) {
                const current = new Date(publications[i].created_at!);
                const next = new Date(publications[i + 1].created_at!);
                expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
            }
        });

        it('should limit results to 50 publications', async () => {
            const publications = await getGroupPublications(TEST_GROUP_ID);

            expect(publications.length).toBeLessThanOrEqual(50);
        });
    });

    describe('Update Publication', () => {
        it('should allow updating text content', async () => {
            const pub = await createPublication({
                session_signature: testSessionSignature,
                text_content: 'Original text',
            }, TEST_USER_KEY);

            const updated = await updatePublication(pub.id!, {
                text_content: 'Updated text',
            });

            expect(updated.text_content).toBe('Updated text');
            expect(updated.updated_at).not.toBe(pub.created_at);
        });
    });

    describe('Delete Publication', () => {
        it('should delete publication by ID', async () => {
            const pub = await createPublication({
                session_signature: testSessionSignature,
                text_content: 'To be deleted',
            }, TEST_USER_KEY);

            await deletePublication(pub.id!);

            const publications = await getGroupPublications(TEST_GROUP_ID);
            expect(publications.find(p => p.id === pub.id)).toBeUndefined();
        });
    });
});

// ==================== HELPER FUNCTIONS ====================

async function createTestUser(publicKey: string): Promise<void> {
    const mutation = `
        mutation CreateUser($publicKey: String!) {
            insert_users_one(object: {
                ed25519_public_key: $publicKey,
                fms_category: "JUNIOR"
            }) {
                ed25519_public_key
            }
        }
    `;

    await executeGraphQL(mutation, { publicKey });
}

async function createTestWorkoutSession(userKey: string, isRunning: boolean): Promise<string> {
    const signature = `test_session_${Date.now()}_${Math.random()}`;

    const mutation = `
        mutation CreateSession($session: workout_sessions_insert_input!) {
            insert_workout_sessions_one(object: $session) {
                signature
            }
        }
    `;

    const exerciseSets = isRunning ? [{
        hash_shazam: `hash_${Date.now()}`,
        exercise_type: 'RUNNING',
        exercise_category: 'KILOMETERS',
        set_date: new Date().toISOString(),
        seconds: 600,
        kilometers: 5.2,
        svg_path: 'M 0 0 L 100 100 L 200 50 Z',
    }] : [{
        hash_shazam: `hash_${Date.now()}`,
        exercise_type: 'SQUATS',
        exercise_category: 'REPS',
        set_date: new Date().toISOString(),
        seconds: 120,
        reps: 50,
    }];

    await executeGraphQL(mutation, {
        session: {
            signature,
            user_public_key: userKey,
            session_date: new Date().toISOString(),
            exercise_sets: { data: exerciseSets },
        },
    });

    return signature;
}

async function createTestRunningSession(userKey: string): Promise<string> {
    return createTestWorkoutSession(userKey, true);
}

// Import real service functions
import {
    createPublication,
    getGroupPublications,
    updatePublication,
    deletePublication
} from '../publicationsService';


async function deleteTestPublications(): Promise<void> {
    // Cleanup test publications
}

async function deleteTestSessions(): Promise<void> {
    // Cleanup test sessions
}

async function deleteTestUser(): Promise<void> {
    // Delete test user
}

async function executeGraphQL(query: string, variables: any): Promise<any> {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-role': 'anonymous',
        },
        body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0].message);
    }

    return result.data;
}
