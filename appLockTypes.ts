/**
 * Type definitions for App Lock feature
 * Allows tracking app usage and earning time through workouts
 */

/**
 * Information about an installed app
 */
export interface InstalledApp {
    packageName: string;
    appName: string;
    icon?: string; // base64 encoded icon
}

/**
 * Tracked app with selection state
 */
export interface TrackedApp extends InstalledApp {
    isTracked: boolean;
}

/**
 * Time bank state - tracks earned vs spent time
 */
export interface TimeBank {
    earnedMinutes: number;      // Total earned from workouts
    spentMinutes: number;       // Total used on apps
    creditMinutes: number;      // Current credit/debt
    lastUpdated: string;        // ISO date string
}

/**
 * Constants for time bank
 */
export const TIME_BANK_CONSTANTS = {
    MAX_CREDIT_MINUTES: 60,
    SQUATS_MINUTES_PER_REP: 1,
    PUSHUPS_MINUTES_PER_REP: 1,
    RUNNING_MINUTES_PER_KM: 1,
    STEPS_PER_MINUTE: 100,
} as const;

/**
 * App usage record for history
 */
export interface AppUsageRecord {
    packageName: string;
    appName: string;
    usageMinutes: number;
    date: string;           // ISO date string
    wasCreditUsed: boolean;
}

/**
 * Credit time request
 */
export interface CreditTimeRequest {
    minutes: number;
    packageName: string;
    requestedAt: string;    // ISO date string
}

/**
 * Time earning sources
 */
export enum TimeEarningSource {
    SQUATS = 'SQUATS',
    PUSHUPS = 'PUSHUPS',
    RUNNING = 'RUNNING',
    STEPS = 'STEPS',
}

/**
 * Time earning record
 */
export interface TimeEarningRecord {
    source: TimeEarningSource;
    amount: number;         // reps, km, or steps count
    earnedMinutes: number;
    date: string;           // ISO date string
}

/**
 * App lock state for React component
 */
export interface AppLockState {
    installedApps: InstalledApp[];
    trackedApps: TrackedApp[];
    timeBank: TimeBank;
    usageHistory: AppUsageRecord[];
    hasPermission: boolean;
    isMonitoringActive: boolean;
}

/**
 * Calculate available minutes from time bank
 */
export function calculateAvailableMinutes(timeBank: TimeBank): number {
    return timeBank.earnedMinutes - timeBank.spentMinutes - timeBank.creditMinutes;
}

/**
 * Check if credit can be taken
 */
export function canTakeCredit(timeBank: TimeBank, requestedMinutes: number): boolean {
    const newCreditTotal = timeBank.creditMinutes + requestedMinutes;
    return newCreditTotal <= TIME_BANK_CONSTANTS.MAX_CREDIT_MINUTES;
}

/**
 * Calculate earned minutes from exercise
 */
export function calculateEarnedMinutes(source: TimeEarningSource, amount: number): number {
    switch (source) {
        case TimeEarningSource.SQUATS:
            return amount * TIME_BANK_CONSTANTS.SQUATS_MINUTES_PER_REP;
        case TimeEarningSource.PUSHUPS:
            return amount * TIME_BANK_CONSTANTS.PUSHUPS_MINUTES_PER_REP;
        case TimeEarningSource.RUNNING:
            return amount * TIME_BANK_CONSTANTS.RUNNING_MINUTES_PER_KM;
        case TimeEarningSource.STEPS:
            return Math.floor(amount / TIME_BANK_CONSTANTS.STEPS_PER_MINUTE);
        default:
            return 0;
    }
}

/**
 * Create default time bank
 */
export function createDefaultTimeBank(): TimeBank {
    return {
        earnedMinutes: 0,
        spentMinutes: 0,
        creditMinutes: 0,
        lastUpdated: new Date().toISOString(),
    };
}
