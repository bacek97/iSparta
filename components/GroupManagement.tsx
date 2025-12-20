/**
 * Group Management Component for Leaderboard
 * Handles group creation, joining, member display, and admin controls
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { getCurrentUser } from '../authService';
import { getUserGroups, createGroup, joinGroupByName, removeMember, deleteGroup } from '../groupService';
import { getUserAllSessions, ServerWorkoutSession } from '../statsService';
import WeeklyStreakCalendar from '../WeeklyStreakCalendar';
import type { UserData } from '../authService';
import type { WeeklyStats } from '../leaderboard';
import type { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

interface GroupMemberWithStats {
    user_public_key: string;
    is_admin: boolean;
    joined_at?: string;
    totalPoints: number;
    rank: number;
    weeklyStats?: WeeklyStats[];
    sessions?: SimpleWorkoutSession[];
}

interface GroupManagementProps {
    userGroup: any;
    groupMembers: GroupMemberWithStats[];
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
    const [selectedMember, setSelectedMember] = useState<GroupMemberWithStats | null>(null);
    const [memberSessions, setMemberSessions] = useState<SimpleWorkoutSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Load sessions when member is selected
    useEffect(() => {
        if (selectedMember) {
            loadMemberSessions(selectedMember.user_public_key);
        }
    }, [selectedMember?.user_public_key]);

    async function loadMemberSessions(userPublicKey: string) {
        setLoadingSessions(true);
        try {
            const sessions = await getUserAllSessions(userPublicKey);
            // Convert server sessions to SimpleWorkoutSession format for calendar
            const simpleSessions: SimpleWorkoutSession[] = sessions.map(s => ({
                sessionId: s.signature,
                startTime: new Date(s.session_date),
                endTime: new Date(s.session_date),
                exercises: Object.fromEntries(
                    s.exercise_sets.map(ex => [
                        ex.exercise_type,
                        {
                            duration: ex.seconds || 0,
                            reps: ex.reps || undefined,
                            direction: 0
                        }
                    ])
                ) as Record<EXERCISES, { duration: number; reps?: number; direction: number }>
            }));
            setMemberSessions(simpleSessions);
        } catch (error) {
            console.error('Error loading member sessions:', error);
            setMemberSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    }

    async function handleCreateGroup() {
        if (!userData || !groupNameInput.trim()) {
            Alert.alert('Ошибка', 'Введите название группы');
            return;
        }

        try {
            console.log('[GroupManagement] Creating group:', groupNameInput.trim(), 'for user:', userData.publicKey);
            await createGroup(groupNameInput.trim(), userData.publicKey);
            setGroupNameInput('');
            Alert.alert('Успех', 'Группа создана!');
            onGroupChange();
        } catch (error) {
            console.error('[GroupManagement] Create group error:', error);
            Alert.alert('Ошибка', `Не удалось создать группу: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async function handleJoinGroup() {
        if (!userData || !groupNameInput.trim()) {
            Alert.alert('Ошибка', 'Введите название группы');
            return;
        }

        try {
            await joinGroupByName(groupNameInput.trim(), userData.publicKey);
            setGroupNameInput('');
            Alert.alert('Успех', 'Вы присоединились к группе!');
            onGroupChange();
        } catch (error) {
            Alert.alert('Ошибка', 'Группа не найдена');
        }
    }

    async function handleLeaveGroup() {
        if (!userData || !userGroup) return;

        Alert.alert(
            'Покинуть группу?',
            'Вы уверены?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Покинуть',
                    style: 'destructive',
                    onPress: async () => {
                        await removeMember(userGroup.group_id, userData.publicKey);
                        Alert.alert('Вы покинули группу');
                        onGroupChange();
                    }
                }
            ]
        );
    }

    async function handleDeleteGroup() {
        if (!userGroup || !isAdmin) return;

        Alert.alert(
            'Удалить группу?',
            'Это действие нельзя отменить!',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteGroup(userGroup.group_id);
                        Alert.alert('Группа удалена');
                        onGroupChange();
                    }
                }
            ]
        );
    }

    async function handleRemoveMember(publicKey: string) {
        if (!userGroup || !isAdmin) return;

        Alert.alert(
            'Удалить участника?',
            'Вы уверены?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await removeMember(userGroup.group_id, publicKey);
                        Alert.alert('Участник удален');
                        onGroupChange();
                    }
                }
            ]
        );
    }

    if (!userGroup) {
        return (
            <View style={styles.groupManagement}>
                <Text style={styles.sectionTitle}>Создать или присоединиться к группе</Text>

                <TextInput
                    style={styles.groupInput}
                    placeholder="Название группы"
                    value={groupNameInput}
                    onChangeText={setGroupNameInput}
                    placeholderTextColor="#8E8E93"
                />

                <View style={styles.groupButtons}>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
                        <Text style={styles.buttonText}>Создать</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.joinButton} onPress={handleJoinGroup}>
                        <Text style={styles.buttonText}>Присоединиться</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.groupSection}>
            <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>🏆 {userGroup.group_name}</Text>
                {isAdmin && (
                    <TouchableOpacity onPress={handleDeleteGroup}>
                        <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Group Members List */}
            {groupMembers.map((member) => (
                <TouchableOpacity
                    key={member.user_public_key}
                    style={styles.memberCard}
                    onPress={() => setSelectedMember(member)}
                >
                    <View style={styles.memberRank}>
                        <Text style={styles.rankText}>#{member.rank}</Text>
                    </View>

                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                            {member.user_public_key.substring(0, 16)}...
                        </Text>
                        <Text style={styles.memberPoints}>
                            {member.totalPoints.toFixed(0)} баллов
                        </Text>
                    </View>

                    {member.is_admin && (
                        <Text style={styles.adminBadge}>👑</Text>
                    )}

                    {isAdmin && userData && member.user_public_key !== userData.publicKey && (
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoveMember(member.user_public_key)}
                        >
                            <Text>❌</Text>
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                <Text style={styles.leaveButtonText}>Покинуть группу</Text>
            </TouchableOpacity>

            {/* User Detail Modal */}
            <Modal
                visible={selectedMember !== null}
                animationType="slide"
                onRequestClose={() => setSelectedMember(null)}
            >
                {selectedMember && (
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedMember.user_public_key.substring(0, 20)}...
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedMember(null)}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <View style={styles.statsCard}>
                                <Text style={styles.statLabel}>Ранг в группе</Text>
                                <Text style={styles.statValue}>#{selectedMember.rank}</Text>
                            </View>

                            <View style={styles.statsCard}>
                                <Text style={styles.statLabel}>Всего баллов</Text>
                                <Text style={styles.statValue}>
                                    {selectedMember.totalPoints.toFixed(0)}
                                </Text>
                            </View>

                            {/* Weekly stats - only show if available */}
                            {selectedMember.weeklyStats && selectedMember.weeklyStats.length > 0 && (
                                <>
                                    <Text style={styles.weeklyTitle}>Статистика по неделям</Text>
                                    {selectedMember.weeklyStats.map((week, i) => (
                                        <View key={i} style={styles.weekCard}>
                                            <Text style={styles.weekText}>
                                                Неделя {week.weekNumber}, {week.year}
                                            </Text>
                                            <Text style={styles.weekPoints}>
                                                {week.totalPoints.toFixed(0)} баллов
                                            </Text>
                                        </View>
                                    ))}
                                </>
                            )}

                            {/* Calendar */}
                            {loadingSessions ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <Text style={styles.loadingText}>Загрузка...</Text>
                                </View>
                            ) : (
                                <WeeklyStreakCalendar sessions={memberSessions} />
                            )}
                        </ScrollView>
                    </View>
                )}
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    groupManagement: {
        padding: 20,
        backgroundColor: '#1C1C1E',
        margin: 10,
        borderRadius: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 15,
    },
    groupInput: {
        backgroundColor: '#2C2C2E',
        color: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    groupButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    createButton: {
        flex: 1,
        backgroundColor: '#34C759',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    joinButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    groupSection: {
        padding: 20,
        backgroundColor: '#1C1C1E',
        margin: 10,
        borderRadius: 10,
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    groupTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    deleteButton: {
        fontSize: 24,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    memberRank: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    rankText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 14,
        color: '#fff',
        fontFamily: 'monospace',
    },
    memberPoints: {
        fontSize: 16,
        fontWeight: '600',
        color: '#34C759',
        marginTop: 4,
    },
    adminBadge: {
        fontSize: 20,
        marginRight: 10,
    },
    removeButton: {
        padding: 5,
    },
    leaveButton: {
        backgroundColor: '#FF453A',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
    },
    leaveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#1C1C1E',
        borderBottomWidth: 1,
        borderBottomColor: '#38383A',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        fontSize: 28,
        color: '#fff',
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    statsCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 5,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    weeklyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 10,
        marginBottom: 10,
    },
    weekCard: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    weekText: {
        fontSize: 14,
        color: '#fff',
    },
    weekPoints: {
        fontSize: 14,
        fontWeight: '600',
        color: '#34C759',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#8E8E93',
        marginTop: 10,
        fontSize: 14,
    },
});
