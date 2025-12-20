/**
 * Debug script to check Hasura database for workout data
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function hasuraQuery(query, variables) {
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

async function checkDatabase() {
    console.log('=== Checking Hasura Database ===\n');

    // 1. Check all users
    console.log('1. All users:');
    const usersResult = await hasuraQuery(`
        query {
            users {
                ed25519_public_key
                fms_category
                created_at
            }
        }
    `);
    console.log(JSON.stringify(usersResult, null, 2));

    // 2. Check all workout sessions
    console.log('\n2. All workout sessions:');
    const sessionsResult = await hasuraQuery(`
        query {
            workout_sessions {
                signature
                user_public_key
                session_date
                base_points
                total_points
            }
        }
    `);
    console.log(JSON.stringify(sessionsResult, null, 2));

    // 3. Check aggregate stats
    console.log('\n3. Workout sessions aggregate by user:');
    const aggregateResult = await hasuraQuery(`
        query {
            workout_sessions_aggregate {
                aggregate {
                    count
                    sum {
                        total_points
                        base_points
                    }
                }
                nodes {
                    user_public_key
                    total_points
                }
            }
        }
    `);
    console.log(JSON.stringify(aggregateResult, null, 2));

    // 4. Check groups and members
    console.log('\n4. Groups and members:');
    const groupsResult = await hasuraQuery(`
        query {
            user_groups {
                group_id
                group_name
                members {
                    user_public_key
                    is_admin
                }
            }
        }
    `);
    console.log(JSON.stringify(groupsResult, null, 2));
}

checkDatabase().catch(console.error);
