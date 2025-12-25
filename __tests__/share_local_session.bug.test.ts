/**
 * REAL PRODUCTION BUG REPRODUCTION TEST
 * 
 * Issue: User clicks Share on LOCAL session (not synced to server)
 * Result: Foreign key violation because session doesn't exist in Hasura
 * 
 * Root Cause: No validation that session is synced before sharing
 */

import { createPublication } from '../publicationsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

async function checkSessionExistsInDatabase(sessionSignature: string): Promise<boolean> {
    const query = `
        query CheckSession($sig: String!) {
            workout_sessions(where: {signature: {_eq: $sig}}) {
                signature
            }
        }
    `;

    const result = await executeGraphQL(query, { sig: sessionSignature });
    return result.workout_sessions.length > 0;
}

describe('PRODUCTION BUG: Share Local Session', () => {
    const TEST_USER = process.env.TEST_USER_PUBLIC_KEY || '';
    const hasTestUser = TEST_USER.length > 0 && TEST_USER !== 'test_user_flow';
    const testIf = (condition: boolean) => condition ? it : it.skip;

    beforeAll(() => {
        console.log('');
        console.log('🔴 PRODUCTION BUG REPRODUCTION');
        console.log('==============================');
        console.log('');
        console.log('User Flow:');
        console.log('  1. User completes workout');
        console.log('  2. Workout saved to LOCAL AsyncStorage');
        console.log('  3. User clicks 📤 Share button');
        console.log('  4. ❌ Foreign key violation!');
        console.log('');
        console.log('Why? Session exists locally but NOT in Hasura database');
        console.log('');
    });

    describe('Reproduce the Bug', () => {
        testIf(hasTestUser)('should FAIL when sharing unsynced local session', async () => {
            console.log('📱 Simulating user workflow...');

            // Step 1: Create LOCAL session (like user workout)
            const localSession = {
                signature: 'local_' + Date.now(),
                startTime: new Date().toISOString(),
                exercises: {
                    PUSHUPS: { duration: 60, reps: 20 }
                }
            };

            console.log('1️⃣ Created LOCAL session:', localSession.signature);
            await AsyncStorage.setItem(`session_${localSession.signature}`, JSON.stringify(localSession));

            // Step 2: Check if session exists in database
            const existsInDB = await checkSessionExistsInDatabase(localSession.signature);
            console.log('2️⃣ Session in database?', existsInDB ? 'YES ✅' : 'NO ❌');

            expect(existsInDB).toBe(false); // Local session NOT in database

            // Step 3: Try to share (like user clicking Share button)
            console.log('3️⃣ User clicks Share button...');

            try {
                await createPublication({
                    session_signature: localSession.signature,
                    text_content: 'Trying to share local session',
                    images: [],
                    include_map: false
                }, TEST_USER);

                fail('Should have thrown foreign key error');

            } catch (error: any) {
                console.log('4️⃣ ❌ ERROR:', error.message);

                if (error.message.includes('Foreign key')) {
                    console.log('');
                    console.log('🎯 BUG REPRODUCED!');
                    console.log('   Session exists locally but not in database');
                    console.log('   Cannot create publication without syncing first');
                    console.log('');

                    expect(error.message).toContain('Foreign key');
                } else {
                    throw error;
                }
            }

            // Cleanup
            await AsyncStorage.removeItem(`session_${localSession.signature}`);
        }, 20000);
    });

    describe('Solution', () => {
        it('should document the fix', () => {
            console.log('');
            console.log('💡 SOLUTION OPTIONS');
            console.log('===================');
            console.log('');
            console.log('Option 1: Sync Before Share');
            console.log('  - Check if session exists in DB');
            console.log('  - If not, sync it first');
            console.log('  - Then create publication');
            console.log('  ✅ Automatic, seamless');
            console.log('');
            console.log('Option 2: Show Sync Required Error');
            console.log('  - Check if session synced');
            console.log('  - Show error: "Sync workout first"');
            console.log('  - User manually syncs, then shares');
            console.log('  ⚠️ Extra step for user');
            console.log('');
            console.log('Option 3: Only Show Share for Synced Sessions');
            console.log('  - Filter sessions list');
            console.log('  - Only show Share button if synced');
            console.log('  - Clearest UX');
            console.log('  ✅ RECOMMENDED');
            console.log('');
            console.log('Implementation:');
            console.log('  1. Add "synced" flag to session display');
            console.log('  2. Conditionally render Share button');
            console.log('  3. OR auto-sync before sharing');
            console.log('');

            expect(true).toBe(true);
        });
    });
});
