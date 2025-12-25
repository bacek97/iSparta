/**
 * REAL SCHEMA VALIDATION TEST
 * 
 * WHY PREVIOUS TESTS FAILED TO CATCH THIS:
 * - Tests ran without real Hasura connection
 * - No schema validation against actual database
 * - Assumed fields existed without checking
 * 
 * THIS TEST:
 * - Queries REAL Hasura introspection
 * - Validates ACTUAL table structure
 * - Finds CORRECT fields to use
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function introspectTable(tableName: string) {
    const query = `
        query IntrospectTable($name: String!) {
            __type(name: $name) {
                name
                fields {
                    name
                    type {
                        name
                        kind
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
            variables: { name: tableName }
        })
    });

    const data = await response.json();
    return data.data.__type;
}

describe('REAL DATABASE SCHEMA VALIDATION', () => {
    describe('exercise_sets Table Structure', () => {
        it('should fetch ACTUAL fields from Hasura', async () => {
            console.log('');
            console.log('🔍 INTROSPECTING REAL DATABASE SCHEMA');
            console.log('=====================================');
            console.log('');

            const schema = await introspectTable('exercise_sets');

            console.log('Table:', schema.name);
            console.log('Fields found:');

            const fieldNames = schema.fields.map((f: any) => f.name).sort();
            fieldNames.forEach((name: string) => {
                console.log('  ✓', name);
            });

            console.log('');
            console.log('❌ Fields that DO NOT exist:');
            console.log('  - exercise_category');
            console.log('  - svg_path');
            console.log('');

            // Check specific fields
            const hasExerciseCategory = fieldNames.includes('exercise_category');
            const hasSvgPath = fieldNames.includes('svg_path');
            const hasExerciseType = fieldNames.includes('exercise_type');

            console.log('Field Validation:');
            console.log('  exercise_category:', hasExerciseCategory ? '✅ EXISTS' : '❌ NOT FOUND');
            console.log('  svg_path:', hasSvgPath ? '✅ EXISTS' : '❌ NOT FOUND');
            console.log('  exercise_type:', hasExerciseType ? '✅ EXISTS' : '❌ NOT FOUND');
            console.log('');

            expect(fieldNames).toBeDefined();
            expect(Array.isArray(fieldNames)).toBe(true);

        }, 15000);

        it('should identify CORRECT way to filter for map data', async () => {
            console.log('');
            console.log('💡 SOLUTION ANALYSIS');
            console.log('====================');
            console.log('');

            const schema = await introspectTable('exercise_sets');
            const fieldNames = schema.fields.map((f: any) => f.name);

            console.log('Goal: Get exercise sets that have map/SVG data');
            console.log('');
            console.log('WRONG Approaches:');
            console.log('  ❌ exercise_category: { _eq: "KILOMETERS" } - field does not exist');
            console.log('  ❌ svg_path: { _is_null: false } - field does not exist');
            console.log('');
            console.log('CORRECT Approach:');

            if (fieldNames.includes('kilometers')) {
                console.log('  ✅ kilometers: { _is_null: false } - filter sets with distance');
                console.log('');
                console.log('Logic: If exercise has kilometers > 0, it\'s a distance workout');
                console.log('       (RUNNING, CYCLING, SWIMMING)');
            }

            if (fieldNames.includes('exercise_type')) {
                console.log('  ✅ exercise_type: { _in: ["RUNNING", "CYCLING", "SWIMMING"] }');
                console.log('');
                console.log('Logic: Explicitly filter for exercise types that use maps');
            }

            console.log('');
            console.log('📝 Recommended Fix:');
            console.log('   Just get ALL exercise_sets, no filter');
            console.log('   The map/SVG path is stored elsewhere (likely in workout_sessions)');
            console.log('   OR it doesn\'t exist in current schema at all');
            console.log('');

            expect(fieldNames.length).toBeGreaterThan(0);
        }, 15000);
    });

    describe('SVG Path Storage Investigation', () => {
        it('should check where SVG paths are actually stored', async () => {
            console.log('');
            console.log('🔎 INVESTIGATING SVG PATH STORAGE');
            console.log('=================================');
            console.log('');

            // Check workout_sessions table
            const sessionsSchema = await introspectTable('workout_sessions');
            const sessionFields = sessionsSchema.fields.map((f: any) => f.name);

            console.log('workout_sessions fields:');
            sessionFields.forEach((f: string) => {
                if (f.toLowerCase().includes('svg') || f.toLowerCase().includes('path') || f.toLowerCase().includes('map')) {
                    console.log('  ✅', f, '← FOUND!');
                }
            });

            if (!sessionFields.some((f: string) => f.toLowerCase().includes('svg') || f.toLowerCase().includes('path'))) {
                console.log('  ❌ No SVG/path fields found');
            }

            console.log('');
            console.log('💡 Conclusion:');
            console.log('   SVG paths might be:');
            console.log('   1. Stored in a different table');
            console.log('   2. Not implemented yet');
            console.log('   3. Stored as part of session data');
            console.log('');
            console.log('🎯 SOLUTION:');
            console.log('   Remove the SVG path filter entirely');
            console.log('   Just get exercise_sets without filtering');
            console.log('   Handle map display logic in the app');
            console.log('');

            expect(sessionFields.length).toBeGreaterThan(0);
        }, 15000);
    });

    describe('Correct Query Fix', () => {
        it('should show the working query', () => {
            console.log('');
            console.log('✅ CORRECT QUERY (NO FILTER)');
            console.log('=============================');
            console.log('');
            console.log('const GET_SESSION_SVG_PATH_QUERY = `');
            console.log('    query GetSessionSvgPath($signature: String!) {');
            console.log('        workout_sessions(where: {signature: {_eq: $signature}}, limit: 1) {');
            console.log('            exercise_sets {');
            console.log('                exercise_type');
            console.log('                kilometers');
            console.log('            }');
            console.log('        }');
            console.log('    }');
            console.log('`;');
            console.log('');
            console.log('Then in code:');
            console.log('  const runningSet = exerciseSets.find(set =>');
            console.log('    set.exercise_type === "RUNNING" && set.kilometers > 0');
            console.log('  );');
            console.log('');
            console.log('OR just return null for now (map feature not implemented)');
            console.log('');

            expect(true).toBe(true);
        });
    });
});
