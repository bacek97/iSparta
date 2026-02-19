/**
 * Storage service for App Lock feature
 * Handles persistence of tracked apps and usage history
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedApp, AppUsageRecord } from './appLockTypes';

// Storage keys
const KEYS = {
    TRACKED_APPS: '@iSparta:appLock:trackedApps',
    USAGE_HISTORY: '@iSparta:appLock:usageHistory',
};

/**
 * Get tracked apps from storage
 */
export async function getTrackedApps(): Promise<TrackedApp[]> {
    try {
        const data = await AsyncStorage.getItem(KEYS.TRACKED_APPS);
        if (!data) {
            return [];
        }
        return JSON.parse(data) as TrackedApp[];
    } catch (error) {
        console.error('[appLockStorageService] Error loading tracked apps:', error);
        return [];
    }
}

/**
 * Save tracked apps to storage
 */
export async function saveTrackedApps(apps: TrackedApp[]): Promise<void> {
    try {
        await AsyncStorage.setItem(KEYS.TRACKED_APPS, JSON.stringify(apps));
    } catch (error) {
        console.error('[appLockStorageService] Error saving tracked apps:', error);
        throw error;
    }
}

/**
 * Update tracking status for a single app
 */
export async function updateAppTracking(packageName: string, isTracked: boolean): Promise<void> {
    const apps = await getTrackedApps();
    const index = apps.findIndex(a => a.packageName === packageName);

    if (index >= 0) {
        apps[index].isTracked = isTracked;
        await saveTrackedApps(apps);
    }
}

/**
 * Get list of package names that are currently tracked
 */
export async function getTrackedPackageNames(): Promise<string[]> {
    const apps = await getTrackedApps();
    return apps.filter(a => a.isTracked).map(a => a.packageName);
}

/**
 * Get usage history
 */
export async function getUsageHistory(): Promise<AppUsageRecord[]> {
    try {
        const data = await AsyncStorage.getItem(KEYS.USAGE_HISTORY);
        if (!data) {
            return [];
        }
        return JSON.parse(data) as AppUsageRecord[];
    } catch (error) {
        console.error('[appLockStorageService] Error loading usage history:', error);
        return [];
    }
}

/**
 * Add usage record to history
 */
export async function addUsageRecord(record: AppUsageRecord): Promise<void> {
    try {
        const history = await getUsageHistory();
        history.push(record);

        // Keep only last 100 records to prevent unbounded growth
        const trimmedHistory = history.slice(-100);

        await AsyncStorage.setItem(KEYS.USAGE_HISTORY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.error('[appLockStorageService] Error adding usage record:', error);
        throw error;
    }
}

/**
 * Get usage for a specific app today
 */
export async function getTodayUsageForApp(packageName: string): Promise<number> {
    const history = await getUsageHistory();
    const today = new Date().toISOString().split('T')[0];

    return history
        .filter(r => r.packageName === packageName && r.date.startsWith(today))
        .reduce((sum, r) => sum + r.usageMinutes, 0);
}

/**
 * Get total usage today across all apps
 */
export async function getTotalUsageToday(): Promise<number> {
    const history = await getUsageHistory();
    const today = new Date().toISOString().split('T')[0];

    return history
        .filter(r => r.date.startsWith(today))
        .reduce((sum, r) => sum + r.usageMinutes, 0);
}

/**
 * Clear usage history (for testing)
 */
export async function clearUsageHistory(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEYS.USAGE_HISTORY);
    } catch (error) {
        console.error('[appLockStorageService] Error clearing usage history:', error);
        throw error;
    }
}

/**
 * Clear all app lock data (for testing)
 */
export async function clearAllAppLockData(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([KEYS.TRACKED_APPS, KEYS.USAGE_HISTORY]);
    } catch (error) {
        console.error('[appLockStorageService] Error clearing all data:', error);
        throw error;
    }
}
