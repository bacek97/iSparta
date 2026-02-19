/**
 * Multi-Group Leaderboard Integration Tests (TDD)
 * Tests for multiple group membership and global leaderboard
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

describe('Multi-Group Leaderboard Integration Tests', () => {
    const testTimestamp = Date.now();
    const testUser1 = `ed25519:multigroup_user1_${testTimestamp}`;
    const testUser2 = `ed25519:multigroup_user2_${testTimestamp}`;
    const testUser3 = `ed25519:multigroup_user3_${testTimestamp}`;
    const testGroup1 = `group_test1_${testTimestamp}`;
    const testGroup2 = `group_test2_${testTimestamp}`;

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

        // Create test groups
        await hasuraQuery(`
            mutation CreateGroups($group1: user_groups_insert_input!, $group2: user_groups_insert_input!) {
                group1: insert_user_groups_one(object: $group1) {
                    group_id
                }
                group2: insert_user_groups_one(object: $group2) {
                    group_id
                }
            }
        `, {
            group1: {
                group_id: testGroup1,
                group_name: 'Test Group Alpha',
                created_by: testUser1
            },
            group2: {
                group_id: testGroup2,
                group_name: 'Test Group Beta',
                created_by: testUser2
            }
        });
    });

    describe('User Can Join Multiple Groups', () => {
        it('should allow user to join first group', async () => {
            const result = await hasuraQuery(`
                mutation JoinGroup($groupId: String!, $userKey: String!) {
                    insert_group_members_one(object: {
                        group_id: $groupId,
                        user_public_key: $userKey,
                        is_admin: true
                    }) {
                        id
                        group_id
                        user_public_key
                    }
                }
            `, {
                groupId: testGroup1,
                userKey: testUser1
            });

            if (result.errors) {
                console.error('JoinGroup1 errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.insert_group_members_one).toBeDefined();

            console.log('✅ User1 joined Group1');
        }, 10000);

        it('should allow same user to join second group', async () => {
            const result = await hasuraQuery(`
                mutation JoinGroup($groupId: String!, $userKey: String!) {
                    insert_group_members_one(object: {
                        group_id: $groupId,
                        user_public_key: $userKey,
                        is_admin: false
                    }) {
                        id
                        group_id
                        user_public_key
                    }
                }
            `, {
                groupId: testGroup2,
                userKey: testUser1
            });

            if (result.errors) {
                console.error('JoinGroup2 errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.insert_group_members_one).toBeDefined();

            console.log('✅ User1 joined Group2 (now in 2 groups)');
        }, 10000);

        it('should return all groups for user', async () => {
            const result = await hasuraQuery(`
                query GetUserGroups($userKey: String!) {
                    group_members(where: { user_public_key: { _eq: $userKey } }) {
                        group_id
                        is_admin
                        group {
                            group_name
                        }
                    }
                }
            `, { userKey: testUser1 });

            expect(result.data).toBeDefined();
            expect(result.data.group_members).toBeDefined();
            expect(result.data.group_members.length).toBe(2);

            const groupIds = result.data.group_members.map((m: any) => m.group_id);
            expect(groupIds).toContain(testGroup1);
            expect(groupIds).toContain(testGroup2);

            console.log('✅ User1 is in', result.data.group_members.length, 'groups');
        }, 10000);
    });

    describe('Global Leaderboard', () => {
        beforeAll(async () => {
            // Add User2 to Group2, User3 to no group
            await hasuraQuery(`
                mutation JoinGroup($groupId: String!, $userKey: String!) {
                    insert_group_members_one(object: {
                        group_id: $groupId,
                        user_public_key: $userKey,
                        is_admin: true
                    }) {
                        id
                    }
                }
            `, { groupId: testGroup2, userKey: testUser2 });
        });

        it('should return ALL users regardless of group', async () => {
            const result = await hasuraQuery(`
                query GetGlobalLeaderboard($limit: Int!) {
                    users(
                        order_by: { ed25519_public_key: asc },
                        limit: $limit
                    ) {
                        ed25519_public_key
                        fms_category
                    }
                }
            `, { limit: 100 });

            expect(result.data).toBeDefined();
            expect(result.data.users).toBeDefined();

            // All three test users should be in global leaderboard
            const keys = result.data.users.map((u: any) => u.ed25519_public_key);
            expect(keys).toContain(testUser1);
            expect(keys).toContain(testUser2);
            expect(keys).toContain(testUser3); // User3 is NOT in any group

            console.log('✅ Global leaderboard includes all users');
        }, 10000);

        it('should return users with workout stats aggregated', async () => {
            const result = await hasuraQuery(`
                query GetGlobalLeaderboardWithStats($limit: Int!) {
                    users(limit: $limit) {
                        ed25519_public_key
                        fms_category
                        workout_sessions_aggregate {
                            aggregate {
                                count
                                sum {
                                    total_points
                                }
                            }
                        }
                    }
                }
            `, { limit: 100 });

            expect(result.data).toBeDefined();
            expect(result.data.users).toBeDefined();
            expect(result.data.users[0]).toHaveProperty('workout_sessions_aggregate');

            console.log('✅ Global leaderboard includes workout stats');
        }, 10000);
    });

    describe('Group-Filtered Leaderboard', () => {
        it('should return only members of specific group', async () => {
            const result = await hasuraQuery(`
                query GetGroupLeaderboard($groupId: String!) {
                    group_members(where: { group_id: { _eq: $groupId } }) {
                        user_public_key
                        is_admin
                        user {
                            fms_category
                            workout_sessions_aggregate {
                                aggregate {
                                    count
                                    sum {
                                        total_points
                                    }
                                }
                            }
                        }
                    }
                }
            `, { groupId: testGroup1 });

            expect(result.data).toBeDefined();
            expect(result.data.group_members).toBeDefined();

            // Group1 only has User1
            expect(result.data.group_members.length).toBe(1);
            expect(result.data.group_members[0].user_public_key).toBe(testUser1);

            console.log('✅ Group1 leaderboard filtered correctly');
        }, 10000);

        it('should return different members for different group', async () => {
            const result = await hasuraQuery(`
                query GetGroupLeaderboard($groupId: String!) {
                    group_members(where: { group_id: { _eq: $groupId } }) {
                        user_public_key
                    }
                }
            `, { groupId: testGroup2 });

            expect(result.data).toBeDefined();

            // Group2 has User1 and User2
            expect(result.data.group_members.length).toBe(2);
            const keys = result.data.group_members.map((m: any) => m.user_public_key);
            expect(keys).toContain(testUser1);
            expect(keys).toContain(testUser2);
            expect(keys).not.toContain(testUser3);

            console.log('✅ Group2 leaderboard filtered correctly');
        }, 10000);
    });

    describe('Leave Group While Staying in Others', () => {
        it('should allow leaving one group while staying in another', async () => {
            // User1 leaves Group1
            const result = await hasuraQuery(`
                mutation LeaveGroup($groupId: String!, $userKey: String!) {
                    delete_group_members(where: {
                        group_id: { _eq: $groupId },
                        user_public_key: { _eq: $userKey }
                    }) {
                        affected_rows
                    }
                }
            `, {
                groupId: testGroup1,
                userKey: testUser1
            });

            expect(result.data).toBeDefined();
            expect(result.data.delete_group_members.affected_rows).toBe(1);

            console.log('✅ User1 left Group1');
        }, 10000);

        it('should still be in other group after leaving one', async () => {
            const result = await hasuraQuery(`
                query GetUserGroups($userKey: String!) {
                    group_members(where: { user_public_key: { _eq: $userKey } }) {
                        group_id
                    }
                }
            `, { userKey: testUser1 });

            expect(result.data).toBeDefined();
            expect(result.data.group_members.length).toBe(1);
            expect(result.data.group_members[0].group_id).toBe(testGroup2);

            console.log('✅ User1 still in Group2 after leaving Group1');
        }, 10000);
    });

    afterAll(async () => {
        // Cleanup: delete group members
        await hasuraQuery(`
            mutation DeleteMembers($group1: String!, $group2: String!) {
                delete_group_members(where: {
                    _or: [
                        { group_id: { _eq: $group1 } },
                        { group_id: { _eq: $group2 } }
                    ]
                }) {
                    affected_rows
                }
            }
        `, { group1: testGroup1, group2: testGroup2 });

        // Delete groups
        await hasuraQuery(`
            mutation DeleteGroups($group1: String!, $group2: String!) {
                g1: delete_user_groups_by_pk(group_id: $group1) { group_id }
                g2: delete_user_groups_by_pk(group_id: $group2) { group_id }
            }
        `, { group1: testGroup1, group2: testGroup2 });

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
