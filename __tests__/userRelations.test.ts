/**
 * User Relations Integration Tests (TDD)
 * Tests for flexible user relations (FOLLOWER, TEACHER)
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

describe('User Relations Integration Tests', () => {
    const testTimestamp = Date.now();
    const teacher = `ed25519:teacher_${testTimestamp}`;
    const student1 = `ed25519:student1_${testTimestamp}`;
    const student2 = `ed25519:student2_${testTimestamp}`;
    const follower = `ed25519:follower_${testTimestamp}`;

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

        await createUser(teacher);
        await createUser(student1);
        await createUser(student2);
        await createUser(follower);
    });

    describe('Create FOLLOWER Relation', () => {
        it('should create a FOLLOWER relation', async () => {
            const result = await hasuraQuery(`
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
            `, {
                from: follower,
                to: teacher,
                type: 'FOLLOWER'
            });

            if (result.errors) {
                console.error('CreateRelation errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_relations_one).toBeDefined();
            expect(result.data.insert_user_relations_one.relation_type).toBe('FOLLOWER');

            console.log('✅ FOLLOWER relation created');
        }, 10000);

        it('should prevent duplicate FOLLOWER relations', async () => {
            const result = await hasuraQuery(`
                mutation CreateRelation($from: String!, $to: String!, $type: String!) {
                    insert_user_relations_one(object: {
                        from_user_key: $from,
                        to_user_key: $to,
                        relation_type: $type
                    }) {
                        id
                    }
                }
            `, {
                from: follower,
                to: teacher,
                type: 'FOLLOWER'
            });

            expect(result.errors).toBeDefined();
            expect(result.errors[0].message).toContain('Uniqueness violation');

            console.log('✅ Duplicate FOLLOWER prevention works');
        }, 10000);
    });

    describe('Create TEACHER Relation', () => {
        it('should create a TEACHER relation', async () => {
            const result = await hasuraQuery(`
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
                    }
                }
            `, {
                from: teacher,
                to: student1,
                type: 'TEACHER'
            });

            if (result.errors) {
                console.error('CreateRelation errors:', JSON.stringify(result.errors, null, 2));
            }

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_relations_one.relation_type).toBe('TEACHER');

            console.log('✅ TEACHER relation created');
        }, 10000);

        it('should allow same user to be TEACHER to multiple students', async () => {
            const result = await hasuraQuery(`
                mutation CreateRelation($from: String!, $to: String!, $type: String!) {
                    insert_user_relations_one(object: {
                        from_user_key: $from,
                        to_user_key: $to,
                        relation_type: $type
                    }) {
                        id
                    }
                }
            `, {
                from: teacher,
                to: student2,
                type: 'TEACHER'
            });

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_relations_one).toBeDefined();

            console.log('✅ Teacher can have multiple students');
        }, 10000);

        it('should allow user to have both FOLLOWER and TEACHER relations', async () => {
            // Student1 follows Teacher (already Teacher → Student1)
            const result = await hasuraQuery(`
                mutation CreateRelation($from: String!, $to: String!, $type: String!) {
                    insert_user_relations_one(object: {
                        from_user_key: $from,
                        to_user_key: $to,
                        relation_type: $type
                    }) {
                        id
                        relation_type
                    }
                }
            `, {
                from: student1,
                to: teacher,
                type: 'FOLLOWER'
            });

            expect(result.data).toBeDefined();
            expect(result.data.insert_user_relations_one.relation_type).toBe('FOLLOWER');

            console.log('✅ User can have multiple relation types');
        }, 10000);
    });

    describe('Query Relations', () => {
        it('should get all followers of a user', async () => {
            const result = await hasuraQuery(`
                query GetFollowers($userKey: String!) {
                    user_relations(where: {
                        to_user_key: { _eq: $userKey },
                        relation_type: { _eq: "FOLLOWER" }
                    }) {
                        from_user_key
                        created_at
                    }
                }
            `, { userKey: teacher });

            expect(result.data).toBeDefined();
            expect(result.data.user_relations.length).toBeGreaterThanOrEqual(2);

            console.log('✅ Got', result.data.user_relations.length, 'followers');
        }, 10000);

        it('should get all students of a teacher', async () => {
            const result = await hasuraQuery(`
                query GetStudents($teacherKey: String!) {
                    user_relations(where: {
                        from_user_key: { _eq: $teacherKey },
                        relation_type: { _eq: "TEACHER" }
                    }) {
                        to_user_key
                        created_at
                    }
                }
            `, { teacherKey: teacher });

            expect(result.data).toBeDefined();
            expect(result.data.user_relations.length).toBe(2);

            console.log('✅ Got', result.data.user_relations.length, 'students');
        }, 10000);

        it('should get teachers of a student', async () => {
            const result = await hasuraQuery(`
                query GetTeachers($studentKey: String!) {
                    user_relations(where: {
                        to_user_key: { _eq: $studentKey },
                        relation_type: { _eq: "TEACHER" }
                    }) {
                        from_user_key
                    }
                }
            `, { studentKey: student1 });

            expect(result.data).toBeDefined();
            expect(result.data.user_relations.length).toBe(1);
            expect(result.data.user_relations[0].from_user_key).toBe(teacher);

            console.log('✅ Got teacher correctly');
        }, 10000);
    });

    describe('Delete Relations', () => {
        it('should remove a specific relation', async () => {
            const result = await hasuraQuery(`
                mutation RemoveRelation($from: String!, $to: String!, $type: String!) {
                    delete_user_relations(where: {
                        from_user_key: { _eq: $from },
                        to_user_key: { _eq: $to },
                        relation_type: { _eq: $type }
                    }) {
                        affected_rows
                    }
                }
            `, {
                from: follower,
                to: teacher,
                type: 'FOLLOWER'
            });

            expect(result.data).toBeDefined();
            expect(result.data.delete_user_relations.affected_rows).toBe(1);

            console.log('✅ Relation removed');
        }, 10000);
    });

    describe('Prevent Self-Relations', () => {
        it('should not allow self-following', async () => {
            const result = await hasuraQuery(`
                mutation CreateRelation($from: String!, $to: String!, $type: String!) {
                    insert_user_relations_one(object: {
                        from_user_key: $from,
                        to_user_key: $to,
                        relation_type: $type
                    }) {
                        id
                    }
                }
            `, {
                from: teacher,
                to: teacher,
                type: 'FOLLOWER'
            });

            expect(result.errors).toBeDefined();

            console.log('✅ Self-relation prevented');
        }, 10000);
    });

    afterAll(async () => {
        // Cleanup: delete all relations for test users
        await hasuraQuery(`
            mutation DeleteRelations($keys: [String!]!) {
                delete_user_relations(where: {
                    _or: [
                        { from_user_key: { _in: $keys } },
                        { to_user_key: { _in: $keys } }
                    ]
                }) {
                    affected_rows
                }
            }
        `, { keys: [teacher, student1, student2, follower] });

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

        await deleteUser(teacher);
        await deleteUser(student1);
        await deleteUser(student2);
        await deleteUser(follower);

        console.log('✅ Cleanup complete');
    });
});
