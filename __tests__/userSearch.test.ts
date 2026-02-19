/**
 * User Search Integration Tests (TDD)
 * Tests for searching participants by nickname and publickey
 * No mocks - tests against real Hasura database
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

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

describe('User Search Integration Tests', () => {
    const testTimestamp = Date.now();
    const testUser1 = `ed25519:search_test_user1_${testTimestamp}`;
    const testUser2 = `ed25519:search_test_user2_${testTimestamp}`;
    const testUser3 = `ed25519:search_test_user3_${testTimestamp}`;
    const nickname1 = `SearchTestAlpha${testTimestamp}`;
    const nickname2 = `SearchTestBeta${testTimestamp}`;
    const nickname3 = `DifferentNick${testTimestamp}`;

    beforeAll(async () => {
        // Create test users with nicknames
        const createUser = async (publicKey: string, nickname: string) => {
            const result = await hasuraQuery(`
                mutation InsertUser($publicKey: String!, $nickname: String!) {
                    insert_users_one(object: {
                        ed25519_public_key: $publicKey,
                        fms_category: "JUNIOR",
                        nickname: $nickname
                    }) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { publicKey, nickname });

            if (result.errors) {
                console.error('Create user error:', result.errors);
            }
        };

        await createUser(testUser1, nickname1);
        await createUser(testUser2, nickname2);
        await createUser(testUser3, nickname3);
    });

    describe('Search by Nickname', () => {
        it('should find users by exact nickname', async () => {
            const result = await hasuraQuery(`
                query SearchByNickname($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                        nickname
                        fms_category
                    }
                }
            `, { nickname: nickname1 });

            if (result.errors) {
                console.error('SearchByNickname errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.users).toBeDefined();
            expect(result.data.users.length).toBe(1);
            expect(result.data.users[0].nickname).toBe(nickname1);

            console.log('✅ Found user by exact nickname');
        }, 10000);

        it('should find users by partial nickname (case-insensitive, like)', async () => {
            const result = await hasuraQuery(`
                query SearchByNicknamePartial($pattern: String!) {
                    users(where: { nickname: { _ilike: $pattern } }) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { pattern: `%SearchTest%` });

            if (result.errors) {
                console.error('SearchByNicknamePartial errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.users).toBeDefined();
            expect(result.data.users.length).toBeGreaterThanOrEqual(2);

            console.log('✅ Found', result.data.users.length, 'users by partial nickname');
        }, 10000);

        it('should return empty for non-existent nickname', async () => {
            const result = await hasuraQuery(`
                query SearchByNickname($nickname: String!) {
                    users(where: { nickname: { _eq: $nickname } }) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { nickname: 'NonExistentNickname12345' });

            expect(result.data).toBeDefined();
            expect(result.data.users).toBeDefined();
            expect(result.data.users.length).toBe(0);

            console.log('✅ Empty result for non-existent nickname');
        }, 10000);

        it('should be case-insensitive when using _ilike', async () => {
            const result = await hasuraQuery(`
                query SearchByNicknameCaseInsensitive($pattern: String!) {
                    users(where: { nickname: { _ilike: $pattern } }) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { pattern: `%searchtest%` }); // lowercase

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBeGreaterThanOrEqual(2);

            console.log('✅ Case-insensitive search works');
        }, 10000);
    });

    describe('Search by Public Key', () => {
        it('should find user by exact public key', async () => {
            const result = await hasuraQuery(`
                query SearchByPublicKey($publicKey: String!) {
                    users(where: { ed25519_public_key: { _eq: $publicKey } }) {
                        ed25519_public_key
                        nickname
                        fms_category
                    }
                }
            `, { publicKey: testUser1 });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBe(1);
            expect(result.data.users[0].ed25519_public_key).toBe(testUser1);

            console.log('✅ Found user by exact public key');
        }, 10000);

        it('should find users by public key prefix', async () => {
            const prefix = `ed25519:search_test_user`;
            const result = await hasuraQuery(`
                query SearchByPublicKeyPrefix($pattern: String!) {
                    users(where: { ed25519_public_key: { _like: $pattern } }) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { pattern: `${prefix}%` });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBeGreaterThanOrEqual(3);

            console.log('✅ Found', result.data.users.length, 'users by public key prefix');
        }, 10000);
    });

    describe('Combined Search', () => {
        it('should search by nickname OR public key', async () => {
            const result = await hasuraQuery(`
                query CombinedSearch($nicknamePattern: String!, $keyPattern: String!) {
                    users(where: {
                        _or: [
                            { nickname: { _ilike: $nicknamePattern } },
                            { ed25519_public_key: { _like: $keyPattern } }
                        ]
                    }, limit: 20) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, {
                nicknamePattern: '%DifferentNick%',
                keyPattern: `${testUser1.substring(0, 30)}%`
            });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Combined search works, found:', result.data.users.length);
        }, 10000);
    });

    describe('Search with Limit', () => {
        it('should respect limit parameter', async () => {
            const result = await hasuraQuery(`
                query SearchWithLimit($pattern: String!, $limit: Int!) {
                    users(where: { nickname: { _ilike: $pattern } }, limit: $limit) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { pattern: '%SearchTest%', limit: 1 });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBeLessThanOrEqual(1);

            console.log('✅ Limit parameter respected');
        }, 10000);
    });

    describe('Search with Ordering', () => {
        it('should order results by nickname', async () => {
            const result = await hasuraQuery(`
                query SearchWithOrder($pattern: String!) {
                    users(
                        where: { nickname: { _ilike: $pattern } },
                        order_by: { nickname: asc }
                    ) {
                        ed25519_public_key
                        nickname
                    }
                }
            `, { pattern: '%SearchTest%' });

            expect(result.data).toBeDefined();
            expect(result.data.users.length).toBeGreaterThanOrEqual(2);

            // Verify ordering
            if (result.data.users.length >= 2) {
                const first = result.data.users[0].nickname;
                const second = result.data.users[1].nickname;
                expect(first.localeCompare(second)).toBeLessThanOrEqual(0);
            }

            console.log('✅ Ordering works');
        }, 10000);
    });

    afterAll(async () => {
        // Delete test users
        const deleteUser = async (publicKey: string) => {
            await hasuraQuery(`
                mutation DeleteUser($publicKey: String!) {
                    delete_users_by_pk(ed25519_public_key: $publicKey) {
                        ed25519_public_key
                    }
                }
            `, { publicKey });
        };

        await deleteUser(testUser1);
        await deleteUser(testUser2);
        await deleteUser(testUser3);

        console.log('✅ Cleanup complete');
    });
});
