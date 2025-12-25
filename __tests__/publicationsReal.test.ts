/**
 * Publications Integration Tests - TDD with Real DB
 * Tests create actual data in Hasura and clean up after
 */

import {
    createPublication,
    getGroupPublications,
    updatePublication,
    deletePublication
} from '../publicationsService';
import type { CreatePublicationInput } from '../common_types';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const TEST_USER_KEY = `ed25519:test_pub_${Date.now()}`;

describe('Publications Integration (TDD)', () => {
    let testSessionSignature: string;
    let createdPublicationId: number;

    beforeAll(async () => {
        // Create test user
        await createTestUser(TEST_USER_KEY);

        // Create test workout session
        testSessionSignature = await createTestSession(TEST_USER_KEY);
        console.log('[Test] Created session:', testSessionSignature);
    });

    afterAll(async () => {
        // Cleanup - delete publications, sessions, user
        try {
            if (createdPublicationId) {
                await deleteTestPublication(createdPublicationId);
            }
            await deleteTestSession(testSessionSignature);
            await deleteTestUser(TEST_USER_KEY);
        } catch (e) {
            console.log('[Test] Cleanup errors (expected):', e);
        }
    });

    it('should create publication with text only', async () => {
        const input: CreatePublicationInput = {
            session_signature: testSessionSignature,
            text_content: 'Great workout! 💪',
        };

        const publication = await createPublication(input, TEST_USER_KEY);

        expect(publication).toBeDefined();
        expect(publication.id).toBeDefined();
        expect(publication.text_content).toBe('Great workout! 💪');
        expect(publication.user_public_key).toBe(TEST_USER_KEY);

        createdPublicationId = publication.id!;
    });

    it('should reject more than 5 images', async () => {
        const images = Array(6).fill('data:image/png;base64,test');

        await expect(
            createPublication({
                session_signature: testSessionSignature,
                images,
            }, TEST_USER_KEY)
        ).rejects.toThrow('Maximum 5 images allowed');
    });

    it('should prevent duplicate publications', async () => {
        await expect(
            createPublication({
                session_signature: testSessionSignature,
                text_content: 'Duplicate',
            }, TEST_USER_KEY)
        ).rejects.toThrow('Publication already exists');
    });

    it('should update publication text', async () => {
        const updated = await updatePublication(createdPublicationId, {
            text_content: 'Updated! ✨',
        });

        expect(updated.text_content).toBe('Updated! ✨');
    });

    it('should delete publication', async () => {
        await deletePublication(createdPublicationId);

        // Verify deleted
        const pubs = await queryPublications(testSessionSignature);
        expect(pubs.find((p: any) => p.id === createdPublicationId)).toBeUndefined();
    });
});

// ==================== HELPERS ====================

async function createTestUser(publicKey: string): Promise<void> {
    const mutation = `
        mutation CreateUser($publicKey: String!) {
            insert_users_one(
                object: {
                    ed25519_public_key: $publicKey,
                    fms_category: "JUNIOR"
                }
                on_conflict: {
                    constraint: users_pkey
                    update_columns: []
                }
            ) {
                ed25519_public_key
            }
        }
    `;

    await executeGraphQL(mutation, { publicKey });
}

async function createTestSession(userKey: string): Promise<string> {
    const signature = `test_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const mutation = `
        mutation CreateSession($signature: String!, $userKey: String!, $date: timestamptz!) {
            insert_workout_sessions_one(
                object: {
                    signature: $signature,
                    user_public_key: $userKey,
                    session_date: $date,
                    base_points: 0,
                    total_points: 0
                }
            ) {
                signature
            }
        }
    `;

    await executeGraphQL(mutation, {
        signature,
        userKey,
        date: new Date().toISOString(),
    });

    return signature;
}

async function deleteTestPublication(id: number): Promise<void> {
    const mutation = `
        mutation DeletePub($id: Int!) {
            delete_workout_publications_by_pk(id: $id) {
                id
            }
        }
    `;

    await executeGraphQL(mutation, { id });
}

async function deleteTestSession(signature: string): Promise<void> {
    const mutation = `
        mutation DeleteSession($signature: String!) {
            delete_workout_sessions_by_pk(signature: $signature) {
                signature
            }
        }
    `;

    await executeGraphQL(mutation, { signature });
}

async function deleteTestUser(publicKey: string): Promise<void> {
    const mutation = `
        mutation DeleteUser($publicKey: String!) {
            delete_users_by_pk(ed25519_public_key: $publicKey) {
                ed25519_public_key
            }
        }
    `;

    await executeGraphQL(mutation, { publicKey });
}

async function queryPublications(sessionSignature: string): Promise<any[]> {
    const query = `
        query GetPubs($sig: String!) {
            workout_publications(where: { session_signature: { _eq: $sig } }) {
                id
            }
        }
    `;

    const result = await executeGraphQL(query, { sig: sessionSignature });
    return result.workout_publications || [];
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
        console.error('[Test] GraphQL errors:', JSON.stringify(result.errors, null, 2));
        throw new Error(result.errors[0].message);
    }

    return result.data;
}
