/**
 * useAllUserGroups Hook
 * Hook for managing multiple groups per user
 */

import { useState, useEffect, useCallback } from 'react';
import { getUserGroups, UserGroup } from '../groupService';
import { getUserData } from '../authService';
import { getGroupLeaderboard } from '../statsService';

export interface GroupMembership {
    is_admin: boolean;
    joined_at: string;
    group: UserGroup;
    member_count: number;
}

export interface GroupMemberWithStats {
    user_public_key: string;
    nickname?: string;
    is_admin: boolean;
    joined_at: string;
    workout_count: number;
    total_points: number;
    last_workout_date?: string;
}

interface UseAllUserGroupsReturn {
    userGroups: GroupMembership[];
    selectedGroup: UserGroup | null;
    selectedGroupMembers: GroupMemberWithStats[];
    isAdmin: boolean;
    loading: boolean;
    error: string | null;
    selectGroup: (groupId: string | null) => void;
    loadGroups: () => Promise<void>;
    loadGroupMembers: (groupId: string) => Promise<void>;
}

export function useAllUserGroups(): UseAllUserGroupsReturn {
    const [userGroups, setUserGroups] = useState<GroupMembership[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMemberWithStats[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadGroups = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const user = await getUserData();
            if (!user || !user.publicKey) {
                setUserGroups([]);
                setLoading(false);
                return;
            }

            const memberships = await getUserGroups(user.publicKey);

            const groups: GroupMembership[] = memberships.map((m: any) => ({
                is_admin: m.is_admin,
                joined_at: m.joined_at,
                group: m.group,
                member_count: m.group.members?.length || 0
            }));

            setUserGroups(groups);

            // Auto-select first group if none selected
            if (!selectedGroup && groups.length > 0) {
                setSelectedGroup(groups[0].group);
                setIsAdmin(groups[0].is_admin);
            }

            setLoading(false);
        } catch (err) {
            console.error('[useAllUserGroups] Error loading groups:', err);
            setError(err instanceof Error ? err.message : 'Ошибка загрузки групп');
            setLoading(false);
        }
    }, [selectedGroup]);

    const loadGroupMembers = useCallback(async (groupId: string) => {
        try {
            const members = await getGroupLeaderboard(groupId);
            setSelectedGroupMembers(members);
        } catch (err) {
            console.error('[useAllUserGroups] Error loading group members:', err);
        }
    }, []);

    const selectGroup = useCallback((groupId: string | null) => {
        if (groupId === null) {
            setSelectedGroup(null);
            setSelectedGroupMembers([]);
            setIsAdmin(false);
            return;
        }

        const membership = userGroups.find(m => m.group.group_id === groupId);
        if (membership) {
            setSelectedGroup(membership.group);
            setIsAdmin(membership.is_admin);
            loadGroupMembers(groupId);
        }
    }, [userGroups, loadGroupMembers]);

    useEffect(() => {
        loadGroups();
    }, []);

    // Load members when selected group changes
    useEffect(() => {
        if (selectedGroup) {
            loadGroupMembers(selectedGroup.group_id);
        }
    }, [selectedGroup, loadGroupMembers]);

    return {
        userGroups,
        selectedGroup,
        selectedGroupMembers,
        isAdmin,
        loading,
        error,
        selectGroup,
        loadGroups,
        loadGroupMembers
    };
}
