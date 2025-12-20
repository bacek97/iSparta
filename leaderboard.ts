import { SimpleWorkoutSession, SimpleExerciseRecord } from "./exerciseTrackingService";
import { EXERCISES, ExerciseType } from "./types"

const enum MuscleGroup {
    ARMS,
    LEGS,
    TORSO,
    BACK
}

const enum MuscleGroupRunning {
    RUNNING,
    CYCLING,
    SWIMMING
}

type CalorieCalculationType = 'caloriesPerRep' | 'caloriesPerSecond'

export type MuscleLoad = {
    0: CalorieCalculationType;
    1: { [K in MuscleGroup]: number }
    2: { [K in MuscleGroupRunning]: number }
}

export const caloriesByExercise: Record<EXERCISES, MuscleLoad> =
{
    [EXERCISES.SQUATS]: ['caloriesPerRep', [0.009, 0.186, 0.069, 0.036], [0, 0, 0]],
    [EXERCISES.LUNGES]: ['caloriesPerSecond', [0.010, 0.238, 0.068, 0.023], [0, 0, 0]],
    [EXERCISES.BICEP_CURLS]: ['caloriesPerSecond', [0.112, 0.007, 0.022, 0.007], [0, 0, 0]],
    [EXERCISES.SITUPS]: ['caloriesPerSecond', [0.0095, 0.028, 0.133, 0.019], [0, 0, 0]],
    [EXERCISES.PUSHUPS]: ['caloriesPerRep', [0.130, 0.026, 0.052, 0.052], [0, 0, 0]],
    [EXERCISES.TRICEP_EXTENSIONS]: ['caloriesPerSecond', [0.128, 0.003, 0.015, 0.0045], [0, 0, 0]],
    [EXERCISES.DUMBBELL_ROWS]: ['caloriesPerSecond', [0.072, 0.054, 0.090, 0.144], [0, 0, 0]],
    [EXERCISES.JUMPING_JACKS]: ['caloriesPerSecond', [0.110, 0.330, 0.082, 0.027], [0, 0, 0]],
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: ['caloriesPerSecond', [0.180, 0.015, 0.060, 0.045], [0, 0, 0]],
    [EXERCISES.LATERAL_SHOULDER_RAISES]: ['caloriesPerSecond', [0.158, 0.006, 0.032, 0.014], [0, 0, 0]],
    [EXERCISES.RUNNING]: ['caloriesPerSecond', [0, 0, 0, 0], [1, 0, 0]],
    [EXERCISES.CYCLING]: ['caloriesPerSecond', [0, 0, 0, 0], [0, 1, 0]],
    [EXERCISES.SWIMMING]: ['caloriesPerSecond', [0.110, 0.330, 0.082, 0.027], [0, 0, 1]],
    [EXERCISES.STEPS]: ['caloriesPerRep', [0, 0.001, 0, 0], [0, 0, 0]], // 1 point per 1000 steps (legs)
    [EXERCISES.UNKNOWN]: ['caloriesPerSecond', [0, 0, 0, 0], [0, 0, 0]],
}

// Mapping exercises to their primary muscle group
const exerciseToMuscleGroup: Record<EXERCISES, MuscleGroup | null> = {
    [EXERCISES.SQUATS]: MuscleGroup.LEGS,
    [EXERCISES.LUNGES]: MuscleGroup.LEGS,
    [EXERCISES.BICEP_CURLS]: MuscleGroup.ARMS,
    [EXERCISES.SITUPS]: MuscleGroup.TORSO,
    [EXERCISES.PUSHUPS]: MuscleGroup.ARMS,
    [EXERCISES.TRICEP_EXTENSIONS]: MuscleGroup.ARMS,
    [EXERCISES.DUMBBELL_ROWS]: MuscleGroup.BACK,
    [EXERCISES.JUMPING_JACKS]: MuscleGroup.LEGS,
    [EXERCISES.DUMBBELL_SHOULDER_PRESS]: MuscleGroup.ARMS,
    [EXERCISES.LATERAL_SHOULDER_RAISES]: MuscleGroup.ARMS,
    [EXERCISES.RUNNING]: MuscleGroup.LEGS,
    [EXERCISES.CYCLING]: MuscleGroup.LEGS,
    [EXERCISES.SWIMMING]: MuscleGroup.BACK,
    [EXERCISES.STEPS]: MuscleGroup.LEGS,
    [EXERCISES.UNKNOWN]: null,
}


// Interfaces for points breakdown
export interface SessionPointsBreakdown {
    sessionId: string;
    date: Date;
    basePoints: number;
    bonusTechFactor: number;
    bonusSpeed: number;
    bonusForStarters: number;
    bonusAnotherMuscleYesterday: number;
    bonusWeeksInStreak: number;
    totalPoints: number;
    exerciseBreakdown: ExercisePointsBreakdown[];
}

