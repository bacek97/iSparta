import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LeaderboardCalculator } from '../utils/LeaderboardCalculator';

interface Props {
    totalWorkouts: number;
    totalWorkoutTime: number;
    totalPoints: number;
}

export const StatsCard: React.FC<Props> = ({ totalWorkouts, totalWorkoutTime, totalPoints }) => {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Общая статистика</Text>
            <View style={styles.row}>
                <Text style={styles.label}>Всего тренировок:</Text>
                <Text style={styles.value}>{totalWorkouts}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Общее время:</Text>
                <Text style={styles.value}>{LeaderboardCalculator.formatDuration(totalWorkoutTime)}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Всего баллов:</Text>
                <Text style={styles.value}>{totalPoints.toFixed(1)}</Text>
            </View>
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
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 5,
    },
    label: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    value: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
});
