/**
 * Workout Publications - Simplified Integration Tests
 * Testing against real Hasura without complex setup
 */

import {
    createPublication,
    getGroupPublications,
    updatePublication,
    deletePublication
} from '../publicationsService';
import type { CreatePublicationInput } from '../common_types';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';

// Use existing test user from previous migrations
const TEST_USER_KEY = 'test_user_pub_001';
const TEST_SESSION_SIG = `test_session_${Date.now()}`;

describe('Publications Integration (Simplified)', () => {
    describe('Basic CRUD Operations', () => {
        let publicationId: number;

        it('should create publication with text only', async () => {
            // First, create a test session
            const session = await createTestSession(TEST_SESSION_SIG, TEST_USER_KEY);
            expect(session).toBeDefined();

            const input: CreatePublicationInput = {
                session_signature: TEST_SESSION_SIG,
                text_content: 'Great workout! 💪',
            };

            const publication = await createPublication(input, TEST_USER_KEY);

            expect(publication).toBeDefined();
            expect(publication.id).toBeDefined();
            expect(publication.text_content).toBe('Great workout! 💪');
            expect(publication.user_public_key).toBe(TEST_USER_KEY);

            publicationId = publication.id!;
        }, 15000);

        it('should reject more than 5 images', async () => {
            const images = Array(6).fill('data:image/png;base64,test');

            const input: CreatePublicationInput = {
                session_signature: `test_session_images_${Date.now()}`,
                images,
            };

            await expect(
                createPublication(input, TEST_USER_KEY)
            ).rejects.toThrow('Maximum 5 images allowed');
        });

        it('should prevent duplicate publications', async () => {
            const input: CreatePublicationInput = {
                session_signature: TEST_SESSION_SIG,
                text_content: 'Duplicate attempt',
            };

            await expect(
                createPublication(input, TEST_USER_KEY)
            ).rejects.toThrow('Publication already exists');
        });
    });
});

// ==================== HELPER FUNCTIONS ====================

async function createTestSession(signature: string, userKey: string): Promise<any> {
    const mutation = `
        mutation CreateSession($session: workout_sessions_insert_input!) {
            insert_workout_sessions_one(
                object: $session
                on_conflict: {
                    constraint: workout_sessions_pkey
                    update_columns: []
                }
            ) {
                signature
            }
        }
    `;

    const result = await executeGraphQL(mutation, {
        session: {
            signature,
            user_public_key: userKey,
            session_date: new Date().toISOString(),
            base_points: 0,
            total_points: 0,
        },
    });

    return result.insert_workout_sessions_one;
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
        console.error('[TestHelper] GraphQL errors:', JSON.stringify(result.errors, null, 2));
        throw new Error(result.errors[0].message);
    }

    return result.data;
}
