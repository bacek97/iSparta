import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { SimpleWorkoutSession } from './exerciseTrackingService';
import { EXERCISES, MuscleGroup } from './types';
import { PointsCalculator } from './leaderboard';

// --- Icons ---

const ArmsIcon = ({ size = 20, color = "#ff8a00" }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="-5 -10 96.9 93.6">
        <G fill={color}>
            <Path d="M89.3 69.4C64.2 88.8 27.5 80 4.1 63.8c-6-4.1-7.2-8.8-4.8-17L9.7 11C13.2-.3 17-7 26-7h13.6c4 0 7.6 8.2 7.6 14.6q0 2.6-.8 4-.7 1.3-1.9 1.2H42c1.2-3 .5-7.4-.8-10.9a1.6 1.6 0 1 0-3 1.2c1.5 3.6 1.7 7.6.6 9.2q-.3.6-1 .5h-3.3c1.1-3 .4-7.4-.9-10.9a1.6 1.6 0 0 0-3 1.1c1.5 3.7 1.7 7.7.7 9.3q-.4.6-1 .5H29c-2.5.2-4.5.2-7-3.2a1.6 1.6 0 0 0-2.5 1.8c2.9 4.1 6 4.6 8.4 4.6h1.7c.2 4.8.3 14.9-.4 20.1A26 26 0 0 0 20 46.4a1.6 1.6 0 0 0 2.8 1.4c3-6.2 9.3-11 16.4-12.4 5.4-1 13.6-.7 22.4 7q3.7 3.6 5 7.8a1.6 1.6 0 1 0 3-.8c-1-3.5-3-6.4-4.7-8.2 4-3.5 14.7-11.6 24.4-3.7a1.6 1.6 0 0 0 2-2.5c-9.6-7.7-21.2-2.8-28.7 4-7.3-5.9-15.8-8.3-24-6.6q-3.1.5-6 2c.4-5.7.3-14 .2-18.3h11.7q3 0 4.6-2.8 1.2-2.2 1.2-5.7C50.3.4 46.2-10 39.6-10H26C14-10 9.8-.1 6.7 10L-3.7 46c-2.8 9.6-1 15.5 6 20.5a95 95 0 0 0 52.4 17.2c13 0 25.8-3.4 36.6-11.8a1.6 1.6 0 1 0-2-2.4" />
        </G>
    </Svg>
);

const LegsIcon = ({ size = 20, color = "#16b139" }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="-5 -10 72 96.9">
        <G fill={color}>
            <Path d="M29.2 86.9h-30q-3.5-.2-4.1-3.2c-.4-2 .8-4 3-4.8l15-6.5c2.7-1.3 4.2-2.9 3.6-6.7l-6.6-38.6q-1.9-8.9 3.4-14.9c8-9.6 19.7-17.7 32-22.1a1.6 1.6 0 1 1 1 3C34.7-2.8 23.5 5 16 14.1c-3 3.4-3.8 7.2-2.8 12.3l6.7 38.7c1 6.2-2.5 8.6-5.5 10L-.8 81.8q-1.2.7-1 1.3t1 .6h30c2.5-.3 3-1.5 3-3.3q0-1.5-.5-3.7c-.7-3.4-1.5-7.6.4-12.3 3.7-9.2 4.2-26.3-.8-33.7a1.6 1.6 0 0 1 1-2.4C43.6 25.7 58.4 19.5 64 5.1a1.6 1.6 0 0 1 2.9 1.1C61 21.7 45.2 28.2 35 31c4.9 9.5 3.5 26.1 0 34.6-1.5 3.9-.8 7.5-.2 10.6q.5 2.4.5 4.3c0 2.6-1 5.8-5.9 6.5z" />
        </G>
    </Svg>
);

