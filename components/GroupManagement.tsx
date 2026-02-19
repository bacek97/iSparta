/**
 * Group Management Component for Leaderboard
 * Unified list view - all groups shown with dynamic buttons based on membership
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { getCurrentUser } from '../authService';
import { getUserGroups, createGroup, joinGroupByName, removeMember, deleteGroup, getAllGroups, checkGroupNameExists, joinGroupById, GroupListItem, getGroupMembersById, GroupMemberInfo } from '../groupService';
import { getUserAllSessions, ServerWorkoutSession } from '../statsService';
import { getAutoSyncEnabled } from '../autoSyncService';
import { transferGroupOwnership, isGroupOwner } from '../groupManagementService';
import WeeklyStreakCalendar from '../WeeklyStreakCalendar';
import type { UserData } from '../authService';
import type { WeeklyStats } from '../leaderboard';
import type { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';
import { UserProfileModal } from './UserProfileModal';

interface GroupManagementProps {
    userGroup: any;
    groupMembers: any[];
    isAdmin: boolean;
    userData: UserData | null;
    onGroupChange: () => void;
}

export const GroupManagement: React.FC<GroupManagementProps> = ({
    userGroup,
    groupMembers,
    isAdmin,
    userData,
    onGroupChange
}) => {
    const [groupNameInput, setGroupNameInput] = useState('');
    const [allGroups, setAllGroups] = useState<GroupListItem[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());

    // Group preview modal state
    const [previewGroup, setPreviewGroup] = useState<GroupListItem | null>(null);
    const [previewMembers, setPreviewMembers] = useState<GroupMemberInfo[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // User profile modal state
    const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

    async function checkSyncBeforeAction(): Promise<boolean> {
        const syncEnabled = await getAutoSyncEnabled();
        if (!syncEnabled) {
            Alert.alert(
                'Синхронизация отключена',
                'Для участия в группах необходимо включить "Автоматическую синхронизацию" в Настройках. Это зарегистрирует ваш профиль на сервере.',
                [{ text: 'Понятно' }]
            );
            return false;
        }
        return true;
    }

    // Load all available groups and user's groups
    useEffect(() => {
        loadAllGroups();
        loadMyGroups();
    }, [userData?.publicKey]);

    async function loadAllGroups() {
        setLoadingGroups(true);
        try {
            const groups = await getAllGroups(50);
            setAllGroups(groups);
        } catch (error) {
            console.error('[GroupManagement] Load groups error:', error);
        } finally {
            setLoadingGroups(false);
        }
    }

    async function loadMyGroups() {
        if (!userData?.publicKey) return;
        try {
            const myGroups = await getUserGroups(userData.publicKey);
            console.log('[GroupManagement] My groups:', myGroups);
            // getUserGroups returns { group: { group_id } } objects
            setMyGroupIds(new Set(myGroups.map(g => g.group.group_id)));
        } catch (error) {
            console.error('[GroupManagement] Load my groups error:', error);
        }
    }

    async function handleCreateGroup() {
        if (!await checkSyncBeforeAction()) return;

        if (!groupNameInput.trim()) {
            Alert.alert('Ошибка', 'Введите название группы');
            return;
        }

        if (!userData?.publicKey) {
            Alert.alert('Ошибка', 'Не найден ключ пользователя');
            return;
        }

        try {
            // Check if group name already exists
            const exists = await checkGroupNameExists(groupNameInput.trim());
            if (exists) {
                Alert.alert('Ошибка', 'Группа с таким именем уже существует');
                return;
            }

            await createGroup(groupNameInput.trim(), userData.publicKey);
            setGroupNameInput('');
            Alert.alert('Успех', 'Группа создана!');
            loadAllGroups();
            loadMyGroups();
            onGroupChange();
        } catch (error) {
            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось создать группу');
        }
    }

    async function handleJoinGroupById(groupId: string) {
        if (!await checkSyncBeforeAction()) return;

        if (!userData) return;

        try {
            await joinGroupById(groupId, userData.publicKey);
            Alert.alert('Успех', 'Вы вступили в группу!');
            loadAllGroups();
            loadMyGroups();
            onGroupChange();
        } catch (error) {
            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось вступить');
        }
    }

    async function handleLeaveGroup(groupId: string, groupName: string) {
        if (!userData) return;

        Alert.alert(
            'Покинуть группу?',
            `Вы уверены, что хотите покинуть группу "${groupName}"?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Покинуть',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeMember(groupId, userData.publicKey);
                            Alert.alert('Готово', 'Вы покинули группу');
                            loadAllGroups();
                            loadMyGroups();
                            onGroupChange();
                        } catch (error) {
                            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось покинуть');
                        }
                    }
                }
            ]
        );
    }

    async function handleDeleteGroup(group: GroupListItem) {
        Alert.alert(
            'Удалить группу?',
            `Вы уверены, что хотите удалить группу "${group.group_name}"? Это действие необратимо.`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteGroup(group.group_id);
                            Alert.alert('Готово', 'Группа удалена');
                            loadAllGroups();
                            onGroupChange();
                        } catch (error) {
                            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось удалить');
                        }
                    }
                }
            ]
        );
    }

    async function handleOpenGroupPreview(group: GroupListItem) {
        setPreviewGroup(group);
        setLoadingPreview(true);
        try {
            const members = await getGroupMembersById(group.group_id);
            setPreviewMembers(members);
        } catch (error) {
            console.error('[GroupManagement] Load preview members error:', error);
            setPreviewMembers([]);
        } finally {
            setLoadingPreview(false);
        }
    }

    function handleOpenUserProfile(userKey: string) {
        setPreviewGroup(null);
        setSelectedUserKey(userKey);
    }

    // Check if user is member of a specific group
    const isUserInGroup = (groupId: string) => {
        return myGroupIds.has(groupId);
    };

    // Check if user is admin/owner of a specific group (from userGroup prop or check API)
    const isUserOwnerOfGroup = (groupId: string) => {
        // For now, use the isAdmin prop which is set for the primary userGroup
        return userGroup?.group_id === groupId && isAdmin;
    };

    return (
        <ScrollView style={styles.container}>
            {/* Create Group Section */}
            <Text style={styles.sectionTitle}>Создать группу</Text>
            <TextInput
                style={styles.groupInput}
                placeholder="Название новой группы"
                value={groupNameInput}
                onChangeText={setGroupNameInput}
                placeholderTextColor="#8E8E93"
            />
            <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
                <Text style={styles.buttonText}>Создать</Text>
            </TouchableOpacity>

            {/* All Groups List */}
            <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Все группы</Text>

            {loadingGroups ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 20 }} />
            ) : allGroups.length === 0 ? (
                <Text style={styles.emptyText}>Групп пока нет</Text>
            ) : (
                allGroups.map(group => {
                    const isMember = isUserInGroup(group.group_id);
                    const isGroupOwner = isUserOwnerOfGroup(group.group_id);

                    return (
                        <View key={group.group_id} style={[styles.groupListItem, isMember && styles.groupListItemActive]}>
                            <TouchableOpacity
                                style={styles.groupListInfo}
                                onPress={() => handleOpenGroupPreview(group)}
                            >
                                <View style={styles.groupNameRow}>
                                    <Text style={styles.groupListName}>{group.group_name}</Text>
                                    {isMember && <Text style={styles.memberBadge}>✓ Вы здесь</Text>}
                                </View>
                                <Text style={styles.groupListMembers}>
                                    👥 {group.member_count} участник{group.member_count === 1 ? '' : group.member_count < 5 ? 'а' : 'ов'} • нажмите для просмотра
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.groupActions}>
                                {!isMember ? (
                                    <TouchableOpacity
                                        style={styles.joinButton}
                                        onPress={() => handleJoinGroupById(group.group_id)}
                                    >
                                        <Text style={styles.joinButtonText}>Вступить</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            style={styles.leaveButton}
                                            onPress={() => handleLeaveGroup(group.group_id, group.group_name)}
                                        >
                                            <Text style={styles.leaveButtonText}>Выйти</Text>
                                        </TouchableOpacity>
                                        {isGroupOwner && (
                                            <TouchableOpacity
                                                style={styles.deleteButton}
                                                onPress={() => handleDeleteGroup(group)}
                                            >
                                                <Text style={styles.deleteButtonText}>🗑️</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    );
                })
            )}

            {/* Group Preview Modal */}
            <Modal
                visible={previewGroup !== null}
                animationType="slide"
                onRequestClose={() => setPreviewGroup(null)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            🏆 {previewGroup?.group_name}
                        </Text>
                        <TouchableOpacity onPress={() => setPreviewGroup(null)}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalContent}>
                        {loadingPreview ? (
                            <ActivityIndicator size="large" color="#4CAF50" style={{ marginVertical: 40 }} />
                        ) : previewMembers.length === 0 ? (
                            <Text style={styles.emptyText}>В группе пока нет участников</Text>
                        ) : (
                            previewMembers.map(member => (
                                <TouchableOpacity
                                    key={member.user_public_key}
                                    style={styles.previewMemberCard}
                                    onPress={() => handleOpenUserProfile(member.user_public_key)}
                                >
                                    <View style={styles.previewMemberInfo}>
                                        <Text style={styles.previewMemberName}>
                                            {member.user?.nickname || member.user_public_key.substring(0, 16) + '...'}
                                        </Text>
                                        {member.user?.fms_category && (
                                            <Text style={styles.previewMemberCategory}>
                                                {member.user.fms_category}
                                            </Text>
                                        )}
                                    </View>
                                    {member.is_admin && (
                                        <Text style={styles.adminBadge}>👑</Text>
                                    )}
                                    <Text style={styles.viewProfileArrow}>→</Text>
                                </TouchableOpacity>
                            ))
                        )}
                        {previewGroup && !isUserInGroup(previewGroup.group_id) && (
                            <TouchableOpacity
                                style={[styles.joinButton, { marginTop: 20, alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 12 }]}
                                onPress={() => {
                                    setPreviewGroup(null);
                                    handleJoinGroupById(previewGroup.group_id);
                                }}
                            >
                                <Text style={styles.joinButtonText}>Вступить в группу</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* User Profile Modal */}
            <UserProfileModal
                visible={selectedUserKey !== null}
                onClose={() => setSelectedUserKey(null)}
                user={selectedUserKey ? {
                    ed25519_public_key: selectedUserKey,
                    nickname: null
                } : null}
                currentUserKey={userData?.publicKey || ''}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 15,
        backgroundColor: '#1C1C1E',
        margin: 10,
        borderRadius: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 15,
    },
    groupInput: {
        backgroundColor: '#2C2C2E',
        borderRadius: 10,
        padding: 15,
        color: '#fff',
        fontSize: 16,
        marginBottom: 10,
    },
    createButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 20,
    },
    groupListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    groupListItemActive: {
        backgroundColor: '#1a3a1a',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    groupListInfo: {
        flex: 1,
    },
    groupNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    groupListName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    memberBadge: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 10,
        backgroundColor: '#1a3a1a',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    groupListMembers: {
        color: '#8E8E93',
        fontSize: 13,
    },
    groupActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    joinButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    joinButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    leaveButton: {
        backgroundColor: '#FF9500',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    leaveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
    },
    deleteButtonText: {
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#1C1C1E',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#2C2C2E',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        fontSize: 24,
        color: '#8E8E93',
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    previewMemberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    previewMemberInfo: {
        flex: 1,
    },
    previewMemberName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    previewMemberCategory: {
        color: '#4CAF50',
        fontSize: 13,
        marginTop: 3,
    },
    adminBadge: {
        fontSize: 18,
        marginRight: 10,
    },
    viewProfileArrow: {
        color: '#8E8E93',
        fontSize: 20,
    },
});
