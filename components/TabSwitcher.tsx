/**
 * Tab Switcher Component for Leaderboard
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
    activeTab: 'stats' | 'feed';
    onTabChange: (tab: 'stats' | 'feed') => void;
}

export const TabSwitcher: React.FC<Props> = ({ activeTab, onTabChange }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
                onPress={() => onTabChange('stats')}
            >
                <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
                    📊 Статистика
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
                onPress={() => onTabChange('feed')}
            >
                <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
                    📰 Публикации
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        margin: 10,
        borderRadius: 10,
        padding: 4,
        elevation: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: '#007AFF',
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    tabTextActive: {
        color: '#fff',
    },
});
