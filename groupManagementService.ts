/**
 * Group Management Service
 * Handles group operations: removing members, transferring ownership
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function hasuraQuery(query: string, variables?: any, throwOnError = true): Promise<any> {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ query, variables })
    });
    const data = await response.json();
    if (data.errors && throwOnError) {
        throw new Error(data.errors[0].message);
    }
    return data.data || {};
}

// ==================== TYPES ====================

export interface GroupInfo {
    group_id: string;
    group_name: string;
    created_by: string;
}

export interface GroupMember {
    user_public_key: string;
    is_admin: boolean;
    joined_at: string;
}

// ==================== MEMBER MANAGEMENT ====================

/**
 * Remove a member from a group (admin only)
 */
export async function removeMemberFromGroup(
    groupId: string,
    userToRemove: string
): Promise<boolean> {
    const data = await hasuraQuery(`
        mutation RemoveMember($groupId: String!, $userKey: String!) {
            delete_group_members(where: {
                group_id: { _eq: $groupId },
                user_public_key: { _eq: $userKey }
            }) {
                affected_rows
            }
        }
    `, { groupId, userKey: userToRemove });

    return data.delete_group_members.affected_rows > 0;
}

/**
 * User leaves group voluntarily
 */
export async function leaveGroup(
    groupId: string,
    userKey: string
): Promise<boolean> {
    return removeMemberFromGroup(groupId, userKey);
}

/**
 * Check if user is admin of a group
 */
export async function isGroupAdmin(
    groupId: string,
    userKey: string
): Promise<boolean> {
    const data = await hasuraQuery(`
        query CheckAdmin($groupId: String!, $userKey: String!) {
            group_members(where: {
                group_id: { _eq: $groupId },
                user_public_key: { _eq: $userKey },
                is_admin: { _eq: true }
            }) {
                id
            }
        }
    `, { groupId, userKey });

    return data.group_members.length > 0;
}

/**
 * Check if user is the owner (creator) of a group
 */
export async function isGroupOwner(
    groupId: string,
    userKey: string
): Promise<boolean> {
    const data = await hasuraQuery(`
        query CheckOwner($groupId: String!) {
            user_groups_by_pk(group_id: $groupId) {
                created_by
            }
        }
    `, { groupId });

    return data.user_groups_by_pk?.created_by === userKey;
}

// ==================== OWNERSHIP TRANSFER ====================

/**
 * Transfer group ownership to another user
 * - Updates created_by field in user_groups
 * - Removes admin from old owner
 * - Makes new owner an admin
 */
export async function transferGroupOwnership(
    groupId: string,
    currentOwner: string,
    newOwner: string
): Promise<boolean> {
    // Verify current owner is actually the owner
    const isOwner = await isGroupOwner(groupId, currentOwner);
    if (!isOwner) {
        throw new Error('Only the group owner can transfer ownership');
    }

    // Check if new owner is a member
    const memberCheck = await hasuraQuery(`
        query CheckMember($groupId: String!, $userKey: String!) {
            group_members(where: {
                group_id: { _eq: $groupId },
                user_public_key: { _eq: $userKey }
            }) {
                id
            }
        }
    `, { groupId, userKey: newOwner });

    if (memberCheck.group_members.length === 0) {
        throw new Error('New owner must be a member of the group');
    }

    // Update group ownership
    await hasuraQuery(`
        mutation TransferOwnership($groupId: String!, $newOwner: String!) {
            update_user_groups_by_pk(
                pk_columns: { group_id: $groupId },
                _set: { created_by: $newOwner }
            ) {
                group_id
            }
        }
    `, { groupId, newOwner });

    // Update admin flags
    await hasuraQuery(`
        mutation UpdateAdmins($groupId: String!, $oldOwner: String!, $newOwner: String!) {
            removeOldAdmin: update_group_members(
                where: {
                    group_id: { _eq: $groupId },
                    user_public_key: { _eq: $oldOwner }
                },
                _set: { is_admin: false }
            ) {
                affected_rows
            }
            makeNewAdmin: update_group_members(
                where: {
                    group_id: { _eq: $groupId },
                    user_public_key: { _eq: $newOwner }
                },
                _set: { is_admin: true }
            ) {
                affected_rows
            }
        }
    `, { groupId, oldOwner: currentOwner, newOwner });

    return true;
}

// ==================== GET GROUP MEMBERS ====================

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const data = await hasuraQuery(`
        query GetMembers($groupId: String!) {
            group_members(
                where: { group_id: { _eq: $groupId } },
                order_by: { is_admin: desc }
            ) {
                user_public_key
                is_admin
                joined_at
            }
        }
    `, { groupId });

    return data.group_members;
}

/**
 * Get group info
 */
export async function getGroupInfo(groupId: string): Promise<GroupInfo | null> {
    const data = await hasuraQuery(`
        query GetGroup($groupId: String!) {
            user_groups_by_pk(group_id: $groupId) {
                group_id
                group_name
                created_by
            }
        }
    `, { groupId });

    return data.user_groups_by_pk;
}
