/**
 * User Follows Integration Tests (TDD)
 * Tests for FOLLOWING/FOLLOWER relationships
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

describe('User Follows Integration Tests', () => {
    const testUser1 = `ed25519:follows_test_user1_${Date.now()}`;
    const testUser2 = `ed25519:follows_test_user2_${Date.now()}`;
    const testUser3 = `ed25519:follows_test_user3_${Date.now()}`;

    beforeAll(async () => {
        // Create test users
        const createUser = async (publicKey: string) => {
            await hasuraQuery(`
                mutation InsertUser($publicKey: String!) {
                    insert_users_one(object: {
                        ed25519_public_key: $publicKey,
                        fms_category: "JUNIOR"
                    }) {
                        ed25519_public_key
                    }
                }
            `, { publicKey });
        };

        await createUser(testUser1);
        await createUser(testUser2);
        await createUser(testUser3);
    });

    describe('Follow User', () => {
        it('should create a follow relationship', async () => {
            const result = await hasuraQuery(`
                mutation FollowUser($follower: String!, $followee: String!) {
                    insert_user_follows_one(object: {
                        follower_public_key: $follower,
                        followee_public_key: $followee
                    }) {
                        id
                        follower_public_key
                        followee_public_key
                        created_at
                    }
                }
            `, {
                follower: testUser1,
                followee: testUser2
            });

            if (result.errors) {
                console.error('FollowUser errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_follows_one).toBeDefined();
            expect(result.data.insert_user_follows_one.follower_public_key).toBe(testUser1);
            expect(result.data.insert_user_follows_one.followee_public_key).toBe(testUser2);

            console.log('✅ Follow relationship created');
        }, 10000);

        it('should prevent duplicate follow relationships', async () => {
            // Try to follow again
            const result = await hasuraQuery(`
                mutation FollowUser($follower: String!, $followee: String!) {
                    insert_user_follows_one(object: {
                        follower_public_key: $follower,
                        followee_public_key: $followee
                    }) {
                        id
                    }
                }
            `, {
                follower: testUser1,
                followee: testUser2
            });

            expect(result.errors).toBeDefined();
            expect(result.errors[0].message).toContain('Uniqueness violation');

            console.log('✅ Duplicate prevention working');
        }, 10000);

        it('should allow following multiple users', async () => {
            const result = await hasuraQuery(`
                mutation FollowUser($follower: String!, $followee: String!) {
                    insert_user_follows_one(object: {
                        follower_public_key: $follower,
                        followee_public_key: $followee
                    }) {
                        id
                    }
                }
            `, {
                follower: testUser1,
                followee: testUser3
            });

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_follows_one).toBeDefined();

            console.log('✅ User1 now follows User2 and User3');
        }, 10000);
    });

    describe('Get Followers', () => {
        it('should return list of followers', async () => {
            const result = await hasuraQuery(`
                query GetFollowers($userPublicKey: String!) {
                    user_follows(where: { followee_public_key: { _eq: $userPublicKey } }) {
                        follower_public_key
                        created_at
                    }
                }
            `, { userPublicKey: testUser2 });

            if (result.errors) {
                console.error('GetFollowers errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.user_follows).toBeDefined();
            expect(result.data.user_follows.length).toBeGreaterThanOrEqual(1);
            expect(result.data.user_follows[0].follower_public_key).toBe(testUser1);

            console.log('✅ Retrieved followers:', result.data.user_follows.length);
        }, 10000);
    });

    describe('Get Following', () => {
        it('should return list of users being followed', async () => {
            const result = await hasuraQuery(`
                query GetFollowing($userPublicKey: String!) {
                    user_follows(where: { follower_public_key: { _eq: $userPublicKey } }) {
                        followee_public_key
                        created_at
                    }
                }
            `, { userPublicKey: testUser1 });

            if (result.errors) {
                console.error('GetFollowing errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.user_follows).toBeDefined();
            expect(result.data.user_follows.length).toBeGreaterThanOrEqual(2);

            console.log('✅ User1 is following:', result.data.user_follows.length, 'users');
        }, 10000);
    });

    describe('Check If Following', () => {
        it('should return true if following', async () => {
            const result = await hasuraQuery(`
                query IsFollowing($follower: String!, $followee: String!) {
                    user_follows(where: {
                        follower_public_key: { _eq: $follower },
                        followee_public_key: { _eq: $followee }
                    }) {
                        id
                    }
                }
            `, {
                follower: testUser1,
                followee: testUser2
            });

            expect(result.data).toBeDefined();
            expect(result.data.user_follows.length).toBe(1);

            console.log('✅ Is following check works');
        }, 10000);

        it('should return empty if not following', async () => {
            const result = await hasuraQuery(`
                query IsFollowing($follower: String!, $followee: String!) {
                    user_follows(where: {
                        follower_public_key: { _eq: $follower },
                        followee_public_key: { _eq: $followee }
                    }) {
                        id
                    }
                }
            `, {
                follower: testUser2, // User2 doesn't follow User1
                followee: testUser1
            });

            expect(result.data).toBeDefined();
            expect(result.data.user_follows.length).toBe(0);

            console.log('✅ Not following check works');
        }, 10000);
    });

    describe('Unfollow User', () => {
        it('should remove follow relationship', async () => {
            const result = await hasuraQuery(`
                mutation UnfollowUser($follower: String!, $followee: String!) {
                    delete_user_follows(where: {
                        follower_public_key: { _eq: $follower },
                        followee_public_key: { _eq: $followee }
                    }) {
                        affected_rows
                    }
                }
            `, {
                follower: testUser1,
                followee: testUser3
            });

            expect(result.data).toBeDefined();
            expect(result.data.delete_user_follows.affected_rows).toBe(1);

            console.log('✅ Unfollowed successfully');
        }, 10000);

        it('should not fail when unfollowing non-existent relationship', async () => {
            const result = await hasuraQuery(`
                mutation UnfollowUser($follower: String!, $followee: String!) {
                    delete_user_follows(where: {
                        follower_public_key: { _eq: $follower },
                        followee_public_key: { _eq: $followee }
                    }) {
                        affected_rows
                    }
                }
            `, {
                follower: testUser3,
                followee: testUser1
            });

            expect(result.data).toBeDefined();
            expect(result.data.delete_user_follows.affected_rows).toBe(0);

            console.log('✅ Unfollowing non-existent relationship handled');
        }, 10000);
    });

    describe('Followers/Following Count', () => {
        it('should get followers count', async () => {
            const result = await hasuraQuery(`
                query GetFollowersCount($userPublicKey: String!) {
                    user_follows_aggregate(where: { followee_public_key: { _eq: $userPublicKey } }) {
                        aggregate {
                            count
                        }
                    }
                }
            `, { userPublicKey: testUser2 });

            expect(result.data).toBeDefined();
            expect(result.data.user_follows_aggregate.aggregate.count).toBeGreaterThanOrEqual(1);

            console.log('✅ Followers count:', result.data.user_follows_aggregate.aggregate.count);
        }, 10000);

        it('should get following count', async () => {
            const result = await hasuraQuery(`
                query GetFollowingCount($userPublicKey: String!) {
                    user_follows_aggregate(where: { follower_public_key: { _eq: $userPublicKey } }) {
                        aggregate {
                            count
                        }
                    }
                }
            `, { userPublicKey: testUser1 });

            expect(result.data).toBeDefined();
            expect(result.data.user_follows_aggregate.aggregate.count).toBeGreaterThanOrEqual(1);

            console.log('✅ Following count:', result.data.user_follows_aggregate.aggregate.count);
        }, 10000);
    });

    afterAll(async () => {
        // Cleanup: delete follow relationships
        await hasuraQuery(`
            mutation DeleteFollows($user1: String!, $user2: String!, $user3: String!) {
                delete_user_follows(where: {
                    _or: [
                        { follower_public_key: { _eq: $user1 } },
                        { follower_public_key: { _eq: $user2 } },
                        { follower_public_key: { _eq: $user3 } }
                    ]
                }) {
                    affected_rows
                }
            }
        `, { user1: testUser1, user2: testUser2, user3: testUser3 });

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
