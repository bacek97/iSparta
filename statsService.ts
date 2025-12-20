/**
 * Stats Service - Client-side statistics and leaderboard
 * Handles workout statistics, history, and real-time subscriptions
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// ==================== TYPES ====================

interface UserStats {
    workout_count: number;
    total_points: number;
    average_points: number;
    base_points_sum: number;
}

interface WorkoutHistoryItem {
    signature: string;
    session_date: string;
    base_points: number;
    total_points: number;
    exercise_sets?: any[];
}

type UnsubscribeFunction = () => void;

// ==================== HELPER ====================

async function hasuraQuery(query: string, variables?: any) {
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

// ==================== GET USER STATS ====================

export async function getUserStats(userPublicKey: string): Promise<UserStats> {
    const query = `
        query GetUserStats($userPublicKey: String!) {
            workout_sessions_aggregate(
                where: { user_public_key: { _eq: $userPublicKey } }
            ) {
                aggregate {
                    count
                    sum {
                        total_points
                        base_points
                    }
                    avg {
                        total_points
                    }
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { userPublicKey });
    const agg = data.workout_sessions_aggregate.aggregate;

    return {
        workout_count: agg.count || 0,
        total_points: agg.sum?.total_points || 0,
        average_points: agg.avg?.total_points || 0,
        base_points_sum: agg.sum?.base_points || 0
    };
}

// ==================== GET WORKOUT HISTORY ====================

export async function getWorkoutHistory(
    userPublicKey: string,
    limit: number = 10
): Promise<WorkoutHistoryItem[]> {
    const query = `
        query GetWorkoutHistory($userPublicKey: String!, $limit: Int!) {
            workout_sessions(
                where: { user_public_key: { _eq: $userPublicKey } },
                order_by: { session_date: desc },
                limit: $limit
            ) {
                signature
                session_date
                base_points
                total_points
                exercise_sets {
                    hash_shazam
                    exercise_type
                    reps
                    seconds
                    points
                }
            }
        }
    `;

    const data = await hasuraQuery(query, { userPublicKey, limit });

    return data.workout_sessions;
}

// ==================== GET LAST 7 DAYS SESSIONS ====================

export interface ServerWorkoutSession {
    signature: string;
    session_date: string;
    base_points: number;
    total_points: number;
    bonus_tech_factor: number;
    bonus_speed: number;
    bonus_for_starters: number;
    bonus_another_muscle_yesterday: number;
    bonus_weeks_in_streak: number;
    exercise_sets: {
        exercise_type: string;
        reps: number | null;
        seconds: number;
        points: number;
    }[];
}

export async function getLast7DaysSessions(userPublicKey: string): Promise<ServerWorkoutSession[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const query = `
        query GetLast7DaysSessions($userPublicKey: String!, $since: timestamptz!) {
            workout_sessions(
                where: { 
                    user_public_key: { _eq: $userPublicKey },
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

    const data = await hasuraQuery(query, {
        userPublicKey,
        since: weekAgo.toISOString()
    });

    return data.workout_sessions;
}

// ==================== GET ALL USER SESSIONS (for calendar) ====================

export async function getUserAllSessions(userPublicKey: string): Promise<ServerWorkoutSession[]> {
    const query = `
        query GetUserAllSessions($userPublicKey: String!) {
            workout_sessions(
                where: { user_public_key: { _eq: $userPublicKey } }
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

    const data = await hasuraQuery(query, { userPublicKey });

    return data.workout_sessions;
}

// ==================== SUBSCRIBE TO GROUP WORKOUTS ====================

export function subscribeToGroupWorkouts(
    userPublicKey: string,
    callback: (workout: any) => void
): UnsubscribeFunction {
    const wsUrl = HASURA_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl, 'graphql-ws');

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
                session_date
                total_points
                user_public_key
                user {
                    ed25519_public_key
                    fms_category
                }
            }
        }
    `;

    ws.onopen = () => {
        // Initialize connection
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
            // Start subscription
            ws.send(JSON.stringify({
                id: '1',
                type: 'start',
                payload: {
                    query: subscription,
                    variables: {
                        userPublicKey
                    }
                }
            }));
        } else if (message.type === 'data') {
            const workouts = message.payload.data.workout_sessions;
            workouts.forEach((workout: any) => callback(workout));
        } else if (message.type === 'error') {
            console.error('Subscription error:', message.payload);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    // Return unsubscribe function
    return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.send(JSON.stringify({
                id: '1',
                type: 'stop'
            }));
            ws.close();
        }
    };
}

// ==================== GET GROUP LEADERBOARD ====================

export async function getGroupLeaderboard(
    groupId: string,
    period: 'week' | 'month' | 'all' = 'week'
): Promise<any[]> {
    // First get all members of the group
    const membersQuery = `
        query GetGroupMembers($groupId: String!) {
            group_members(where: { group_id: { _eq: $groupId } }) {
                user_public_key
                is_admin
            }
        }
    `;

    const membersData = await hasuraQuery(membersQuery, { groupId });
    const members = membersData.group_members;

    if (members.length === 0) {
        return [];
    }

    // Calculate date filter based on period
    let dateFilter: any = {};
    if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = { session_date: { _gte: weekAgo.toISOString() } };
    } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = { session_date: { _gte: monthAgo.toISOString() } };
    }

    // Get stats for each member
    const leaderboard = await Promise.all(
        members.map(async (member: any) => {
            try {
                const statsQuery = `
                    query GetUserStats($userPublicKey: String!) {
                        workout_sessions_aggregate(
                            where: { user_public_key: { _eq: $userPublicKey } }
                        ) {
                            aggregate {
                                count
                                sum {
                                    total_points
                                }
                            }
                        }
                    }
                `;

                const statsData = await hasuraQuery(statsQuery, {
                    userPublicKey: member.user_public_key
                });
                const agg = statsData.workout_sessions_aggregate.aggregate;

                return {
                    user_public_key: member.user_public_key,
                    is_admin: member.is_admin,
                    workout_count: agg.count || 0,
                    total_points: agg.sum?.total_points || 0
                };
            } catch (error) {
                console.error(`Error getting stats for ${member.user_public_key}:`, error);
                return {
                    user_public_key: member.user_public_key,
                    is_admin: member.is_admin,
                    workout_count: 0,
                    total_points: 0
                };
            }
        })
    );

    // Sort by points
    leaderboard.sort((a, b) => b.total_points - a.total_points);

    return leaderboard;
}

