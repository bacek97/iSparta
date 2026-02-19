/**
 * Time Bank Service for App Lock feature
 * Manages earned time, spent time, and credit system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    TimeBank,
    TimeEarningSource,
    TrackedApp,
    AppUsageRecord,
    calculateEarnedMinutes,
    createDefaultTimeBank,
    TIME_BANK_CONSTANTS,
} from './appLockTypes';
import { addUsageRecord, getTrackedApps as getTrackedAppsFromStorage, saveTrackedApps as saveTrackedAppsToStorage } from './appLockStorageService';

// Storage key for time bank
const TIME_BANK_KEY = '@iSparta:appLock:timeBank';

// Result types
export interface SpendResult {
    success: boolean;
    error?: string;
}

export interface CreditResult {
    success: boolean;
    error?: string;
}

/**
 * Get time bank from storage
 */
export async function getTimeBank(): Promise<TimeBank> {
    try {
        const data = await AsyncStorage.getItem(TIME_BANK_KEY);
        let timeBank: TimeBank;

        if (!data) {
            timeBank = createDefaultTimeBank();
        } else {
            timeBank = JSON.parse(data) as TimeBank;
        }

        // Calculate earned time from actual sessions
        const earnedFromSessions = await calculateEarnedFromSessions();
        timeBank.earnedMinutes = earnedFromSessions;

        return timeBank;
    } catch (error) {
        console.error('[timeBankService] Error loading time bank:', error);
        return createDefaultTimeBank();
    }
}

/**
 * Calculate earned minutes from all saved workout sessions
 * This reads directly from the same session data that LeaderboardScreen uses
 */
export async function calculateEarnedFromSessions(): Promise<number> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const sessionKeys = keys.filter(key => key.startsWith('session_'));

        let totalEarnedMinutes = 0;

        for (const key of sessionKeys) {
            const sessionData = await AsyncStorage.getItem(key);
            if (!sessionData) continue;

            try {
                const session = JSON.parse(sessionData);
                const exercises = session.exercises || {};

                // Squats: 1 rep = 1 min
                if (exercises.SQUATS?.reps) {
                    totalEarnedMinutes += exercises.SQUATS.reps;
                }

                // Pushups: 1 rep = 1 min
                if (exercises.PUSHUPS?.reps) {
                    totalEarnedMinutes += exercises.PUSHUPS.reps;
                }

                // Running: 1 km = 1 min
                if (exercises.RUNNING?.kilometers) {
                    totalEarnedMinutes += Math.floor(exercises.RUNNING.kilometers);
                }

                // Steps: 100 steps = 1 min
                if (exercises.STEPS?.reps) {
                    totalEarnedMinutes += Math.floor(exercises.STEPS.reps / 100);
                }
            } catch (parseError) {
                console.warn('[timeBankService] Error parsing session:', key, parseError);
            }
        }

        return totalEarnedMinutes;
    } catch (error) {
        console.error('[timeBankService] Error calculating earned from sessions:', error);
        return 0;
    }
}

/**
 * Save time bank to storage
 */
export async function saveTimeBank(timeBank: TimeBank): Promise<void> {
    try {
        timeBank.lastUpdated = new Date().toISOString();
        await AsyncStorage.setItem(TIME_BANK_KEY, JSON.stringify(timeBank));
    } catch (error) {
        console.error('[timeBankService] Error saving time bank:', error);
        throw error;
    }
}

/**
 * Reset time bank (for testing)
 */
export async function resetTimeBank(): Promise<void> {
    try {
        await AsyncStorage.removeItem(TIME_BANK_KEY);
    } catch (error) {
        console.error('[timeBankService] Error resetting time bank:', error);
    }
}

/**
 * Get tracked apps (re-export for convenience)
 */
export const getTrackedApps = getTrackedAppsFromStorage;
export const saveTrackedApps = saveTrackedAppsToStorage;

/**
 * Earn time from exercise
 * Automatically repays credit if any exists
 */
