/**
 * Group Service - Client-side group management
 * Handles all group CRUD operations via Hasura GraphQL
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// ==================== TYPES ====================

interface GroupMember {
    user_public_key: string;
    is_admin: boolean;
    joined_at?: string;
}

interface Group {
    group_id: string;
    group_name: string;
    created_by: string;
    created_at?: string;
    members: GroupMember[];
}

interface UserGroup {
    is_admin: boolean;
    group: Group;
}

// ==================== HELPER ====================

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

    if (data.errors) {
        throw new Error(data.errors[0].message);
    }

    return data.data;
}

// ==================== CREATE GROUP ====================

export async function createGroup(
    groupName: string,
    creatorPublicKey: string
): Promise<Group> {
    // Generate client-side group ID for blockchain compatibility
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const mutation = `
        mutation CreateGroup($groupId: String!, $groupName: String!, $createdBy: String!) {
            insert_user_groups_one(object: {
                group_id: $groupId,
                group_name: $groupName,
                created_by: $createdBy,
                members: {
                    data: [{
                        user_public_key: $createdBy,
                        is_admin: true
                    }]
                }
            }) {
                group_id
                group_name
                created_by
                created_at
                members {
                    user_public_key
                    is_admin
                    joined_at
                }
            }
        }
    `;

    const data = await hasuraQuery(mutation, {
        groupId,
        groupName,
        createdBy: creatorPublicKey
    });

    return data.insert_user_groups_one;
}

// ==================== ADD MEMBERS ====================

export async function addMembers(
    groupId: string,
    userPublicKeys: string[]
): Promise<GroupMember[]> {
    const mutation = `
        mutation AddGroupMembers($members: [group_members_insert_input!]!) {
            insert_group_members(objects: $members) {
                returning {
                    group_id
                    user_public_key
                    is_admin
                    joined_at
                }
            }
        }
    `;

    const members = userPublicKeys.map(publicKey => ({
        group_id: groupId,
        user_public_key: publicKey,
        is_admin: false
    }));

    const data = await hasuraQuery(mutation, { members });

    return data.insert_group_members.returning;
}

// ==================== REMOVE MEMBER ====================

export async function removeMember(
    groupId: string,
    userPublicKey: string
): Promise<{ affected_rows: number }> {
    const mutation = `
        mutation RemoveMember($groupId: String!, $userPublicKey: String!) {
            delete_group_members(
                where: {
                    group_id: { _eq: $groupId },
                    user_public_key: { _eq: $userPublicKey }
                }
            ) {
                affected_rows
            }
        }
    `;

    const data = await hasuraQuery(mutation, { groupId, userPublicKey });

    return data.delete_group_members;
}

// ==================== TRANSFER ADMIN ====================

export async function transferAdmin(
    groupId: string,
    newAdminPublicKey: string
): Promise<GroupMember> {
    const mutation = `
        mutation TransferAdmin($groupId: String!, $newAdminKey: String!) {
            update_group_members(
                where: {
                    group_id: { _eq: $groupId },
                    user_public_key: { _eq: $newAdminKey }
                },
                _set: { is_admin: true }
            ) {
                returning {
                    user_public_key
                    is_admin
                    joined_at
                }
            }
        }
    `;

    const data = await hasuraQuery(mutation, {
        groupId,
        newAdminKey: newAdminPublicKey
    });

    return data.update_group_members.returning[0];
}

// ==================== REMOVE ADMIN ====================

export async function removeAdmin(
    groupId: string,
    userPublicKey: string
): Promise<GroupMember> {
    const mutation = `
        mutation RemoveAdmin($groupId: String!, $userKey: String!) {
            update_group_members(
                where: {
                    group_id: { _eq: $groupId },
                    user_public_key: { _eq: $userKey }
                },
                _set: { is_admin: false }
            ) {
                returning {
                    user_public_key
                    is_admin
                }
            }
        }
    `;

    const data = await hasuraQuery(mutation, {
        groupId,
        userKey: userPublicKey
    });

    return data.update_group_members.returning[0];
}

// ==================== GET USER GROUPS ====================

export async function getUserGroups(userPublicKey: string): Promise<UserGroup[]> {
    const query = `
        query GetUserGroups($userPublicKey: String!) {
            group_members(where: { user_public_key: { _eq: $userPublicKey } }) {
                is_admin
                joined_at
                group {
                    group_id
                    group_name
                    created_by
                    created_at
                    members {
                        user_public_key
                        is_admin
                        joined_at
                    }
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { userPublicKey });

    return data.group_members;
}

// ==================== GET GROUP MEMBERS ====================

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const query = `
        query GetGroupMembers($groupId: String!) {
            group_members(where: { group_id: { _eq: $groupId } }) {
                user_public_key
                is_admin
                joined_at
            }
        }
    `;

    const data = await hasuraQuery(query, { groupId });

    return data.group_members;
}

// ==================== DELETE GROUP ====================

export async function deleteGroup(groupId: string): Promise<{ group_id: string }> {
    const mutation = `
        mutation DeleteGroup($groupId: String!) {
            delete_user_groups_by_pk(group_id: $groupId) {
                group_id
            }
        }
    `;

    const data = await hasuraQuery(mutation, { groupId });

    return data.delete_user_groups_by_pk;
}

// ==================== FIND GROUP BY NAME ====================

export async function findGroupByName(groupName: string): Promise<Group | null> {
    const query = `
        query FindGroup($groupName: String!) {
            user_groups(where: { group_name: { _eq: $groupName } }) {
                group_id
                group_name
                created_by
                created_at
                members {
                    user_public_key
                    is_admin
                    joined_at
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { groupName });

    return data.user_groups.length > 0 ? data.user_groups[0] : null;
}

// ==================== JOIN GROUP BY NAME ====================

export async function joinGroupByName(
    groupName: string,
    userPublicKey: string
): Promise<GroupMember> {
    const group = await findGroupByName(groupName);
    if (!group) {
        throw new Error('Группа не найдена');
    }

    const members = await addMembers(group.group_id, [userPublicKey]);
    return members[0];
}
