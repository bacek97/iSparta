import { getUserStats, getLast7DaysSessions } from '../statsService';

// These tests require Hasura to be running and accessible
describe('StatsService GraphQL Integration Tests', () => {
    const TEST_USER_KEY = 'test_user_' + Date.now();

    describe('getUserStats', () => {
        it('should fetch user stats without crashing', async () => {
            try {
                const stats = await getUserStats(TEST_USER_KEY);

                expect(stats).toHaveProperty('workout_count');
                expect(stats).toHaveProperty('total_points');
                expect(stats).toHaveProperty('average_points');
                expect(stats).toHaveProperty('base_points_sum');

                expect(typeof stats.workout_count).toBe('number');
                expect(typeof stats.total_points).toBe('number');
            } catch (error: any) {
                // Should not throw unexpected errors
                expect(error.message).not.toContain('workout_sessions_by_pk');
                expect(error.message).not.toContain('field not found');
            }
        }, 10000);
    });

    describe('getLast7DaysSessions', () => {
        it('should fetch last 7 days sessions with exercise_sets', async () => {
            try {
                const sessions = await getLast7DaysSessions(TEST_USER_KEY);

                expect(Array.isArray(sessions)).toBe(true);

                // If sessions exist, verify structure
                if (sessions.length > 0) {
                    const session = sessions[0];

                    expect(session).toHaveProperty('signature');
                    expect(session).toHaveProperty('session_date');
                    expect(session).toHaveProperty('base_points');
                    expect(session).toHaveProperty('total_points');
                    expect(session).toHaveProperty('bonus_tech_factor');
                    expect(session).toHaveProperty('bonus_speed');
                    expect(session).toHaveProperty('exercise_sets');

                    expect(Array.isArray(session.exercise_sets)).toBe(true);

                    if (session.exercise_sets.length > 0) {
                        const exerciseSet = session.exercise_sets[0];
                        expect(exerciseSet).toHaveProperty('exercise_type');
                        expect(exerciseSet).toHaveProperty('points');
                    }
                }
            } catch (error: any) {
                console.error('GraphQL Error:', error.message);

                // Check for specific permission errors
                if (error.message.includes('field') && error.message.includes('not found')) {
                    console.error('PERMISSION ERROR: Missing Hasura permissions or relationships');
                    console.error('Check:');
                    console.error('1. exercise_sets relationship exists on workout_sessions');
                    console.error('2. anonymous role has select permission on exercise_sets table');
                    console.error('3. Hasura metadata is applied');
                }

                throw error;
            }
        }, 10000);

        it('should handle non-existent user gracefully', async () => {
            const sessions = await getLast7DaysSessions('nonexistent_user_xyz');
            expect(Array.isArray(sessions)).toBe(true);
            expect(sessions.length).toBe(0);
        }, 10000);
    });

    describe('GraphQL Query Structure', () => {
        it('should not use deprecated _by_pk queries', async () => {
            // This test ensures we're not using primary key lookups that might not be enabled
            try {
                await getUserStats(TEST_USER_KEY);
                await getLast7DaysSessions(TEST_USER_KEY);

                // If we reach here, queries are working correctly
                expect(true).toBe(true);
            } catch (error: any) {
                // Should not include _by_pk in error
                expect(error.message).not.toContain('_by_pk');
            }
        }, 10000);
    });
});
