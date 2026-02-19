/**
 * GroupListComponent
 * Component for displaying and selecting from multiple groups
 */

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
} from 'react-native';
import { GroupMembership } from '../hooks/useAllUserGroups';

interface GroupListComponentProps {
    groups: GroupMembership[];
    selectedGroupId: string | null;
    onGroupSelect: (groupId: string | null) => void;
    onShowGlobal?: () => void;
}

export const GroupListComponent: React.FC<GroupListComponentProps> = ({
    groups,
    selectedGroupId,
    onGroupSelect,
    onShowGlobal
}) => {
    const renderGroupItem = ({ item }: { item: GroupMembership }) => {
        const isSelected = selectedGroupId === item.group.group_id;

        return (
            <TouchableOpacity
                style={[styles.groupItem, isSelected && styles.selectedGroup]}
                onPress={() => onGroupSelect(item.group.group_id)}
            >
                <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, isSelected && styles.selectedText]}>
                        {item.group.group_name}
                    </Text>
                    <Text style={styles.memberCount}>
                        {item.member_count} {getMemberWord(item.member_count)}
                    </Text>
                </View>
                {item.is_admin && (
                    <View style={styles.adminBadge}>
                        <Text style={styles.adminText}>Админ</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Мои группы</Text>

            {/* Global leaderboard option */}
            <TouchableOpacity
                style={[styles.groupItem, selectedGroupId === null && styles.selectedGroup]}
                onPress={() => {
                    onGroupSelect(null);
                    onShowGlobal?.();
                }}
            >
                <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, selectedGroupId === null && styles.selectedText]}>
                        🌍 Глобальный рейтинг
                    </Text>
                    <Text style={styles.memberCount}>
                        Все участники
                    </Text>
                </View>
            </TouchableOpacity>

            {groups.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        Вы пока не состоите в группах
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={groups}
                    keyExtractor={(item) => item.group.group_id}
                    renderItem={renderGroupItem}
                    scrollEnabled={false}
                />
            )}
        </View>
    );
};

// Helper function for Russian word forms
function getMemberWord(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return 'участников';
    }
    if (lastDigit === 1) {
        return 'участник';
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'участника';
    }
    return 'участников';
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    groupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedGroup: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedText: {
        color: '#4CAF50',
    },
    memberCount: {
        color: '#888',
        fontSize: 13,
    },
    adminBadge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    adminText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
});

export default GroupListComponent;
