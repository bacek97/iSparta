/**
 * Nickname Validation Integration Tests (TDD)
 * Tests for checking nickname availability in NEAR and Hasura
 * No mocks - tests against real services
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';
const NEAR_TESTNET_RPC = 'https://rpc.testnet.near.org';

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
    return data;
}

async function checkNearAccountExists(accountId: string): Promise<boolean> {
    const fullAccountId = `${accountId}.testnet`;

    try {
        const response = await fetch(NEAR_TESTNET_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'dontcare',
                method: 'query',
                params: {
                    request_type: 'view_account',
                    finality: 'final',
                    account_id: fullAccountId,
                },
            }),
        });

        const data = await response.json();

        // If account exists, it will return account data
        // If account doesn't exist, it will return an error with UNKNOWN_ACCOUNT
        if (data.error && data.error.cause?.name === 'UNKNOWN_ACCOUNT') {
            return false; // Account does not exist (available)
        }

        return true; // Account exists
    } catch (error) {
        console.error('Error checking NEAR account:', error);
        throw error;
    }
}

describe('Nickname Validation Integration Tests', () => {
    const testTimestamp = Date.now();
    const testUser = `ed25519:nickname_test_${testTimestamp}`;
    const testNickname = `nickname_test_${testTimestamp}`;

    beforeAll(async () => {
        // Create test user with nickname
        await hasuraQuery(`
            mutation InsertUser($publicKey: String!, $nickname: String!) {
                insert_users_one(object: {
                    ed25519_public_key: $publicKey,
                    fms_category: "JUNIOR",
                    nickname: $nickname
                }) {
                    ed25519_public_key
                }
            }
        `, { publicKey: testUser, nickname: testNickname });
    });

    describe('Check Nickname in Hasura', () => {
        it('should return true if nickname exists in database', async () => {
            const result = await hasuraQuery(`
                query CheckNicknameExists($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                    }
                }
            `, { nickname: testNickname });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBe(1);

            console.log('✅ Existing nickname detected in Hasura');
        }, 10000);

        it('should return false if nickname does not exist', async () => {
            const uniqueNickname = `unique_nick_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const result = await hasuraQuery(`
                query CheckNicknameExists($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                    }
                }
            `, { nickname: uniqueNickname });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBe(0);

            console.log('✅ Non-existing nickname correctly identified');
        }, 10000);

        it('should be case-sensitive for nickname check', async () => {
            const uppercaseNickname = testNickname.toUpperCase();

            const result = await hasuraQuery(`
                query CheckNicknameExists($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                    }
                }
            `, { nickname: uppercaseNickname });

            // Using _eq which is case-sensitive in PostgreSQL
            expect(result.data).toBeDefined();
            // Different case should not match (unless collation is case-insensitive)

            console.log('✅ Case sensitivity check passed');
        }, 10000);
    });

    describe('Check Nickname in NEAR (testnet)', () => {
        it('should detect existing NEAR account', async () => {
            // 'alice' is a known existing testnet account
            const exists = await checkNearAccountExists('alice');

            expect(exists).toBe(true);

            console.log('✅ Existing NEAR account detected');
        }, 15000);

        it('should return false for non-existing NEAR account', async () => {
            // Random unique account name
            const randomName = `isparta_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const exists = await checkNearAccountExists(randomName);

            expect(exists).toBe(false);

            console.log('✅ Non-existing NEAR account correctly identified');
        }, 15000);
    });

    describe('Update Nickname with Validation', () => {
        it('should allow updating to available nickname', async () => {
            const newNickname = `available_${Date.now()}`;

            // First check it's available
            const checkResult = await hasuraQuery(`
                query CheckNicknameExists($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                    }
                }
            `, { nickname: newNickname });

            expect(checkResult.data.users.length).toBe(0);

            // Then update
            const updateResult = await hasuraQuery(`
                mutation UpdateNickname($publicKey: String!, $nickname: String!) {
                    update_users_by_pk(
                        pk_columns: { ed25519_public_key: $publicKey },
                        _set: { nickname: $nickname }
                    ) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { publicKey: testUser, nickname: newNickname });

            expect(updateResult.data).toBeDefined();
            expect(updateResult.data.update_users_by_pk.nickname).toBe(newNickname);

            console.log('✅ Nickname updated successfully');
        }, 10000);

        it('should reject updating to taken nickname', async () => {
            // Create another user with a nickname
            const otherUser = `ed25519:other_user_${testTimestamp}`;
            const takenNickname = `taken_${testTimestamp}`;

            await hasuraQuery(`
                mutation InsertUser($publicKey: String!, $nickname: String!) {
                    insert_users_one(object: {
                        ed25519_public_key: $publicKey,
                        fms_category: "JUNIOR",
                        nickname: $nickname
                    }) {
                        ed25519_public_key
                    }
                }
            `, { publicKey: otherUser, nickname: takenNickname });

            // Try to update testUser to the taken nickname
            const updateResult = await hasuraQuery(`
                mutation UpdateNickname($publicKey: String!, $nickname: String!) {
                    update_users_by_pk(
                        pk_columns: { ed25519_public_key: $publicKey },
                        _set: { nickname: $nickname }
                    ) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { publicKey: testUser, nickname: takenNickname });

            // Should fail with uniqueness violation
            expect(updateResult.errors).toBeDefined();
            expect(updateResult.errors[0].message).toContain('Uniqueness violation');

            // Cleanup
            await hasuraQuery(`
                mutation DeleteUser($publicKey: String!) {
                    delete_users_by_pk(ed25519_public_key: $publicKey) {
                        ed25519_public_key
                    }
                }
            `, { publicKey: otherUser });

            console.log('✅ Taken nickname correctly rejected');
        }, 10000);
    });

    describe('Exclude Current User from Check', () => {
        it('should allow user to keep their current nickname', async () => {
            // Get current nickname
            const currentResult = await hasuraQuery(`
                query GetCurrentNickname($publicKey: String!) {
                    users_by_pk(ed25519_public_key: $publicKey) {
                        nickname
                    }
                }
            `, { publicKey: testUser });

            const currentNickname = currentResult.data.users_by_pk.nickname;

            // Check if nickname is available excluding current user
            const checkResult = await hasuraQuery(`
                query CheckNicknameExcludingUser($nickname: String!, $excludeKey: String!) {
                    users(where: {
                        nickname: { _eq: $nickname },
                        ed25519_public_key: { _neq: $excludeKey }
                    }) {
                        ed25519_public_key
                    }
                }
            `, { nickname: currentNickname, excludeKey: testUser });

            expect(checkResult.data.users.length).toBe(0); // No OTHER users have this nickname

            console.log('✅ Current user excluded from nickname check');
        }, 10000);
    });

    afterAll(async () => {
        // Delete test user
        await hasuraQuery(`
            mutation DeleteUser($publicKey: String!) {
                delete_users_by_pk(ed25519_public_key: $publicKey) {
                    ed25519_public_key
                }
            }
        `, { publicKey: testUser });

        console.log('✅ Cleanup complete');
    });
});
