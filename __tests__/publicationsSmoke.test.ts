/**
 * Simple smoke test for publications
 */

import { createPublication, getGroupPublications } from '../publicationsService';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';

describe('Publications Smoke Test', () => {
    it('should connect to Hasura', async () => {
        const query = `{ __typename }`;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        const result = await response.json();
        console.log('Hasura connection:', result);
        expect(response.ok).toBe(true);
    });

    it('should query workout_publications table', async () => {
        const query = `
            query {
                workout_publications(limit: 1) {
                    id
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-role': 'anonymous',
            },
            body: JSON.stringify({ query }),
        });

        const result = await response.json();
        console.log('Publications query result:', result);

        if (result.errors) {
            console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
        }

        expect(result.errors).toBeUndefined();
        expect(result.data).toBeDefined();
    });
});
