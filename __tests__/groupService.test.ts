/**
 * Group Service Tests (TDD - RED Phase)
 * These tests will FAIL until we create groupService.ts
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('Group Service (TDD)', () => {
    const testUser1 = `ed25519:group_svc_test1_${Date.now()}`;
    const testUser2 = `ed25519:group_svc_test2_${Date.now()}`;
    let testGroupId: string;

    beforeAll(async () => {
        // Create test users
        const createUser = async (publicKey: string) => {
            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `mutation { insert_users_one(object: {ed25519_public_key: "${publicKey}", fms_category: "JUNIOR"}) { ed25519_public_key } }`
                })
            });
        };

        await createUser(testUser1);
        await createUser(testUser2);
    });

    describe('createGroup', () => {
        it('should create group with client-generated ID', async () => {
            const { createGroup } = require('../groupService');

            const result = await createGroup('Test Fitness Group', testUser1);

            expect(result).toBeDefined();
            expect(result.group_id).toBeDefined();
            expect(result.group_name).toBe('Test Fitness Group');
            expect(result.created_by).toBe(testUser1);

            testGroupId = result.group_id;
        });

        it('should make creator admin automatically', async () => {
            const { createGroup } = require('../groupService');

            const result = await createGroup('Admin Test Group', testUser1);

            expect(result.members).toBeDefined();
            expect(result.members.length).toBe(1);
            expect(result.members[0].user_public_key).toBe(testUser1);
            expect(result.members[0].is_admin).toBe(true);
        });

        it('should return group with members', async () => {
            const { createGroup } = require('../groupService');

            const result = await createGroup('Members Test', testUser1);

            expect(Array.isArray(result.members)).toBe(true);
        });
    });

    describe('addMembers', () => {
        it('should add multiple members', async () => {
            const { addMembers } = require('../groupService');

            const result = await addMembers(testGroupId, [testUser2]);

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].user_public_key).toBe(testUser2);
            expect(result[0].is_admin).toBe(false);
        });

        it('should prevent duplicate membership', async () => {
            const { addMembers } = require('../groupService');

            await expect(
                addMembers(testGroupId, [testUser2])
            ).rejects.toThrow();
        });
    });

    describe('removeMember', () => {
        it('should remove member from group', async () => {
            const { removeMember } = require('../groupService');

            const result = await removeMember(testGroupId, testUser2);

            expect(result).toBeDefined();
            expect(result.affected_rows).toBe(1);
        });
    });

    describe('transferAdmin', () => {
        beforeAll(async () => {
            // Re-add testUser2
            const { addMembers } = require('../groupService');
            await addMembers(testGroupId, [testUser2]);
        });

        it('should transfer admin rights', async () => {
            const { transferAdmin } = require('../groupService');

            const result = await transferAdmin(testGroupId, testUser2);

            expect(result).toBeDefined();
            expect(result.is_admin).toBe(true);
        });

        it('should allow multiple admins', async () => {
            const { getUserGroups } = require('../groupService');

            const groups = await getUserGroups(testUser1);
            const group = groups.find((g: any) => g.group.group_id === testGroupId);

            const admins = group.group.members.filter((m: any) => m.is_admin);
            expect(admins.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getUserGroups', () => {
        it('should return all user groups', async () => {
            const { getUserGroups } = require('../groupService');

            const groups = await getUserGroups(testUser1);

            expect(Array.isArray(groups)).toBe(true);
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should include member count', async () => {
            const { getUserGroups } = require('../groupService');

            const groups = await getUserGroups(testUser1);
            const group = groups[0];

            expect(group.group).toBeDefined();
            expect(Array.isArray(group.group.members)).toBe(true);
            expect(group.group.members.length).toBeGreaterThan(0);
        });
    });

    afterAll(async () => {
        // Cleanup
        const deleteGroup = async (groupId: string) => {
            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `mutation { delete_user_groups_by_pk(group_id: "${groupId}") { group_id } }`
                })
            });
        };

        const deleteUser = async (publicKey: string) => {
            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `mutation { delete_users_by_pk(ed25519_public_key: "${publicKey}") { ed25519_public_key } }`
                })
            });
        };

        if (testGroupId) await deleteGroup(testGroupId);
        await deleteUser(testUser1);
        await deleteUser(testUser2);
    });
});
