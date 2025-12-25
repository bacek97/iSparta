import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SessionPointsBreakdown } from '../leaderboard';
import { messagesExercises } from '../types';

interface Props {
    sessions: SessionPointsBreakdown[];
}

export const SessionsList: React.FC<Props> = ({ sessions }) => {
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

    const toggleSession = (sessionId: string) => {
        setExpandedSessions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sessionId)) {
                newSet.delete(sessionId);
            } else {
                newSet.add(sessionId);
            }
            return newSet;
        });
    };

    if (sessions.length === 0) return null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Последние 7 дней</Text>
            {sessions.map((session) => {
                const isExpanded = expandedSessions.has(session.sessionId);
                return (
                    <TouchableOpacity
                        key={session.sessionId}
                        style={styles.sessionCard}
                        onPress={() => toggleSession(session.sessionId)}
                    >
                        <View style={styles.sessionHeader}>
                            <Text style={styles.sessionDate}>
                                {session.date.toLocaleDateString('ru', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </Text>
                            <Text style={styles.sessionPoints}>{session.totalPoints.toFixed(1)} баллов</Text>
                        </View>

                        {isExpanded && (
                            <View style={styles.sessionDetails}>
                                <Text style={styles.detailText}>Базовые: {session.basePoints.toFixed(1)}</Text>
                                {session.bonusTechFactor > 0 && (
                                    <Text style={styles.detailText}>+ Техника: {session.bonusTechFactor}</Text>
                                )}
                                {session.bonusSpeed > 0 && (
                                    <Text style={styles.detailText}>+ Скорость: {session.bonusSpeed}</Text>
                                )}
                                <View style={styles.exerciseList}>
                                    {session.exerciseBreakdown.map((ex, idx) => (
                                        <Text key={idx} style={styles.exerciseText}>
                                            • {messagesExercises.en[ex.exercise]}: {ex.points.toFixed(2)} баллов
                                        </Text>
                                    ))}
                                </View>
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
    sessionCard: {
        backgroundColor: '#f9f9f9',
        padding: 12,
        marginVertical: 6,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sessionDate: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    sessionPoints: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    sessionDetails: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    detailText: {
        fontSize: 14,
        color: '#666',
        marginVertical: 2,
    },
    exerciseList: {
        marginTop: 8,
    },
    exerciseText: {
        fontSize: 12,
        color: '#888',
        marginVertical: 1,
    },
});