export interface ExercisePointsBreakdown {
    exercise: EXERCISES;
    calories: number;
    repsOrDuration: number;
    points: number;
}

export interface WeeklyStats {
    weekNumber: number;
    year: number;
    weekLabel: string; // e.g., "Неделя 54"
    totalPoints: number;
    totalBasePoints: number;
    totalBonuses: number;
    sessionCount: number;
    sessions: SessionPointsBreakdown[];
}

export interface MonthlyStats {
    month: number;
    year: number;
    monthLabel: string; // e.g., "Декабрь 2025"
    totalPoints: number;
    totalBasePoints: number;
    totalBonuses: number;
    sessionCount: number;
    sessions: SessionPointsBreakdown[];
}

// PointsCalculator class
export class PointsCalculator {

    /**
     * Calculate detailed points breakdown for a single workout session
     */
    static calculateSessionPoints(
        session: SimpleWorkoutSession,
        allSessions: SimpleWorkoutSession[] = []
    ): SessionPointsBreakdown {
        let basePoints = 0;
        const exerciseBreakdown: ExercisePointsBreakdown[] = [];

        // Calculate base points from calories × reps/duration
        Object.entries(session.exercises).forEach(([exerciseName, record]) => {
            const exercise = exerciseName as EXERCISES;
            if (exercise === EXERCISES.UNKNOWN) return;

            const calorieData = caloriesByExercise[exercise];
            const calculationType = calorieData[0];
            const muscleLoadCalories = calorieData[1];

            // Sum all muscle group calories
            const totalCalories = Object.values(muscleLoadCalories).reduce((sum, cal) => sum + cal, 0);

            // Calculate points based on type
            const repsOrDuration = calculationType === 'caloriesPerRep'
                ? (record.reps || 0)
                : record.duration;

            const exercisePoints = totalCalories * repsOrDuration;
            basePoints += exercisePoints;

            exerciseBreakdown.push({
                exercise,
                calories: totalCalories,
                repsOrDuration,
                points: exercisePoints
            });
        });

        // Calculate bonuses (placeholder values for now - can be enhanced later)
        // TODO: Implement actual tech_factor, speed detection from exerciseCounter
        const bonusTechFactor = 0; // Will be calculated from form quality
        const bonusSpeed = 0; // Will be calculated from exercise speed

        // Bonus for starters (based on muscle group difficulty)
        const bonusForStarters = this.calculateStarterBonus(session);

        // Bonus for training different muscle group than yesterday
        const bonusAnotherMuscleYesterday = this.calculateMuscleVarietyBonus(session, allSessions);

        // Bonus for consecutive weeks streak
        const bonusWeeksInStreak = this.calculateStreakBonus(session, allSessions);

        const totalPoints = basePoints + bonusTechFactor + bonusSpeed + bonusForStarters
            + bonusAnotherMuscleYesterday + bonusWeeksInStreak;

        return {
            sessionId: session.sessionId,
            date: new Date(session.startTime),
            basePoints,
            bonusTechFactor,
            bonusSpeed,
            bonusForStarters,
            bonusAnotherMuscleYesterday,
            bonusWeeksInStreak,
            totalPoints,
            exerciseBreakdown
        };
    }

    /**
     * Calculate starter bonus based on muscle groups trained
     */
    private static calculateStarterBonus(session: SimpleWorkoutSession): number {
        // Junior groups get more bonus, senior groups get less
        // This encourages beginners
        let bonus = 0;
        const juniorBonus = 20;
        const middleBonus = 10;
        const seniorBonus = 5;

        Object.keys(session.exercises).forEach(exerciseName => {
            const exercise = exerciseName as EXERCISES;
            const muscleGroup = exerciseToMuscleGroup[exercise];

            // Simple classification: ARMS = junior, LEGS = middle, TORSO/BACK = senior
            if (muscleGroup === MuscleGroup.ARMS) {
                bonus += juniorBonus;
            } else if (muscleGroup === MuscleGroup.LEGS) {
                bonus += middleBonus;
            } else if (muscleGroup === MuscleGroup.TORSO || muscleGroup === MuscleGroup.BACK) {
                bonus += seniorBonus;
            }
        });

        return bonus;
    }

