/**
 * User Relations Service
 * Handles user relationships (FOLLOWER, TEACHER) via Hasura GraphQL
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// ==================== TYPES ====================

export type RelationType = 'FOLLOWER' | 'TEACHER';

export interface UserRelation {
    id: number;
    from_user_key: string;
    to_user_key: string;
    relation_type: RelationType;
    created_at: string;
}

// ==================== HELPER ====================

async function hasuraQuery(query: string, variables?: any): Promise<any> {
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

// ==================== CREATE RELATION ====================

/**
 * Create a relation between two users
 * @param fromUserKey - User creating the relation
 * @param toUserKey - Target user
 * @param relationType - Type of relation (FOLLOWER, TEACHER)
 * @returns Created relation
 */
export async function createRelation(
    fromUserKey: string,
    toUserKey: string,
    relationType: RelationType
): Promise<UserRelation> {
    const mutation = `
        mutation CreateRelation($from: String!, $to: String!, $type: String!) {
            insert_user_relations_one(object: {
                from_user_key: $from,
                to_user_key: $to,
                relation_type: $type
            }) {
                id
                from_user_key
                to_user_key
                relation_type
                created_at
            }
        }
    `;

    const data = await hasuraQuery(mutation, {
        from: fromUserKey,
        to: toUserKey,
        type: relationType
    });

    return data.insert_user_relations_one;
}

// ==================== REMOVE RELATION ====================

/**
 * Remove a relation between two users
 * @param fromUserKey - User who created the relation
 * @param toUserKey - Target user
 * @param relationType - Type of relation to remove
 * @returns Number of affected rows
 */
export async function removeRelation(
    fromUserKey: string,
    toUserKey: string,
    relationType: RelationType
): Promise<{ affected_rows: number }> {
    const mutation = `
        mutation RemoveRelation($from: String!, $to: String!, $type: String!) {
            delete_user_relations(where: {
                from_user_key: { _eq: $from },
                to_user_key: { _eq: $to },
                relation_type: { _eq: $type }
            }) {
                affected_rows
            }
        }
    `;

    const data = await hasuraQuery(mutation, {
        from: fromUserKey,
        to: toUserKey,
        type: relationType
    });

    return data.delete_user_relations;
}

// ==================== CHECK RELATION EXISTS ====================

/**
 * Check if a specific relation exists
 * @param fromUserKey - User who created the relation
 * @param toUserKey - Target user
 * @param relationType - Type of relation to check
 * @returns true if relation exists
 */
export async function hasRelation(
    fromUserKey: string,
    toUserKey: string,
    relationType: RelationType
): Promise<boolean> {
    const query = `
        query HasRelation($from: String!, $to: String!, $type: String!) {
            user_relations(where: {
                from_user_key: { _eq: $from },
                to_user_key: { _eq: $to },
                relation_type: { _eq: $type }
            }) {
                id
            }
        }
    `;

    const data = await hasuraQuery(query, {
        from: fromUserKey,
        to: toUserKey,
        type: relationType
    });

    return data.user_relations.length > 0;
}

// ==================== GET FOLLOWERS ====================

/**
 * Get all users who follow a specific user
 * @param userKey - User to get followers for
 * @returns Array of follower public keys
 */
export async function getFollowers(userKey: string): Promise<string[]> {
    const query = `
        query GetFollowers($userKey: String!) {
            user_relations(where: {
                to_user_key: { _eq: $userKey },
                relation_type: { _eq: "FOLLOWER" }
            }) {
                from_user_key
            }
        }
    `;

    const data = await hasuraQuery(query, { userKey });
    return data.user_relations.map((r: any) => r.from_user_key);
}

// ==================== GET FOLLOWING ====================

/**
 * Get all users that a specific user follows
 * @param userKey - User to get following for
 * @returns Array of followed user public keys
 */
export async function getFollowing(userKey: string): Promise<string[]> {
    const query = `
        query GetFollowing($userKey: String!) {
            user_relations(where: {
                from_user_key: { _eq: $userKey },
                relation_type: { _eq: "FOLLOWER" }
            }) {
                to_user_key
            }
        }
    `;

    const data = await hasuraQuery(query, { userKey });
    return data.user_relations.map((r: any) => r.to_user_key);
}

// ==================== GET STUDENTS ====================

/**
 * Get all students of a teacher
 * @param teacherKey - Teacher's public key
 * @returns Array of student public keys
 */
export async function getStudents(teacherKey: string): Promise<string[]> {
    const query = `
        query GetStudents($teacherKey: String!) {
            user_relations(where: {
                from_user_key: { _eq: $teacherKey },
                relation_type: { _eq: "TEACHER" }
            }) {
                to_user_key
            }
        }
    `;

    const data = await hasuraQuery(query, { teacherKey });
    return data.user_relations.map((r: any) => r.to_user_key);
}

// ==================== GET TEACHERS ====================

/**
 * Get all teachers of a student
 * @param studentKey - Student's public key
 * @returns Array of teacher public keys
 */
