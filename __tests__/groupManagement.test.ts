/**
 * Group Management Integration Tests (TDD)
 * Tests for: removing users from group, transferring ownership
 */

import * as GroupService from '../groupManagementService';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function hasuraQuery(query: string, variables?: any) {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ query, variables })
    });
    return response.json();
}

describe('Group Management Tests', () => {
    const testTimestamp = Date.now();
    const owner = `ed25519:grp_owner_${testTimestamp}`;
    const member1 = `ed25519:grp_m1_${testTimestamp}`;
    const member2 = `ed25519:grp_m2_${testTimestamp}`;
    let groupId: string;

    beforeAll(async () => {
        // Create test users
        await hasuraQuery(`
            mutation CreateUsers($owner: String!, $m1: String!, $m2: String!) {
                u1: insert_users_one(object: { ed25519_public_key: $owner, fms_category: "JUNIOR" }) {
                    ed25519_public_key
                }
                u2: insert_users_one(object: { ed25519_public_key: $m1, fms_category: "JUNIOR" }) {
                    ed25519_public_key
                }
                u3: insert_users_one(object: { ed25519_public_key: $m2, fms_category: "JUNIOR" }) {
                    ed25519_public_key
                }
            }
        `, { owner, m1: member1, m2: member2 });

        // Create a group
        groupId = `grp_${testTimestamp}`;
        await hasuraQuery(`
            mutation CreateGroup($groupId: String!, $owner: String!) {
                insert_user_groups_one(object: {
                    group_id: $groupId,
                    group_name: "Test Group",
                    created_by: $owner
                }) {
                    group_id
                }
            }
        `, { groupId, owner });

        // Add all as members (using on_conflict to avoid duplicate key errors)
        await hasuraQuery(`
            mutation AddMembers($groupId: String!, $owner: String!, $m1: String!, $m2: String!) {
                o: insert_group_members_one(
                    object: { group_id: $groupId, user_public_key: $owner, is_admin: true },
                    on_conflict: { constraint: group_members_pkey, update_columns: [is_admin] }
                ) { id }
                m1: insert_group_members_one(
                    object: { group_id: $groupId, user_public_key: $m1, is_admin: false },
                    on_conflict: { constraint: group_members_pkey, update_columns: [is_admin] }
                ) { id }
                m2: insert_group_members_one(
                    object: { group_id: $groupId, user_public_key: $m2, is_admin: false },
                    on_conflict: { constraint: group_members_pkey, update_columns: [is_admin] }
                ) { id }
            }
        `, { groupId, owner, m1: member1, m2: member2 });

        console.log('✅ Test setup complete');
    }, 30000);

    describe('Remove User from Group', () => {
        it('should remove a member using service', async () => {
            const result = await GroupService.removeMemberFromGroup(groupId, member1);
            expect(result).toBe(true);

            // Verify removal
            const members = await GroupService.getGroupMembers(groupId);
            const stillMember = members.find(m => m.user_public_key === member1);
            expect(stillMember).toBeUndefined();

            console.log('✅ Member removed from group');
        }, 15000);

        it('should allow user to leave group using service', async () => {
            const result = await GroupService.leaveGroup(groupId, member2);
            expect(result).toBe(true);

            console.log('✅ User left group voluntarily');
        }, 15000);
    });

    describe('Admin and Owner Checks', () => {
        it('should correctly identify group owner', async () => {
            const isOwner = await GroupService.isGroupOwner(groupId, owner);
            expect(isOwner).toBe(true);

            const notOwner = await GroupService.isGroupOwner(groupId, member1);
            expect(notOwner).toBe(false);

            console.log('✅ Owner check works correctly');
        }, 15000);

        it('should correctly identify group admin', async () => {
            const isAdmin = await GroupService.isGroupAdmin(groupId, owner);
            expect(isAdmin).toBe(true);

            console.log('✅ Admin check works correctly');
        }, 15000);
    });

    describe('Transfer Group Ownership', () => {
        it('should transfer ownership to another member', async () => {
            // First re-add member1 to transfer ownership to them
            await hasuraQuery(`
                mutation ReAddMember($groupId: String!, $m1: String!) {
                    insert_group_members_one(
                        object: { group_id: $groupId, user_public_key: $m1, is_admin: false },
                        on_conflict: { constraint: group_members_pkey, update_columns: [is_admin] }
                    ) { id }
                }
            `, { groupId, m1: member1 });

            // Transfer ownership
            const result = await GroupService.transferGroupOwnership(groupId, owner, member1);
            expect(result).toBe(true);

            // Verify new owner
            const isNewOwner = await GroupService.isGroupOwner(groupId, member1);
            expect(isNewOwner).toBe(true);

            // Verify new owner is admin
            const isNewAdmin = await GroupService.isGroupAdmin(groupId, member1);
            expect(isNewAdmin).toBe(true);

            console.log('✅ Ownership transferred successfully');
        }, 15000);

        it('should fail if non-owner tries to transfer', async () => {
            // Try to transfer from non-owner (member2)
            await hasuraQuery(`
                mutation ReAddMember($groupId: String!, $m2: String!) {
                    insert_group_members_one(
                        object: { group_id: $groupId, user_public_key: $m2, is_admin: false },
                        on_conflict: { constraint: group_members_pkey, update_columns: [is_admin] }
                    ) { id }
                }
            `, { groupId, m2: member2 });

            await expect(
                GroupService.transferGroupOwnership(groupId, member2, owner)
            ).rejects.toThrow('Only the group owner can transfer ownership');

            console.log('✅ Non-owner transfer correctly rejected');
        }, 15000);
    });

    afterAll(async () => {
        await hasuraQuery(`
            mutation Cleanup($groupId: String!, $owner: String!, $m1: String!, $m2: String!) {
                delete_group_members(where: { group_id: { _eq: $groupId } }) { affected_rows }
                delete_user_groups(where: { group_id: { _eq: $groupId } }) { affected_rows }
                delete_users(where: { ed25519_public_key: { _in: [$owner, $m1, $m2] } }) { affected_rows }
            }
        `, { groupId, owner, m1: member1, m2: member2 });

        console.log('✅ Test cleanup complete');
    }, 15000);
});
