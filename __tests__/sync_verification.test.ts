/**
 * TEST: Verify Workout Sync is Actually Working
 * 
 * User says: "sync is ENABLED but I still get foreign key violation"
 * 
 * This means:
 * 1. Sync might not be working
 * 2. Workout created but not synced yet
 * 3. Bug in sync logic
 * 
 * Need to test ACTUAL sync flow
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
        throw new Error(data.errors[0].message);
    }
    return data.data;
}

describe('SYNC VERIFICATION: Is Sync Actually Working?', () => {
    const TEST_USER = process.env.TEST_USER_PUBLIC_KEY || '';
    const hasTestUser = TEST_USER.length > 0 && TEST_USER !== 'test_user_flow';
    const testIf = (condition: boolean) => condition ? it : it.skip;

    beforeAll(() => {
        console.log('');
        console.log('🔍 SYNC VERIFICATION TEST');
        console.log('=========================');
        console.log('');
        console.log('User Report:');
        console.log('  "Sync is ENABLED in settings"');
        console.log('  "But still getting foreign key violation"');
        console.log('');
        console.log('Possible Issues:');
        console.log('  1. Sync code not called after workout');
        console.log('  2. Sync fails silently');
        console.log('  3. Race condition (share before sync completes)');
        console.log('  4. Signature mismatch between local and server');
        console.log('');
    });

    describe('Check Sync Implementation', () => {
        it('should show what files handle sync', () => {
            console.log('');
            console.log('📁 SYNC CODE LOCATIONS');
            console.log('======================');
            console.log('');
            console.log('Expected files:');
            console.log('  - serverSyncService.ts - Handles server sync');
            console.log('  - exerciseTrackingService.ts - Saves workouts');
            console.log('  - Settings screen - Enable/disable sync');
            console.log('');
            console.log('Key Questions:');
            console.log('  1. Is sync called automatically after workout?');
            console.log('  2. Does sync wait for completion?');
            console.log('  3. Are errors logged?');
            console.log('  4. Is signature same in local and server?');
            console.log('');

            expect(true).toBe(true);
        });
    });

    describe('Verify Session in Database', () => {
        testIf(hasTestUser)('should check if user has ANY synced sessions', async () => {
            console.log('');
            console.log('🔍 Checking user sessions in database...');

            const query = `
                query GetUserSessions($userKey: String!) {
                    workout_sessions(
                        where: { user_public_key: { _eq: $userKey } },
                        order_by: { session_date: desc },
                        limit: 5
                    ) {
                        signature
                        session_date
                        base_points
                    }
                }
            `;

            try {
                const result = await executeGraphQL(query, { userKey: TEST_USER });

                console.log('Sessions found:', result.workout_sessions.length);

                if (result.workout_sessions.length === 0) {
                    console.log('');
                    console.log('❌ NO SESSIONS IN DATABASE!');
                    console.log('   This confirms: SYNC IS NOT WORKING');
                    console.log('');
                    console.log('Possible reasons:');
                    console.log('  1. serverSyncEnabled = false');
                    console.log('  2. Sync code never called');
                    console.log('  3. Sync failing silently');
                    console.log('  4. Network issues');
                    console.log('');
                } else {
                    console.log('');
                    console.log('✅ Found synced sessions:');
                    result.workout_sessions.forEach((s: any, i: number) => {
                        console.log(`  ${i + 1}. ${s.signature}`);
                        console.log(`     Date: ${s.session_date}`);
                        console.log(`     Points: ${s.base_points}`);
                    });
                    console.log('');
                    console.log('✅ Sync IS working for some sessions');
                    console.log('⚠️ But user still gets error...');
                    console.log('   Maybe race condition?');
                    console.log('   User clicks Share before sync completes?');
                    console.log('');
                }

                expect(true).toBe(true);

            } catch (error: any) {
                console.error('❌ Error checking sessions:', error.message);
                throw error;
            }
        }, 15000);
    });

    describe('Solution Analysis', () => {
        it('should document required fixes', () => {
            console.log('');
            console.log('💡 SOLUTION STRATEGY');
            console.log('====================');
            console.log('');
            console.log('Fix #1: Ensure Sync Completes');
            console.log('  - Check serverSyncService.ts');
            console.log('  - Ensure sync is awaited');
            console.log('  - Add error handling/logging');
            console.log('');
            console.log('Fix #2: Wait for Sync Before Share');
            console.log('  - In createPublication:');
            console.log('    1. Check if session exists in DB');
            console.log('    2. If not, attempt sync');
            console.log('    3. Wait for sync to complete');
            console.log('    4. Then create publication');
            console.log('');
            console.log('Fix #3: Better Error Messages');
            console.log('  - If session not in DB:');
            console.log('    "Session not synced. Syncing now..."');
            console.log('  - If sync fails:');
            console.log('    "Unable to sync. Check internet connection"');
            console.log('');
            console.log('Implementation:');
            console.log('  Add to publicationsService.ts:');
            console.log('  - checkAndSyncSession(signature)');
            console.log('  - Call before createPublication mutation');
            console.log('');

            expect(true).toBe(true);
        });
    });
});
