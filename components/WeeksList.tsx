import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WeeklyStats } from '../leaderboard';

interface Props {
    weeks: WeeklyStats[];
}

export const WeeksList: React.FC<Props> = ({ weeks }) => {
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

    const toggleWeek = (weekKey: string) => {
        setExpandedWeeks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(weekKey)) {
                newSet.delete(weekKey);
            } else {
                newSet.add(weekKey);
            }
            return newSet;
        });
    };

    if (weeks.length === 0) return null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Предыдущие недели</Text>
            {weeks.map((week) => {
                const weekKey = `${week.year}-W${week.weekNumber}`;
                const isExpanded = expandedWeeks.has(weekKey);

                return (
                    <TouchableOpacity
                        key={weekKey}
                        style={styles.weekCard}
                        onPress={() => toggleWeek(weekKey)}
                    >
                        <View style={styles.weekHeader}>
                            <Text style={styles.weekLabel}>{week.weekLabel} ({week.year})</Text>
                            <Text style={styles.weekPoints}>{week.totalPoints.toFixed(1)} баллов</Text>
                        </View>
                        <Text style={styles.weekSubtext}>
                            {week.sessionCount} тренировок
                        </Text>

                        {isExpanded && (
                            <View style={styles.weekDetails}>
                                {week.sessions.map((session) => (
                                    <View key={session.sessionId} style={styles.weekSessionItem}>
                                        <Text style={styles.weekSessionDate}>
                                            {session.date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                                        </Text>
                                        <Text style={styles.weekSessionPoints}>{session.totalPoints.toFixed(1)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        margin: 10,
        padding: 15,
        borderRadius: 10,
        elevation: 3,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    weekCard: {
        backgroundColor: '#f0f0f0',
        padding: 12,
        marginVertical: 6,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    weekLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    weekPoints: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF9800',
    },
    weekSubtext: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    weekDetails: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    weekSessionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    weekSessionDate: {
        fontSize: 13,
        color: '#555',
    },
    weekSessionPoints: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF9800',
    },
});
