/**
 * DIAGNOSTIC TEST: Why Foreign Key Violation if Session is Synced?
 * 
 * User says:
 * - No pending syncs in Settings
 * - Session should be in database
 * - BUT still getting foreign key violation
 * 
 * Possible causes:
 * 1. Session signature mismatch (local vs server)
 * 2. Wrong user_public_key in publication
 * 3. Group ID issue
 * 4. Different session being shared than synced one
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function executeGraphQL(query: string, variables?: any) {
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
        throw new Error(JSON.stringify(data.errors, null, 2));
    }
    return data.data;
}

describe('DIAGNOSTIC: Foreign Key Despite Sync', () => {
    const TEST_USER = process.env.TEST_USER_PUBLIC_KEY || '';
    const hasTestUser = TEST_USER.length > 0 && TEST_USER !== 'test_user_flow';
    const testIf = (condition: boolean) => condition ? it : it.skip;

    beforeAll(() => {
        console.log('');
        console.log('🔍 DIAGNOSTIC TEST');
        console.log('==================');
        console.log('');
        console.log('Problem: Foreign key violation despite successful sync');
        console.log('');
        console.log('Checking:');
        console.log('  1. Are sessions really in database?');
        console.log('  2. What is the exact error message?');
        console.log('  3. Is it signature issue or permissions?');
        console.log('');
    });

    testIf(hasTestUser)('should list all user sessions and attempt publication', async () => {
        console.log('👤 User:', TEST_USER);
        console.log('');

        // Step 1: Get all user sessions
        const sessionsQuery = `
            query GetSessions($user: String!) {
                workout_sessions(
                    where: { user_public_key: { _eq: $user } },
                    order_by: { session_date: desc },
                    limit: 5
                ) {
                    signature
                    session_date
                    user_public_key
                    base_points
                }
            }
        `;

        try {
            const sessions = await executeGraphQL(sessionsQuery, { user: TEST_USER });

            console.log('📊 Found', sessions.workout_sessions.length, 'sessions in database');

            if (sessions.workout_sessions.length === 0) {
                console.log('');
                console.log('❌ NO SESSIONS FOUND!');
                console.log('   Sync did not work OR using wrong user key');
                console.log('');
                return;
            }

            const latestSession = sessions.workout_sessions[0];
            console.log('');
            console.log('Latest session:');
            console.log('  Signature:', latestSession.signature);
            console.log('  Date:', latestSession.session_date);
            console.log('  User:', latestSession.user_public_key);
            console.log('  Points:', latestSession.base_points);
            console.log('');

            // Step 2: Check if user is in a group
            const groupQuery = `
                query GetUserGroup($user: String!) {
                    group_members(where: { user_public_key: { _eq: $user } }) {
                        group_id
                        group {
                            id
                            created_by
                        }
                    }
                }
            `;

            const groupData = await executeGraphQL(groupQuery, { user: TEST_USER });

            if (groupData.group_members.length === 0) {
                console.log('❌ USER NOT IN ANY GROUP!');
                console.log('   Publications require group membership');
                console.log('   This might be the issue!');
                console.log('');
                return;
            }

            const userGroup = groupData.group_members[0];
            console.log('👥 User is in group:', userGroup.group_id);
            console.log('');

            // Step 3: Try to create publication with REAL session
            console.log('📝 Attempting publication creation...');

            const pubMutation = `
                mutation CreatePub($pub: workout_publications_insert_input!) {
                    insert_workout_publications_one(object: $pub) {
                        id
                        session_signature
                    }
                }
            `;

            const publicationData = {
                session_signature: latestSession.signature,
                user_public_key: TEST_USER,
                group_id: userGroup.group_id,
                text_content: 'Diagnostic test publication',
                images: [],
                include_map: false
            };

            try {
                const result = await executeGraphQL(pubMutation, { pub: publicationData });
                console.log('✅ SUCCESS! Publication created:', result.insert_workout_publications_one.id);
                console.log('');
                console.log('🎯 DIAGNOSIS: Everything works!');
                console.log('   The issue must be:');
                console.log('   - Different session being used in app');
                console.log('   - Or group_id not being passed correctly');
                console.log('');

            } catch (error: any) {
                console.log('❌ FAILED:', error.message);
                console.log('');

                const errorMsg = error.message;

                if (errorMsg.includes('Foreign key violation')) {
                    console.log('🔍 ANALYSIS: Foreign Key Violation');
                    console.log('');

                    if (errorMsg.includes('session_signature')) {
                        console.log('Problem: session_signature foreign key');
                        console.log('Signature used:', latestSession.signature);
                        console.log('');
                        console.log('Possible causes:');
                        console.log('  - Session was deleted');
                        console.log('  - Wrong signature format');
                        console.log('  - Database constraint issue');
                    }

                    if (errorMsg.includes('group_id')) {
                        console.log('Problem: group_id foreign key');
                        console.log('Group ID used:', userGroup.group_id);
                        console.log('');
                        console.log('Possible causes:');
                        console.log('  - Group was deleted');
                        console.log('  - Wrong group ID format');
                    }

                    if (errorMsg.includes('user_public_key')) {
                        console.log('Problem: user_public_key foreign key');
                        console.log('User key used:', TEST_USER);
                        console.log('');
                        console.log('Possible causes:');
                        console.log('  - User not registered in database');
                        console.log('  - Wrong user key format');
                    }
                }

                if (errorMsg.includes('already exists')) {
                    console.log('✅ Publication already exists for this session');
                    console.log('   This means foreign keys are fine!');
                    console.log('   Just duplicate prevention working');
                }

                console.log('');
                console.log('Full error:', errorMsg);
            }

        } catch (error: any) {
            console.error('❌ Test failed:', error.message);
            throw error;
        }
    }, 25000);
});
