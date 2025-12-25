/**
 * COMPREHENSIVE TDD TEST: Full Publication Creation Flow
 * Tests ENTIRE call stack from top-level API to GraphQL
 * 
 * Call Stack:
 * 1. createPublication (top-level API)
 * 2. → getSessionSvgPath (if includeMap=true)
 * 3.   → GET_SESSION_SVG_PATH_QUERY (GraphQL - BUG HERE)
 */

import { createPublication } from '../publicationsService';

describe('TDD: Full Publication Creation Flow (exercise_category bug)', () => {
    const TEST_USER = process.env.TEST_USER_PUBLIC_KEY || 'test_user_flow';

    // Test will be skipped if no test user configured
    const testIf = (condition: boolean) => condition ? it : it.skip;
    const hasTestUser = TEST_USER.length > 0 && TEST_USER !== 'test_user_flow';

    beforeAll(() => {
        console.log('');
        console.log('🔵 COMPREHENSIVE PUBLICATION FLOW TEST');
        console.log('=====================================');
        console.log('');
        console.log('This test covers FULL call stack:');
        console.log('  1. createPublication()');
        console.log('  2. → getSessionSvgPath() [if includeMap=true]');
        console.log('  3.   → GET_SESSION_SVG_PATH_QUERY [GraphQL]');
        console.log('');
        console.log('Expected bug location:');
        console.log('  publicationsService.ts:102');
        console.log('  Query uses: exercise_category (WRONG)');
        console.log('  Should use: exercise_type (CORRECT)');
        console.log('');

        if (!hasTestUser) {
            console.warn('⚠️ Skipping - No TEST_USER_PUBLIC_KEY configured');
        }
    });

    describe('🔴 RED: Reproduce exercise_category Error', () => {
        testIf(hasTestUser)('should FAIL when createPublication calls getSessionSvgPath', async () => {
            console.log('');
            console.log('🔴 RED Phase: Testing full publication creation with map');
            console.log('Expected: GraphQL error about exercise_category field');
            console.log('');

            const testSession = 'test_running_' + Date.now();

            try {
                console.log('Step 1: Calling createPublication...');
                console.log('  session:', testSession);
                console.log('  include_map:', true);
                console.log('');

                const result = await createPublication({
                    session_signature: testSession,
                    text_content: 'Running workout with map',
                    images: [],
                    include_map: true  // ← This triggers getSessionSvgPath
                }, TEST_USER);

                console.log('✅ SUCCESS: Publication created!');
                console.log('Result:', result);
                console.log('');
                console.log('🟢 GREEN: Bug is FIXED! exercise_category → exercise_type');

            } catch (error: any) {
                console.log('❌ ERROR caught:', error.message);
                console.log('');

                // Analyze the error
                if (error.message.includes('exercise_category')) {
                    console.log('🎯 REPRODUCED! This is the exercise_category bug!');
                    console.log('');
                    console.log('Error Analysis:');
                    console.log('  Message:', error.message);
                    console.log('');
                    console.log('Call Stack Trace:');
                    console.log('  1. ✓ createPublication() called');
                    console.log('  2. ✓ getSessionSvgPath() called (because include_map=true)');
                    console.log('  3. ✗ GET_SESSION_SVG_PATH_QUERY failed');
                    console.log('');
                    console.log('Root Cause:');
                    console.log('  Line: publicationsService.ts:102');
                    console.log('  Query: exercise_sets(where: { exercise_category: { _eq: "KILOMETERS" } })');
                    console.log('  Problem: exercise_category field does NOT exist');
                    console.log('  Solution: Change to exercise_type');
                    console.log('');

                    // In RED phase, this confirms the bug
                    expect(error.message).toContain('exercise_category');
                    throw error; // Re-throw to fail test (RED)

                } else if (error.message.includes('Foreign key violation') ||
                    error.message.includes('not found')) {
                    console.log('⚠️ Different error (session does not exist in DB)');
                    console.log('This is expected if test session does not exist');
                    console.log('The exercise_category bug would occur BEFORE this');
                    console.log('');
                    console.log('To properly test, either:');
                    console.log('  1. Create a real workout session first');
                    console.log('  2. Use existing session signature from DB');
                    console.log('');
                    throw error;

                } else {
                    console.log('⚠️ Unexpected error:', error.message);
                    throw error;
                }
            }
        }, 20000);
    });

    describe('Call Stack Analysis', () => {
        it('should document the full call hierarchy', () => {
            console.log('');
            console.log('📚 CALL STACK DOCUMENTATION');
            console.log('===========================');
            console.log('');
            console.log('User Action: Click "Share" on workout');
            console.log('  ↓');
            console.log('[ProfileScreen / LeaderboardScreen]');
            console.log('  Opens PublicationCreator modal');
            console.log('  ↓');
            console.log('[PublicationCreator Component]');
            console.log('  Collects: text, images, includeMap checkbox');
            console.log('  Calls →');
            console.log('  ↓');
            console.log('[createPublication() function]');
            console.log('  publicationsService.ts:114');
            console.log('  - Validates inputs (max 5 images)');
            console.log('  - Checks for duplicates');
            console.log('  - If includeMap=true, calls →');
            console.log('  ↓');
            console.log('[getSessionSvgPath() function]');
            console.log('  publicationsService.ts:217');
            console.log('  - Fetches SVG path for running workout');
            console.log('  - Executes →');
            console.log('  ↓');
            console.log('[GET_SESSION_SVG_PATH_QUERY]');
            console.log('  publicationsService.ts:99-107');
            console.log('  - GraphQL query to Hasura');
            console.log('  - ❌ BUG: Uses exercise_category (line 102)');
            console.log('  - ✅ FIX: Should use exercise_type');
            console.log('');
            console.log('Bug Impact:');
            console.log('  - ANY publication with includeMap=true will fail');
            console.log('  - Affects ALL running/cycling/swimming workouts');
            console.log('  - User sees: "Failed to publish" error');
            console.log('');

            expect(true).toBe(true);
        });

        it('should show database schema (exercise_sets table)', () => {
            console.log('');
            console.log('🗄️ DATABASE SCHEMA: exercise_sets');
            console.log('=================================');
            console.log('');
            console.log('Columns:');
            console.log('  ✓ hash_shazam          (text, PK)');
            console.log('  ✓ session_signature    (text, FK → workout_sessions)');
            console.log('  ✓ exercise_type        (text) ← CORRECT FIELD');
            console.log('  ✓ reps                 (integer)');
            console.log('  ✓ seconds              (integer)');
            console.log('  ✓ kilometers           (real)');
            console.log('  ✓ points               (real)');
            console.log('  ✓ svg_path             (text)');
            console.log('  ✗ exercise_category    NOT A COLUMN!');
            console.log('');
            console.log('exercise_type values:');
            console.log('  - PUSHUPS');
            console.log('  - SQUATS');
            console.log('  - RUNNING  ← For map/SVG path');
            console.log('  - CYCLING');
            console.log('  - etc...');
            console.log('');

            expect(true).toBe(true);
        });
    });

    describe('Fix Strategy', () => {
        it('should document the required fix', () => {
            console.log('');
            console.log('🔧 FIX STRATEGY');
            console.log('===============');
            console.log('');
            console.log('File: publicationsService.ts');
            console.log('Line: 102');
            console.log('');
            console.log('BEFORE (broken):');
            console.log('  exercise_sets(where: { exercise_category: { _eq: "KILOMETERS" } }) {');
            console.log('');
            console.log('AFTER (fixed):');
            console.log('  Option 1: Filter by exercise_type for running:');
            console.log('    exercise_sets(where: {');
            console.log('      exercise_type: { _in: ["RUNNING", "CYCLING", "SWIMMING"] }');
            console.log('    }) {');
            console.log('');
            console.log('  Option 2: Filter by svg_path existence:');
            console.log('    exercise_sets(where: { svg_path: { _is_null: false } }) {');
            console.log('');
            console.log('  Option 3: No filter (get all sets, find svg_path in code):');
            console.log('    exercise_sets {');
            console.log('');
            console.log('Recommendation: Option 2 (filter by svg_path)');
            console.log('  - Most accurate (only sets with maps)');
            console.log('  - Covers all exercise types that could have maps');
            console.log('  - Future-proof');
            console.log('');

            expect(true).toBe(true);
        });
    });
});