const TorsoIcon = ({ size = 20, color = "#770072" }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 66 66">
        <Path d="m58 15.5-3 31.8q0 .6.2 1.2l2.6 8.4v.1a5 5 0 0 1-3.4 6.2A77 77 0 0 1 33 66q-11.7 0-21.4-2.8a5 5 0 0 1-3.4-6.3l2.6-8.4q.2-.6.1-1.2L8 15.5a9 9 0 0 1-5.6-6L0 1.3a1 1 0 1 1 2-.6L4.3 9A7 7 0 0 0 11 14h16a1 1 0 0 1 0 2H10L13 47a5 5 0 0 1-.3 2l-2.6 8.4a3 3 0 0 0 2 3.8A75 75 0 0 0 33 64q11.5 0 20.8-2.7a3 3 0 0 0 2.1-3.7L53.3 49l-.2-1.9L55.9 16H39a1 1 0 0 1 0-2h16a7 7 0 0 0 6.7-5L64 .6a1 1 0 1 1 2 .6l-2.4 8.2a9 9 0 0 1-5.6 6m-25 44a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m20-50a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-40 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m19 22.9-4.7 1.5a1 1 0 1 1-.6-1.8l5.3-1.8V29a1 1 0 0 1 2 0v1.3l5.3 1.8a1 1 0 1 1-.6 1.8L34 32.4v5.9l5.3 1.8a1 1 0 1 1-.6 1.8L34 40.4v5.9l5.3 1.8a1 1 0 1 1-.6 1.8L34 48.4V51a1 1 0 0 1-2 0v-2.6l-4.7 1.5a1 1 0 1 1-.6-1.8l5.3-1.8v-6L27.3 42a1 1 0 1 1-.6-1.8l5.3-1.8ZM19 28a1 1 0 0 1 0-2h2a3 3 0 0 0 2.4-1.1l1.6-2a5 5 0 0 1 4-1.9h8a5 5 0 0 1 4 1.9l1.6 2a3 3 0 0 0 2.3 1.1H47a1 1 0 0 1 0 2h-2a5 5 0 0 1-4-1.9l-1.6-2a3 3 0 0 0-2.3-1.1h-8.2a3 3 0 0 0-2.3 1.1l-1.6 2a5 5 0 0 1-4 1.9Z" fill={color} />
    </Svg>
);

const BackIcon = ({ size = 20, color = "#0026cd" }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="-5 -10 94.1 96.9">
        <G fill={color}>
            <Path d="M83.1 59.2c-2.4-3.3-6.1-5.3-9.7-5.3-2.6 0-5.1 1-7.1 2.9l-5.3 5.3c-1.6 1.6-3.7 2.4-5.9 2.4-2.2 0-4.3-.9-5.9-2.4L38.6 51.5c-1.6-1.6-3.7-2.4-5.9-2.4-2.2 0-4.3.9-5.9 2.4l-5.3 5.3c-2 1.9-4.5 2.9-7.1 2.9-3.6 0-7.3-2-9.7-5.3-2.4-3.3-2.8-7.7-1.1-11.4l6.1-13.6c1.3-2.9 4.2-4.8 7.4-4.8h1.8c3.2 0 6.1 1.9 7.4 4.8l2.9 6.4c.8 1.8 2.6 2.9 4.5 2.9h.2c2 0 3.8-1.2 4.5-3.1l3.2-8c1.2-3 4.1-5 7.3-5 3.2 0 6.1 2 7.3 5l3.2 8c.7 1.9 2.5 3.1 4.5 3.1h.2c1.9 0 3.7-1.1 4.5-2.9l2.9-6.4c1.3-2.9 4.2-4.8 7.4-4.8h1.8c3.2 0 6.1 1.9 7.4 4.8l6.1 13.6c1.7 3.7 1.3 8.1-1.1 11.4z" />
            <Path d="M42.1 0C18.9 0 0 18.9 0 42.1c0 23.2 18.9 42.1 42.1 42.1 23.2 0 42.1-18.9 42.1-42.1C84.2 18.9 65.3 0 42.1 0zm0 76.8c-19.1 0-34.7-15.6-34.7-34.7S23 7.4 42.1 7.4 76.8 23 76.8 42.1 61.2 76.8 42.1 76.8z" opacity="0.2" />
        </G>
    </Svg>
);

const RunningIcon = ({ size = 20, color = "#16B139" }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" fill={color} />
    </Svg>
);

// --- Helper Functions ---

const getMuscleGroupForExercise = (exercise: EXERCISES): MuscleGroup | 'RUNNING' | null => {
    switch (exercise) {
        case EXERCISES.SQUATS:
        case EXERCISES.LUNGES:
        case EXERCISES.JUMPING_JACKS:
            return MuscleGroup.LEGS;
        case EXERCISES.BICEP_CURLS:
        case EXERCISES.TRICEP_EXTENSIONS:
        case EXERCISES.DUMBBELL_SHOULDER_PRESS:
        case EXERCISES.LATERAL_SHOULDER_RAISES:
            return MuscleGroup.ARMS;
        case EXERCISES.SITUPS:
        case EXERCISES.PUSHUPS:
            return MuscleGroup.TORSO; // Using TORSO/TORSO interchangeably for icon selection
        case EXERCISES.DUMBBELL_ROWS:
            return MuscleGroup.BACK;
        case EXERCISES.RUNNING:
        case EXERCISES.CYCLING:
        case EXERCISES.SWIMMING:
            return 'RUNNING';
        default:
            return null;
    }
};