export async function earnTime(source: TimeEarningSource, amount: number): Promise<void> {
    // Validate input
    if (amount <= 0) {
        return;
    }

    const earnedMinutes = calculateEarnedMinutes(source, amount);
    if (earnedMinutes <= 0) {
        return;
    }

    const timeBank = await getTimeBank();

    // Add earned minutes
    timeBank.earnedMinutes += earnedMinutes;

    // Auto-repay credit if exists
    if (timeBank.creditMinutes > 0) {
        // Calculate how much we can repay from available balance
        const availableForRepay = timeBank.earnedMinutes - timeBank.spentMinutes;
        const repayAmount = Math.min(timeBank.creditMinutes, availableForRepay);

        if (repayAmount > 0) {
            timeBank.creditMinutes -= repayAmount;
        }
    }

    await saveTimeBank(timeBank);
}

/**
 * Spend time on app usage
 */
export async function spendTime(minutes: number, packageName: string): Promise<SpendResult> {
    if (minutes <= 0) {
        return { success: false, error: 'Invalid minutes amount' };
    }

    const timeBank = await getTimeBank();
    const available = timeBank.earnedMinutes - timeBank.spentMinutes - timeBank.creditMinutes;

    if (minutes > available) {
        return {
            success: false,
            error: `Insufficient time: requested ${minutes}, available ${available}`
        };
    }

    // Update time bank
    timeBank.spentMinutes += minutes;
    await saveTimeBank(timeBank);

    // Record usage
    const usageRecord: AppUsageRecord = {
        packageName,
        appName: packageName, // Could be resolved from tracked apps
        usageMinutes: minutes,
        date: new Date().toISOString(),
        wasCreditUsed: false,
    };
    await addUsageRecord(usageRecord);

    return { success: true };
}

/**
 * Request credit time
 */
export async function requestCredit(minutes: number, packageName: string): Promise<CreditResult> {
    if (minutes <= 0) {
        return { success: false, error: 'Invalid credit amount' };
    }

    const timeBank = await getTimeBank();
    const newCreditTotal = timeBank.creditMinutes + minutes;

    if (newCreditTotal > TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES) {
        return {
            success: false,
            error: `Credit request exceeds maximum. Current: ${timeBank.creditMinutes}, Requested: ${minutes}, Max: ${TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES}`
        };
    }

    // Add credit
    timeBank.creditMinutes = newCreditTotal;
    await saveTimeBank(timeBank);

    // Record usage with credit flag
    const usageRecord: AppUsageRecord = {
        packageName,
        appName: packageName,
        usageMinutes: minutes,
        date: new Date().toISOString(),
        wasCreditUsed: true,
    };
    await addUsageRecord(usageRecord);

    return { success: true };
}

/**
 * Manually repay credit
 */
export async function repayCredit(minutes: number): Promise<SpendResult> {
    if (minutes <= 0) {
        return { success: false, error: 'Invalid repay amount' };
    }

    const timeBank = await getTimeBank();

    // Check if there's credit to repay
    if (timeBank.creditMinutes <= 0) {
        return { success: false, error: 'No credit to repay' };
    }

    // Check if we have available time to repay
    const available = timeBank.earnedMinutes - timeBank.spentMinutes;
    if (minutes > available) {
        return {
            success: false,
            error: `Insufficient time to repay: requested ${minutes}, available ${available}`
        };
    }

    // Repay credit
    const actualRepay = Math.min(minutes, timeBank.creditMinutes);
    timeBank.creditMinutes -= actualRepay;
    timeBank.spentMinutes += actualRepay;

    await saveTimeBank(timeBank);

    return { success: true };
}

/**
 * Get available time (earned - spent - credit)
 */
export async function getAvailableTime(): Promise<number> {
    const timeBank = await getTimeBank();
    return timeBank.earnedMinutes - timeBank.spentMinutes - timeBank.creditMinutes;
}

/**
 * Check if app can be used (has available time or can take credit)
 */
export async function canUseApp(packageName: string): Promise<{
    canUse: boolean;
    availableMinutes: number;
    canTakeCredit: boolean;
    maxCreditAvailable: number;
}> {
    const timeBank = await getTimeBank();
    const available = timeBank.earnedMinutes - timeBank.spentMinutes - timeBank.creditMinutes;
    const maxCreditAvailable = TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES - timeBank.creditMinutes;

    return {
        canUse: available > 0,
        availableMinutes: Math.max(0, available),
        canTakeCredit: maxCreditAvailable > 0,
        maxCreditAvailable: Math.max(0, maxCreditAvailable),
    };
}
