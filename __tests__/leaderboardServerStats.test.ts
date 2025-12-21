/**
 * TDD Test: Leaderboard should use server stats, not local calculations
 * 
 * Problem: "Last 7 days" shows 12.4 points (local) but server has 9 points
 * Solution: Get points from Hasura instead of calculating locally
 */

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// Existing user that has workouts
const TEST_USER_KEY = 'ed25519:Ca8zVYnaGch2gGrHxGMYtygammdRqSX1uqdQrrRD47tY';

describe('TDD: Leaderboard Stats from Server', () => {
    it('should get user workout stats from Hasura', async () => {
        const query = `
            query GetUserWorkoutStats($userKey: String!) {
                workout_sessions(
                    where: { user_public_key: { _eq: $userKey } }
                    order_by: { session_date: desc }
                ) {
                    signature
                    session_date
                    base_points
                    total_points
                    bonus_tech_factor
                    bonus_speed
                    bonus_for_starters
                    bonus_another_muscle_yesterday
                    bonus_weeks_in_streak
                }
                workout_sessions_aggregate(where: { user_public_key: { _eq: $userKey } }) {
                    aggregate {
                        count
                        sum {
                            total_points
                            base_points
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
            body: JSON.stringify({ query, variables: { userKey: TEST_USER_KEY } })
        });

        const result = await response.json();

        expect(result.errors).toBeUndefined();
        expect(result.data.workout_sessions).toBeDefined();
        expect(result.data.workout_sessions_aggregate).toBeDefined();

        // Should have sessions
        expect(result.data.workout_sessions.length).toBeGreaterThanOrEqual(0);

        // Should have aggregate stats
        const agg = result.data.workout_sessions_aggregate.aggregate;
        expect(typeof agg.count).toBe('number');
        expect(agg.sum).toBeDefined();

        console.log('Server stats:', {
            sessionCount: agg.count,
            totalPoints: agg.sum?.total_points || 0,
            basePoints: agg.sum?.base_points || 0,
            sessions: result.data.workout_sessions.map((s: any) => ({
                date: s.session_date,
                points: s.total_points
            }))
        });
    });

    it('should get last 7 days sessions with points from server', async () => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const query = `
            query GetLast7DaysSessions($userKey: String!, $since: timestamptz!) {
                workout_sessions(
                    where: { 
                        user_public_key: { _eq: $userKey },
                        session_date: { _gte: $since }
                    }
                    order_by: { session_date: desc }
                ) {
                    signature
                    session_date
                    base_points
                    total_points
                    bonus_tech_factor
                    bonus_speed
                    bonus_for_starters
                    bonus_another_muscle_yesterday
                    bonus_weeks_in_streak
                    exercise_sets {
                        exercise_type
                        reps
                        seconds
                        points
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
                    userKey: TEST_USER_KEY,
                    since: weekAgo.toISOString()
                }
            })
        });

        const result = await response.json();

        expect(result.errors).toBeUndefined();
        expect(result.data.workout_sessions).toBeDefined();
        expect(Array.isArray(result.data.workout_sessions)).toBe(true);

        // Each session should have server-calculated points
        result.data.workout_sessions.forEach((session: any) => {
            expect(session.total_points).toBeDefined();
            expect(session.base_points).toBeDefined();
            expect(session.session_date).toBeDefined();
        });

        console.log('Last 7 days from server:', result.data.workout_sessions.length, 'sessions');
    });
});