const getIconForMuscleGroup = (group: MuscleGroup | 'RUNNING' | null, size: number) => {
    switch (group) {
        case MuscleGroup.ARMS: return <ArmsIcon size={size} />;
        case MuscleGroup.LEGS: return <LegsIcon size={size} />;
        case MuscleGroup.TORSO: return <TorsoIcon size={size} />; // Mapping TORSO to TorsoIcon
        case MuscleGroup.BACK: return <BackIcon size={size} />;
        case 'RUNNING': return <RunningIcon size={size} />;
        default: return null;
    }
};

// --- Component ---

interface WeeklyStreakCalendarProps {
    sessions: SimpleWorkoutSession[];
    onDateSelect?: (date: Date) => void;
    selectedDate?: Date;
}

const WeeklyStreakCalendar: React.FC<WeeklyStreakCalendarProps> = ({ sessions, onDateSelect, selectedDate }) => {
    const today = new Date();

    // Helper to get week key
    const getWeekKey = (date: Date) => `${date.getFullYear()}-W${PointsCalculator.getWeekNumber(date)}`;

    // Group sessions by week and day
    const sessionsByWeek = new Map<string, SimpleWorkoutSession[]>();
    const sessionsByDay = new Map<string, SimpleWorkoutSession[]>();

    sessions.forEach(session => {
        const date = new Date(session.startTime);
        const weekKey = getWeekKey(date);
        const dayKey = date.toISOString().split('T')[0];

        if (!sessionsByWeek.has(weekKey)) sessionsByWeek.set(weekKey, []);
        sessionsByWeek.get(weekKey)!.push(session);

        if (!sessionsByDay.has(dayKey)) sessionsByDay.set(dayKey, []);
        sessionsByDay.get(dayKey)!.push(session);
    });

    // Calculate XP for earlier weeks (2 rows = 14 weeks? No, user said 2 rows of week numbers. 
    // Let's assume 8 weeks per row like the example? 
    // Example: 
    // Row 1: EarlyWeeks | 42 | 43 | 44 | 45 | 46 | 47 | 48
    // Row 2: # | 28 | 29 | 30 | 31 | 32 | 33 | 34
    // Wait, the example has "EarlyWeeks" then 7 cells.
    // And another row starting with "#".
    // Let's try to fit 7 weeks per row.
    // We need 2 rows of earlier weeks. So 14 weeks total before the last 2 weeks.

    // Last 2 weeks:
    // Week N (Current)
    // Week N-1

    // Earlier weeks:
    // Week N-2 down to N-15

    const weeksToDisplay: { weekNum: number, year: number, xp: number, label: string }[] = [];

    // Generate last 16 weeks (2 current + 14 earlier)
    for (let i = 0; i < 16; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (i * 7));
        const weekNum = PointsCalculator.getWeekNumber(d);
        const year = d.getFullYear();
        const weekKey = `${year}-W${weekNum}`;

        const weekSessions = sessionsByWeek.get(weekKey) || [];
        const xp = weekSessions.reduce((sum, s) => sum + PointsCalculator.calculateSessionPoints(s, sessions).totalPoints, 0);

        weeksToDisplay.push({ weekNum, year, xp, label: weekNum.toString() });
    }

    // Split into categories
    const currentWeek = weeksToDisplay[0];
    const previousWeek = weeksToDisplay[1];
    const earlierWeeks = weeksToDisplay.slice(2).reverse(); // Chronological order for earlier weeks

    // Rows for earlier weeks (7 items per row)
    const row1 = earlierWeeks.slice(0, 7);
    const row2 = earlierWeeks.slice(7, 14);

    // Days for last 2 weeks
    const getDaysForWeek = (weekOffset: number) => {
        const days = [];
        const startOfWeek = new Date(today);
        const currentDay = today.getDay() || 7; // 1 (Mon) - 7 (Sun)

        // Adjust to Monday of the current week
        startOfWeek.setDate(today.getDate() - currentDay + 1);

        // Adjust to target week
        startOfWeek.setDate(startOfWeek.getDate() - (weekOffset * 7));

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            const dayKey = d.toISOString().split('T')[0];
            const daySessions = sessionsByDay.get(dayKey) || [];

            // Determine dominant muscle group
            let dominantGroup: MuscleGroup | 'RUNNING' | null = null;
            if (daySessions.length > 0) {
                // Simplified: take the first exercise's group or calculate max duration/reps
                // Let's aggregate duration per group
                const groupDuration: Record<string, number> = {};

                daySessions.forEach(s => {
                    Object.entries(s.exercises).forEach(([exName, rec]) => {
                        const ex = exName as EXERCISES;
                        if (rec.duration > 0 || (rec.reps && rec.reps > 0)) {
                            const group = getMuscleGroupForExercise(ex);
                            if (group) {
                                groupDuration[group] = (groupDuration[group] || 0) + rec.duration + (rec.reps || 0) * 5; // rough estimate
                            }
                        }
                    });
                });

                let maxVal = 0;
                Object.entries(groupDuration).forEach(([grp, val]) => {
                    if (val > maxVal) {
                        maxVal = val;
                        dominantGroup = grp as MuscleGroup | 'RUNNING';
                    }
                });
            }

            days.push({
                date: d,
                dayNum: d.getDate(),
                isToday: dayKey === today.toISOString().split('T')[0],
                hasActivity: daySessions.length > 0,
                muscleGroup: dominantGroup
            });
        }
        return days;
    };

    const currentWeekDays = getDaysForWeek(0);
    const previousWeekDays = getDaysForWeek(1);

    const renderWeekRow = (label: string, weeks: typeof earlierWeeks) => (
        <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>{label}</Text>
            </View>
            {weeks.map((w, i) => (
                <View key={i} style={styles.cell}>
                    <Text style={styles.xpText}>{w.xp > 0 ? Math.round(w.xp) : ''}</Text>
                    <Text style={styles.weekNumText}>{w.weekNum}</Text>
                </View>
            ))}
            {/* Fill empty cells if needed */}
            {Array.from({ length: 7 - weeks.length }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.cell} />
            ))}
        </View>
    );

    const renderDayRow = (weekNum: number, days: ReturnType<typeof getDaysForWeek>) => {
        // Check if a date matches the selectedDate
        const isSelected = (date: Date) => {
            if (!selectedDate) return false;
            return date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
        };

        return (
            <View style={styles.row}>
                <View style={[styles.cell, styles.headerCell]}>
                    <Text style={styles.headerText}>{weekNum}</Text>
                </View>
                {days.map((d, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[
                            styles.cell,
                            d.isToday && styles.todayCell,
                            isSelected(d.date) && styles.selectedCell
                        ]}
                        onPress={() => onDateSelect && onDateSelect(d.date)}
                    >
                        {d.hasActivity ? (
                            getIconForMuscleGroup(d.muscleGroup, 24)
                        ) : (
                            <Text style={[styles.dayText, d.isToday && styles.todayText]}>{d.dayNum}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Weekly Streak</Text>
            <View style={styles.table}>
                {/* Earlier Weeks Rows */}
                {renderWeekRow("Early", row1)}
                {renderWeekRow("#", row2)}

                {/* Header Row */}
                <View style={styles.row}>
                    <View style={[styles.cell, styles.headerCell]}>
                        <Text style={styles.headerText}>#</Text>
                    </View>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => (
                        <View key={i} style={styles.cell}>
                            <Text style={styles.headerText}>{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Recent Days Rows */}
                {renderDayRow(previousWeek.weekNum, previousWeekDays)}
                {renderDayRow(currentWeek.weekNum, currentWeekDays)}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#2a2a2a',
        margin: 10,
        padding: 15,
        borderRadius: 10,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    table: {
        flexDirection: 'column',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
        height: 40,
        alignItems: 'center',
    },
    cell: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    headerCell: {
        flex: 1.2, // Slightly wider for the label column
        alignItems: 'flex-start',
        paddingLeft: 5,
    },
    headerText: {
        color: '#999',
        fontSize: 12,
    },
    xpText: {
        color: '#4a9eff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    weekNumText: {
        color: '#666',
        fontSize: 10,
    },
    dayText: {
        color: '#ccc',
        fontSize: 14,
    },
    todayCell: {
        backgroundColor: 'rgba(74, 158, 255, 0.2)',
        borderRadius: 5,
    },
    todayText: {
        color: '#4a9eff',
        fontWeight: 'bold',
    },
    selectedCell: {
        backgroundColor: 'rgba(76, 175, 80, 0.3)',
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
});

export default WeeklyStreakCalendar;