export async function getTeachers(studentKey: string): Promise<string[]> {
    const query = `
        query GetTeachers($studentKey: String!) {
            user_relations(where: {
                to_user_key: { _eq: $studentKey },
                relation_type: { _eq: "TEACHER" }
            }) {
                from_user_key
            }
        }
    `;

    const data = await hasuraQuery(query, { studentKey });
    return data.user_relations.map((r: any) => r.from_user_key);
}

// ==================== FOLLOW USER (CONVENIENCE) ====================

/**
 * Follow a user (convenience function)
 */
export async function followUser(followerKey: string, followeeKey: string): Promise<UserRelation> {
    return createRelation(followerKey, followeeKey, 'FOLLOWER');
}

/**
 * Unfollow a user (convenience function)
 */
export async function unfollowUser(followerKey: string, followeeKey: string): Promise<{ affected_rows: number }> {
    return removeRelation(followerKey, followeeKey, 'FOLLOWER');
}

/**
 * Check if following (convenience function)
 */
export async function isFollowing(followerKey: string, followeeKey: string): Promise<boolean> {
    return hasRelation(followerKey, followeeKey, 'FOLLOWER');
}

// ==================== TEACHER-STUDENT (CONVENIENCE) ====================

// New logic: User can SET someone as THEIR teacher
// TEACHER relation: from_user_key = student, to_user_key = teacher
// This is similar to FOLLOWER: I follow someone = I set someone as my teacher

/**
 * Set a user as my teacher (I become their student)
 * @param studentKey - My public key (student)
 * @param teacherKey - Teacher's public key
 */
export async function setMyTeacher(studentKey: string, teacherKey: string): Promise<UserRelation> {
    // First remove any existing teacher (only one allowed)
    await removeRelation(studentKey, '%', 'TEACHER').catch(() => { });
    // Set new teacher
    return createRelation(studentKey, teacherKey, 'TEACHER');
}

/**
 * Remove my current teacher
 * @param studentKey - My public key
 * @param teacherKey - Teacher's public key to remove
 */
export async function removeMyTeacher(studentKey: string, teacherKey: string): Promise<{ affected_rows: number }> {
    return removeRelation(studentKey, teacherKey, 'TEACHER');
}

/**
 * Check if a user is my teacher
 * @param studentKey - My public key
 * @param teacherKey - Potential teacher's public key
 */
export async function isMyTeacher(studentKey: string, teacherKey: string): Promise<boolean> {
    return hasRelation(studentKey, teacherKey, 'TEACHER');
}

/**
 * Get my teacher (if any)
 * @param studentKey - My public key
 * @returns Teacher's public key or null
 */
export async function getMyTeacher(studentKey: string): Promise<string | null> {
    const query = `
        query GetMyTeacher($studentKey: String!) {
            user_relations(where: {
                from_user_key: { _eq: $studentKey },
                relation_type: { _eq: "TEACHER" }
            }, limit: 1) {
                to_user_key
            }
        }
    `;

    const data = await hasuraQuery(query, { studentKey });
    if (data.user_relations.length > 0) {
        return data.user_relations[0].to_user_key;
    }
    return null;
}

// Keep old functions for backward compatibility but with corrected docs
/** @deprecated Use setMyTeacher instead */
export async function addStudent(teacherKey: string, studentKey: string): Promise<UserRelation> {
    return createRelation(teacherKey, studentKey, 'TEACHER');
}

/** @deprecated Use removeMyTeacher instead */
export async function removeStudent(teacherKey: string, studentKey: string): Promise<{ affected_rows: number }> {
    return removeRelation(teacherKey, studentKey, 'TEACHER');
}

/** @deprecated Use isMyTeacher instead */
export async function isTeacherOf(teacherKey: string, studentKey: string): Promise<boolean> {
    return hasRelation(teacherKey, studentKey, 'TEACHER');
}

// ==================== COUNTS ====================

/**
 * Get followers count for a user
 */
export async function getFollowersCount(userKey: string): Promise<number> {
    const query = `
        query GetFollowersCount($userKey: String!) {
            user_relations_aggregate(where: {
                to_user_key: { _eq: $userKey },
                relation_type: { _eq: "FOLLOWER" }
            }) {
                aggregate {
                    count
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { userKey });
    return data.user_relations_aggregate.aggregate.count;
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(userKey: string): Promise<number> {
    const query = `
        query GetFollowingCount($userKey: String!) {
            user_relations_aggregate(where: {
                from_user_key: { _eq: $userKey },
                relation_type: { _eq: "FOLLOWER" }
            }) {
                aggregate {
                    count
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { userKey });
    return data.user_relations_aggregate.aggregate.count;
}

/**
 * Get students count - number of users who set this user as their teacher
 */
export async function getStudentsCount(teacherKey: string): Promise<number> {
    const query = `
        query GetStudentsCount($teacherKey: String!) {
            user_relations_aggregate(where: {
                to_user_key: { _eq: $teacherKey },
                relation_type: { _eq: "TEACHER" }
            }) {
                aggregate {
                    count
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { teacherKey });
    return data.user_relations_aggregate.aggregate.count;
}
