/**
 * NRA (Недельный Рейтинг Активности) calculation service
 * Uses functions from instructions_to_build_profile.ts
 */

import {
    calculateNRA,
    calculateWeeklyDisciplineScore,
    calculateLongTermMultiplier,
    calculateDynamicWas,
    calculateWeeklyMasteryBonus,
    MuscleGroup,
    type WeeklyNRAData,
    type DailyActivity,
} from './instructions_to_build_profile';
import {
    WorkoutSession,
    WeeklyStats,
    UserProfile,
} from './types';
import {
    loadWorkoutSessions,
    loadAllWeeklyStats,
    saveWeeklyStats,
    loadUserProfile,
    saveUserProfile,
} from './storageService';
import {
    getVirtualDate,
    getWeekStart,
    getWeekEnd,
    isSameWeek,
} from './testingUtils';

/**
 * Calculate NRA for a specific week
 */
export async function calculateWeeklyNRA(weekStartDate: Date): Promise<WeeklyStats> {
    const weekEndDate = getWeekEnd(weekStartDate);

    // Get all sessions for this week
    const allSessions = await loadWorkoutSessions();
    const weekSessions = allSessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= weekStartDate && sessionDate <= weekEndDate;
    });

    // Build daily log (7 days)
    const dailyLog: DailyActivity[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStartDate);
        day.setDate(weekStartDate.getDate() + i);

        // Find session for this day
        const daySession = weekSessions.find(session => {
            const sessionDate = new Date(session.date);
            return sessionDate.toDateString() === day.toDateString();
        });

        dailyLog.push({
            day: i + 1,
            group: daySession ? daySession.dominantMuscleGroup : MuscleGroup.NONE,
        });
    }

    // Calculate total volume (reps + minutes)
    let totalVolume = 0;
    weekSessions.forEach(session => {
        session.exercises.forEach(ex => {
            if (ex.reps) totalVolume += ex.reps;
            if (ex.durationSeconds) totalVolume += Math.floor(ex.durationSeconds / 60);
        });
    });

    // Get personal pace (average volume over last 4 weeks)
    const personalPace = await calculatePersonalPace(weekStartDate);

    // Get long-term streak
    const longTermStreakWeeks = await calculateStreakWeeks(weekStartDate);

    // Get new ranks achieved (placeholder - would need rank tracking system)
    const newRanksAchieved: number[] = [];

    // Calculate NRA using the formula from instructions_to_build_profile.ts
    const nraData: WeeklyNRAData = {
        longTermStreakWeeks,
        dailyLog,
        currentVolume: totalVolume,
        personalPace,
        newRanksAchieved,
    };

    const nraScore = calculateNRA(nraData);

    // Calculate components for display
    const wds = calculateWeeklyDisciplineScore(dailyLog);
    const multiplier = calculateLongTermMultiplier(longTermStreakWeeks);
    const was = calculateDynamicWas(totalVolume, personalPace);
    const wms = calculateWeeklyMasteryBonus(newRanksAchieved);

    // Count unique muscle groups worked
    const muscleGroupsWorked = Array.from(
        new Set(weekSessions.map(s => s.dominantMuscleGroup).filter(g => g !== MuscleGroup.NONE))
    ) as MuscleGroup[];

    // Count active days
    const daysActive = dailyLog.filter(d => d.group !== MuscleGroup.NONE).length;

    const weeklyStats: WeeklyStats = {
        weekStartDate,
        weekEndDate,
        sessions: weekSessions,
        totalVolume,
        muscleGroupsWorked,
        daysActive,
        nraScore,
        nraComponents: {
            wds,
            multiplier,
            was,
            wms,
        },
    };

    // Save weekly stats
    await saveWeeklyStats(weeklyStats);

    console.log(`[NRA] Calculated NRA for week ${weekStartDate.toLocaleDateString()}: ${nraScore}`);
    console.log(`  - WDS: ${wds}, Multiplier: ${multiplier}, WAS: ${was}, WMS: ${wms}`);

    return weeklyStats;
}

/**
 * Calculate personal pace (average volume over last 4 weeks)
 */
async function calculatePersonalPace(currentWeekStart: Date): Promise<number> {
    const allStats = await loadAllWeeklyStats();

    // Get last 4 weeks before current week
    const last4Weeks: WeeklyStats[] = [];
    for (let i = 1; i <= 4; i++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() - (i * 7));

        const weekStats = allStats.find(stat =>
            stat.weekStartDate.getTime() === weekStart.getTime()
        );

        if (weekStats) {
            last4Weeks.push(weekStats);
        }
    }

    if (last4Weeks.length === 0) {
        return 0; // No history yet
    }

    const totalVolume = last4Weeks.reduce((sum, stat) => sum + stat.totalVolume, 0);
    return Math.floor(totalVolume / last4Weeks.length);
}

/**
 * Calculate streak weeks (consecutive weeks with at least one workout)
 */
async function calculateStreakWeeks(currentWeekStart: Date): Promise<number> {
    const allStats = await loadAllWeeklyStats();

    // Sort by week start date descending
    const sortedStats = allStats
        .filter(stat => stat.weekStartDate < currentWeekStart)
        .sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime());

    let streak = 0;
    let expectedWeekStart = new Date(currentWeekStart);
    expectedWeekStart.setDate(expectedWeekStart.getDate() - 7);

    for (const stat of sortedStats) {
        if (stat.weekStartDate.getTime() === expectedWeekStart.getTime() && stat.daysActive > 0) {
            streak++;
            expectedWeekStart.setDate(expectedWeekStart.getDate() - 7);
        } else {
            break; // Streak broken
        }
    }

    return streak;
}

/**
 * Update current week NRA and user profile
 */
export async function updateCurrentWeekNRA(): Promise<void> {
    const virtualDate = await getVirtualDate();
    const weekStart = getWeekStart(virtualDate);

    const weeklyStats = await calculateWeeklyNRA(weekStart);

    // Update user profile with current NRA and streak
    const profile = await loadUserProfile();
    if (profile) {
        profile.currentNRA = weeklyStats.nraScore;

        if (weeklyStats.nraScore > profile.bestNRA) {
            profile.bestNRA = weeklyStats.nraScore;
        }

        profile.currentStreakWeeks = weeklyStats.nraComponents.multiplier > 1
            ? Math.floor((weeklyStats.nraComponents.multiplier - 1) / 0.05)
            : 0;

        if (profile.currentStreakWeeks > profile.bestStreakWeeks) {
            profile.bestStreakWeeks = profile.currentStreakWeeks;
        }

        await saveUserProfile(profile);
        console.log('[NRA] Updated user profile with current NRA and streak');
    }
}

/**
 * Get NRA history for display (last N weeks)
 */
export async function getNRAHistory(weeksCount: number = 12): Promise<WeeklyStats[]> {
    const allStats = await loadAllWeeklyStats();

    // Sort by week start date descending and take last N weeks
    return allStats
        .sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime())
        .slice(0, weeksCount);
}

/**
 * Get current week stats
 */
export async function getCurrentWeekStats(): Promise<WeeklyStats | null> {
    const virtualDate = await getVirtualDate();
    const weekStart = getWeekStart(virtualDate);

    const allStats = await loadAllWeeklyStats();
    const currentWeek = allStats.find(stat =>
        stat.weekStartDate.getTime() === weekStart.getTime()
    );

    if (currentWeek) {
        return currentWeek;
    }

    // If no stats for current week yet, calculate them
    return await calculateWeeklyNRA(weekStart);
}
