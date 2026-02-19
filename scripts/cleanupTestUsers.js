// Cleanup script for test_integration users
const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function cleanup() {
    console.log('🧹 Cleaning up test_integration users...\n');

    // First delete relations
    const deleteRelations = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_user_relations(where: {
                        _or: [
                            { from_user_key: { _like: "%test_%" } },
                            { to_user_key: { _like: "%test_%" } }
                        ]
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const relResult = await deleteRelations.json();
    console.log('Relations deleted:', relResult.data?.delete_user_relations?.affected_rows || 0);

    // Delete group members
    const deleteGroupMembers = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_group_members(where: {
                        user_public_key: { _like: "%test_%" }
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const gmResult = await deleteGroupMembers.json();
    console.log('Group members deleted:', gmResult.data?.delete_group_members?.affected_rows || 0);

    // Delete workout sessions
    const deleteSessions = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_workout_sessions(where: {
                        user_public_key: { _like: "%test_%" }
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const sessResult = await deleteSessions.json();
    console.log('Workout sessions deleted:', sessResult.data?.delete_workout_sessions?.affected_rows || 0);

    // Delete publications
    const deletePubs = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_workout_publications(where: {
                        user_public_key: { _like: "%test_%" }
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const pubResult = await deletePubs.json();
    console.log('Publications deleted:', pubResult.data?.delete_workout_publications?.affected_rows || 0);

    // Delete user groups created by test users
    const deleteGroups = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_user_groups(where: {
                        created_by: { _like: "%test_%" }
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const groupResult = await deleteGroups.json();
    console.log('Groups deleted:', groupResult.data?.delete_user_groups?.affected_rows || 0);

    // Finally delete test users
    const deleteUsers = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            query: `
                mutation {
                    delete_users(where: {
                        ed25519_public_key: { _like: "%test_%" }
                    }) {
                        affected_rows
                    }
                }
            `
        })
    });
    const userResult = await deleteUsers.json();
    console.log('Users deleted:', userResult.data?.delete_users?.affected_rows || 0);

    console.log('\n✅ Cleanup complete!');
}

cleanup().catch(console.error);
