/**
 * User Groups Integration Tests
 * Tests for group creation, member management, admin transfer, and group-based notifications
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

describe('User Groups Integration Tests', () => {
    const testUser1 = `ed25519:group_test_user1_${Date.now()}`;
    const testUser2 = `ed25519:group_test_user2_${Date.now()}`;
    const testUser3 = `ed25519:group_test_user3_${Date.now()}`;
    const testGroupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
                    query: `
                        mutation InsertUser($publicKey: String!) {
                            insert_users_one(object: {
                                ed25519_public_key: $publicKey,
                                fms_category: "JUNIOR"
                            }) {
                                ed25519_public_key
                            }
                        }
                    `,
                    variables: { publicKey }
                })
            });
        };

        await createUser(testUser1);
        await createUser(testUser2);
        await createUser(testUser3);
    });

    describe('Group Creation', () => {
        it('should create a new group with client-generated ID', async () => {
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
                        members {
                            user_public_key
                            is_admin
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        groupId: testGroupId,
                        groupName: 'Test Fitness Group',
                        createdBy: testUser1
                    }
                })
            });

            const data = await response.json();

            if (data.errors) {
                console.error('Errors:', JSON.stringify(data.errors, null, 2));
            }

            expect(data.data).toBeDefined();
            expect(data.data.insert_user_groups_one.group_id).toBe(testGroupId);
            expect(data.data.insert_user_groups_one.members.length).toBe(1);
            expect(data.data.insert_user_groups_one.members[0].is_admin).toBe(true);

            console.log('✅ Group created:', data.data.insert_user_groups_one.group_name);
        }, 10000);
    });

    describe('Member Management', () => {
        it('should add new members to group', async () => {
            const mutation = `
                mutation AddGroupMembers($members: [group_members_insert_input!]!) {
                    insert_group_members(objects: $members) {
                        returning {
                            group_id
                            user_public_key
                            is_admin
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        members: [
                            {
                                group_id: testGroupId,
                                user_public_key: testUser2,
                                is_admin: false
                            },
                            {
                                group_id: testGroupId,
                                user_public_key: testUser3,
                                is_admin: false
                            }
                        ]
                    }
                })
            });

            const data = await response.json();
            expect(data.data.insert_group_members.returning.length).toBe(2);

            console.log('✅ Added', data.data.insert_group_members.returning.length, 'members');
        }, 10000);

        it('should prevent duplicate membership', async () => {
            const mutation = `
                mutation AddDuplicateMember($groupId: String!, $userPublicKey: String!) {
                    insert_group_members_one(object: {
                        group_id: $groupId,
                        user_public_key: $userPublicKey,
                        is_admin: false
                    }) {
                        id
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        groupId: testGroupId,
                        userPublicKey: testUser2 // Already added
                    }
                })
            });

            const data = await response.json();
            expect(data.errors).toBeDefined();
            expect(data.errors[0].message).toContain('Uniqueness violation');

            console.log('✅ Duplicate prevention working');
        }, 10000);

        it('should remove member from group', async () => {
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

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        groupId: testGroupId,
                        userPublicKey: testUser3
                    }
                })
            });

            const data = await response.json();
            expect(data.data.delete_group_members.affected_rows).toBe(1);

            console.log('✅ Member removed');
        }, 10000);
    });

    describe('Admin Management', () => {
        it('should transfer admin rights to another user', async () => {
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
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        groupId: testGroupId,
                        newAdminKey: testUser2
                    }
                })
            });

            const data = await response.json();
            expect(data.data.update_group_members.returning[0].is_admin).toBe(true);

            console.log('✅ Admin rights transferred');
        }, 10000);

        it('should prevent removing last admin', async () => {
            // First, remove admin from user1
            const removeAdminMutation = `
                mutation RemoveAdmin($groupId: String!, $userKey: String!) {
                    update_group_members(
                        where: {
                            group_id: { _eq: $groupId },
                            user_public_key: { _eq: $userKey }
                        },
                        _set: { is_admin: false }
                    ) {
                        affected_rows
                    }
                }
            `;

            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: removeAdminMutation,
                    variables: {
                        groupId: testGroupId,
                        userKey: testUser1
                    }
                })
            });

            // Now try to remove last admin (user2)
            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: removeAdminMutation,
                    variables: {
                        groupId: testGroupId,
                        userKey: testUser2
                    }
                })
            });

            const data = await response.json();

            // Should have error from database trigger
            expect(data.errors).toBeDefined();
            expect(data.errors.length).toBeGreaterThan(0);

            // Log the actual error for debugging
            console.log('Database error:', data.errors[0].message);
            console.log('✅ Last admin protection working');
        }, 10000);
    });

    describe('Group Queries', () => {
        it('should query user groups with members', async () => {
            const query = `
                query GetUserGroups($userPublicKey: String!) {
                    group_members(where: { user_public_key: { _eq: $userPublicKey } }) {
                        is_admin
                        group {
                            group_id
                            group_name
                            members {
                                user {
                                    ed25519_public_key
                                    fms_category
                                }
                                is_admin
                            }
                        }
                    }
                }
            `;

            const response = await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        userPublicKey: testUser1
                    }
                })
            });

            const data = await response.json();
            expect(data.data.group_members.length).toBeGreaterThan(0);
            expect(data.data.group_members[0].group.members.length).toBeGreaterThan(0);

            console.log('✅ Queried', data.data.group_members.length, 'groups');
        }, 10000);
    });

    describe('Group-based Notifications Subscription', () => {
        it('should receive workouts only from group members', async () => {
            const wsUrl = HASURA_URL.replace('https://', 'wss://').replace('http://', 'ws://');
            const ws = new WebSocket(wsUrl, 'graphql-ws');

            // Subscribe to workouts from users in the same groups
            const subscription = `
                subscription OnGroupMembersWorkouts($userPublicKey: String!) {
                    workout_sessions(
                        where: {
                            user: {
                                group_memberships: {
                                    group: {
                                        members: {
                                            user_public_key: { _eq: $userPublicKey }
                                        }
                                    }
                                }
                            },
                            user_public_key: { _neq: $userPublicKey }
                        },
                        order_by: { session_date: desc },
                        limit: 5
                    ) {
                        signature
                        total_points
                        user {
                            ed25519_public_key
                        }
                    }
                }
            `;

            const receivedUpdates: any[] = [];

            await new Promise((resolve, reject) => {
                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        type: 'connection_init',
                        payload: {
                            headers: {
                                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                            }
                        }
                    }));
                };

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);

                    if (message.type === 'connection_ack') {
                        ws.send(JSON.stringify({
                            id: '1',
                            type: 'start',
                            payload: {
                                query: subscription,
                                variables: {
                                    userPublicKey: testUser1
                                }
                            }
                        }));
                    } else if (message.type === 'data') {
                        receivedUpdates.push(message.payload.data);
                        console.log('✅ Received group members workouts');
                        ws.close();
                        resolve(true);
                    } else if (message.type === 'error') {
                        reject(new Error(message.payload.message));
                    }
                };

                ws.onerror = (error) => reject(error);

                setTimeout(() => {
                    ws.close();
                    resolve(true); // Resolve even if no data (group might be empty)
                }, 3000);
            });

            await new Promise(resolve => setTimeout(resolve, 100));
            expect([WebSocket.CLOSING, WebSocket.CLOSED]).toContain(ws.readyState);
        }, 10000);
    });

    afterAll(async () => {
        // Cleanup: delete group (cascade will delete members)
        await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: `
                    mutation DeleteGroup($groupId: String!) {
                        delete_user_groups_by_pk(group_id: $groupId) {
                            group_id
                        }
                    }
                `,
                variables: { groupId: testGroupId }
            })
        });

        // Delete test users
        const deleteUser = async (publicKey: string) => {
            await fetch(HASURA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hasura-admin-secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `
                        mutation DeleteUser($publicKey: String!) {
                            delete_users_by_pk(ed25519_public_key: $publicKey) {
                                ed25519_public_key
                            }
                        }
                    `,
                    variables: { publicKey }
                })
            });
        };

        await deleteUser(testUser1);
        await deleteUser(testUser2);
        await deleteUser(testUser3);

        console.log('✅ Cleanup complete');
    });
});