    /**
     * Calculate bonus for training different muscle group than yesterday
     */
    private static calculateMuscleVarietyBonus(
        session: SimpleWorkoutSession,
        allSessions: SimpleWorkoutSession[]
    ): number {
        const sessionDate = new Date(session.startTime);
        const yesterday = new Date(sessionDate);
        yesterday.setDate(yesterday.getDate() - 1);

        // Find yesterday's sessions
        const yesterdaySessions = allSessions.filter(s => {
            const sDate = new Date(s.startTime);
            return sDate.toDateString() === yesterday.toDateString();
        });

        if (yesterdaySessions.length === 0) return 0;

        // Get muscle groups from today's session
        const todayMuscleGroups = new Set(
            Object.keys(session.exercises)
                .map(ex => exerciseToMuscleGroup[ex as EXERCISES])
                .filter(mg => mg !== null)
        );

        // Get muscle groups from yesterday's sessions
        const yesterdayMuscleGroups = new Set(
            yesterdaySessions.flatMap(s =>
                Object.keys(s.exercises)
                    .map(ex => exerciseToMuscleGroup[ex as EXERCISES])
                    .filter(mg => mg !== null)
            )
        );

        // Check if trained different muscle group
        const trainedDifferent = Array.from(todayMuscleGroups).some(
            mg => !yesterdayMuscleGroups.has(mg)
        );

        return trainedDifferent ? 15 : 0;
    }

    /**
     * Calculate bonus for consecutive weeks streak
     */
    private static calculateStreakBonus(
        session: SimpleWorkoutSession,
        allSessions: SimpleWorkoutSession[]
    ): number {
        const sessionDate = new Date(session.startTime);
        const currentWeek = this.getWeekNumber(sessionDate);
        const currentYear = sessionDate.getFullYear();

        // Count consecutive weeks with workouts before this session
        let streak = 0;
        let checkWeek = currentWeek - 1;
        let checkYear = currentYear;

        for (let i = 0; i < 52; i++) { // Check up to 52 weeks back
            if (checkWeek < 1) {
                checkWeek = 52;
                checkYear--;
            }

            const hasWorkoutInWeek = allSessions.some(s => {
                const sDate = new Date(s.startTime);
                return this.getWeekNumber(sDate) === checkWeek && sDate.getFullYear() === checkYear;
            });

            if (hasWorkoutInWeek) {
                streak++;
                checkWeek--;
            } else {
                break;
            }
        }

        // Bonus increases with streak: 0, 10, 20, 30, ..., up to 100
        return Math.min(streak * 10, 100);
    }

    /**
     * Get ISO week number for a date
     */
    static getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    /**
     * Calculate weekly points aggregation
     */
    static calculateWeeklyPoints(sessions: SimpleWorkoutSession[]): Map<string, WeeklyStats> {
        const weeklyMap = new Map<string, WeeklyStats>();

        sessions.forEach(session => {
            const sessionPoints = this.calculateSessionPoints(session, sessions);
            const date = new Date(session.startTime);
            const weekNumber = this.getWeekNumber(date);
            const year = date.getFullYear();
            const weekKey = `${year}-W${weekNumber}`;

            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                    weekNumber,
                    year,
                    weekLabel: `Неделя ${weekNumber}`,
                    totalPoints: 0,
                    totalBasePoints: 0,
                    totalBonuses: 0,
                    sessionCount: 0,
                    sessions: []
                });
            }

            const weekStats = weeklyMap.get(weekKey)!;
            weekStats.totalPoints += sessionPoints.totalPoints;
            weekStats.totalBasePoints += sessionPoints.basePoints;
            weekStats.totalBonuses += (sessionPoints.bonusTechFactor + sessionPoints.bonusSpeed
                + sessionPoints.bonusForStarters + sessionPoints.bonusAnotherMuscleYesterday
                + sessionPoints.bonusWeeksInStreak);
            weekStats.sessionCount++;
            weekStats.sessions.push(sessionPoints);
        });

        return weeklyMap;
    }

    /**
     * Calculate monthly points aggregation
     */
    static calculateMonthlyPoints(sessions: SimpleWorkoutSession[]): Map<string, MonthlyStats> {
        const monthlyMap = new Map<string, MonthlyStats>();
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

        sessions.forEach(session => {
            const sessionPoints = this.calculateSessionPoints(session, sessions);
            const date = new Date(session.startTime);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

            if (!monthlyMap.has(monthKey)) {
                monthlyMap.set(monthKey, {
                    month,
                    year,
                    monthLabel: `${monthNames[month - 1]} ${year}`,
                    totalPoints: 0,
                    totalBasePoints: 0,
                    totalBonuses: 0,
                    sessionCount: 0,
                    sessions: []
                });
            }

            const monthStats = monthlyMap.get(monthKey)!;
            monthStats.totalPoints += sessionPoints.totalPoints;
            monthStats.totalBasePoints += sessionPoints.basePoints;
            monthStats.totalBonuses += (sessionPoints.bonusTechFactor + sessionPoints.bonusSpeed
                + sessionPoints.bonusForStarters + sessionPoints.bonusAnotherMuscleYesterday
                + sessionPoints.bonusWeeksInStreak);
            monthStats.sessionCount++;
            monthStats.sessions.push(sessionPoints);
        });

        return monthlyMap;
    }
}