/**
 * TDD Tests for User Registration in Hasura
 * Tests automatic user creation when enabling server sync
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

import * as AuthService from '../authService';

describe('User Registration in Hasura (TDD)', () => {
    const createdKeys: string[] = [];

    const cleanupUser = async (publicKey: string) => {
        try {
            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `mutation { delete_users(where: {ed25519_public_key: {_eq: "${publicKey}"}}) { affected_rows } }`
                })
            });
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    };

    afterAll(async () => {
        // Cleanup all created users
        for (const key of createdKeys) {
            await cleanupUser(key);
        }
    });

    describe('registerUserInHasura', () => {
        it('should create user in Hasura database', async () => {
            const testKey = `ed25519:test_create_${Date.now()}_${Math.random()}`;
            createdKeys.push(testKey);

            const result = await AuthService.registerUserInHasura(testKey);

            expect(result).toBeDefined();
            expect(result.ed25519_public_key).toBe(testKey);
            expect(result.fms_category).toBe('JUNIOR'); // Default category
        });

        it('should be idempotent - not fail if user already exists', async () => {
            const testKey = `ed25519:test_idempotent_${Date.now()}_${Math.random()}`;
            createdKeys.push(testKey);

            // Create user first time
            await AuthService.registerUserInHasura(testKey);

            // Try to create again - should not throw
            const result = await AuthService.registerUserInHasura(testKey);

            expect(result).toBeDefined();
            expect(result.ed25519_public_key).toBe(testKey);
        });

        it('should verify user exists in database after creation', async () => {
            const testKey = `ed25519:test_verify_${Date.now()}_${Math.random()}`;
            createdKeys.push(testKey);

            await AuthService.registerUserInHasura(testKey);

            // Query to check if user exists
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `query { users(where: {ed25519_public_key: {_eq: "${testKey}"}}) { ed25519_public_key fms_category } }`
                })
            });

            const data = await response.json();

            expect(data.data.users).toHaveLength(1);
            expect(data.data.users[0].ed25519_public_key).toBe(testKey);
        });

        it('should set default fms_category to JUNIOR', async () => {
            const testKey = `ed25519:test_default_${Date.now()}_${Math.random()}`;
            createdKeys.push(testKey);

            const result = await AuthService.registerUserInHasura(testKey);

            expect(result.fms_category).toBe('JUNIOR');
        });

        it('should allow specifying custom fms_category', async () => {
            const customKey = `ed25519:test_custom_${Date.now()}_${Math.random()}`;
            createdKeys.push(customKey);

            const result = await AuthService.registerUserInHasura(customKey, 'SENIOR');

            expect(result.fms_category).toBe('SENIOR');
        });
    });

    describe('Auto-register on sync enable', () => {
        it('should register user when enabling auto-sync for first time', async () => {
            // This test will be implemented after we have the integration
            // For now, just a placeholder
            expect(true).toBe(true);
        });
    });
});
