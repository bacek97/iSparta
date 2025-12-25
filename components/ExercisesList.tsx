import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LeaderboardEntry } from '../utils/LeaderboardCalculator';
import { LeaderboardCalculator } from '../utils/LeaderboardCalculator';
import { ExerciseType, messagesExercises } from '../types';

interface Props {
    exercises: LeaderboardEntry[];
}

export const ExercisesList: React.FC<Props> = ({ exercises }) => {
    if (exercises.length === 0) return null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Упражнения</Text>
            {exercises.map((entry, index) => {
                const isRepBased = ExerciseType[entry.exercise] === 'reps';

                return (
                    <View
                        key={entry.exercise}
                        style={[styles.exerciseCard, !entry.isUnlocked && styles.exerciseCardLocked]}
                    >
                        <View style={styles.exerciseHeader}>
                            <Text style={styles.exerciseRank}>#{index + 1}</Text>
                            <Text style={styles.exerciseName}>{messagesExercises.en[entry.exercise]}</Text>
                            {entry.isUnlocked && <Text style={styles.unlockedBadge}>✓</Text>}
                        </View>

                        <View style={styles.exerciseStats}>
                            <Text style={styles.exerciseStatValue}>
                                {LeaderboardCalculator.formatDuration(entry.totalDuration)}
                            </Text>
                            {isRepBased && <Text style={styles.exerciseStatValue}>{entry.totalReps} reps</Text>}
                        </View>
                    </View>
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
    exerciseCard: {
        backgroundColor: '#f9f9f9',
        padding: 12,
        marginVertical: 6,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    exerciseCardLocked: {
        borderLeftColor: '#ccc',
        opacity: 0.7,
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    exerciseRank: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
        marginRight: 10,
        minWidth: 40,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    unlockedBadge: {
        fontSize: 20,
        color: '#4CAF50',
    },
    exerciseStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 8,
    },
    exerciseStatValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
});
