/**
 * Hook for managing group data in Leaderboard
 * Handles loading group members with their stats from server
 */

import { useState, useEffect } from 'react';
import { getUserGroups } from '../groupService';
import { getCurrentUser } from '../authService';
import { getGroupLeaderboard } from '../statsService';
import type { UserData } from '../authService';

interface GroupMemberWithStats {
    user_public_key: string;
    is_admin: boolean;
    joined_at?: string;
    totalPoints: number;
    rank: number;
    workout_count?: number;
    fms_category?: string;
}

interface UseGroupDataReturn {
    userGroup: any;
    groupMembers: GroupMemberWithStats[];
    isAdmin: boolean;
    userData: UserData | null;
    loading: boolean;
    error: string | null;
    loadGroupData: () => Promise<void>;
}

export function useGroupData(): UseGroupDataReturn {
    const [userGroup, setUserGroup] = useState<any>(null);
    const [groupMembers, setGroupMembers] = useState<GroupMemberWithStats[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadGroupData() {
        try {
            setLoading(true);
            setError(null);

            const user = await getCurrentUser();
            if (!user) {
                setLoading(false);
                return;
            }

            setUserData(user);

            const groups = await getUserGroups(user.publicKey);
            if (groups.length === 0) {
                setLoading(false);
                return;
            }

            const userGroupData = groups[0];
            setUserGroup(userGroupData.group);
            setIsAdmin(userGroupData.is_admin);

            // Get real leaderboard data from server
            try {
                const leaderboard = await getGroupLeaderboard(userGroupData.group.group_id, 'all');

                // Merge leaderboard data with member info
                const membersWithStats: GroupMemberWithStats[] = userGroupData.group.members.map((member: any) => {
                    const stats = leaderboard.find((l: any) => l.user_public_key === member.user_public_key);
                    return {
                        user_public_key: member.user_public_key,
                        is_admin: member.is_admin,
                        joined_at: member.joined_at,
                        totalPoints: stats?.total_points || 0,
                        workout_count: stats?.workout_count || 0,
                        fms_category: stats?.fms_category,
                        rank: 0
                    };
                });

                // Sort by points and add rank
                membersWithStats.sort((a, b) => b.totalPoints - a.totalPoints);
                membersWithStats.forEach((m, i) => m.rank = i + 1);

                setGroupMembers(membersWithStats);
            } catch (leaderboardError) {
                console.error('Error loading leaderboard:', leaderboardError);
                // Fallback: show members without stats
                const membersWithStats: GroupMemberWithStats[] = userGroupData.group.members.map((member: any, index: number) => ({
                    user_public_key: member.user_public_key,
                    is_admin: member.is_admin,
                    joined_at: member.joined_at,
                    totalPoints: 0,
                    rank: index + 1
                }));
                setGroupMembers(membersWithStats);
            }
        } catch (err) {
            console.error('Error loading group data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load group data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadGroupData();
    }, []);

    return {
        userGroup,
        groupMembers,
        isAdmin,
        userData,
        loading,
        error,
        loadGroupData
    };
}
