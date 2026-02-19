/**
 * React Native bridge service for Android AppUsageStats native module
 * Provides TypeScript interface to the native functionality
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { InstalledApp } from './appLockTypes';

// Get native module
const { AppUsageStats } = NativeModules;

// Type definitions for native module responses
interface NativeInstalledApp {
    packageName: string;
    appName: string;
    icon?: string;
}

interface NativeUsageStats {
    packageName: string;
    appName: string;
    totalTimeInForeground: number; // milliseconds
    lastTimeUsed: number;
}

/**
 * Check if the AppUsageStats native module is available
 */
export function isAppUsageStatsAvailable(): boolean {
    return Platform.OS === 'android' && AppUsageStats != null;
}

/**
 * Check if app has usage stats permission
 */
export async function hasUsageStatsPermission(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.hasUsageStatsPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error checking permission:', error);
        return false;
    }
}

/**
 * Open system settings to request usage stats permission
 */
export async function requestUsageStatsPermission(): Promise<void> {
    if (!isAppUsageStatsAvailable()) {
        console.warn('[appUsageStatsService] Native module not available');
        return;
    }
    try {
        await AppUsageStats.requestUsageStatsPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error requesting permission:', error);
        throw error;
    }
}

/**
 * Get list of installed apps with launch intent
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
    if (!isAppUsageStatsAvailable()) {
        return [];
    }
    try {
        const apps: NativeInstalledApp[] = await AppUsageStats.getInstalledApps();
        return apps.map(app => ({
            packageName: app.packageName,
            appName: app.appName,
            icon: app.icon,
        }));
    } catch (error) {
        console.error('[appUsageStatsService] Error getting installed apps:', error);
        return [];
    }
}

/**
 * Get app usage statistics for a time range
 * @param startTime Start time in milliseconds since epoch
 * @param endTime End time in milliseconds since epoch
 */
export async function getAppUsageStats(startTime: number, endTime: number): Promise<NativeUsageStats[]> {
    if (!isAppUsageStatsAvailable()) {
        return [];
    }
    try {
        return await AppUsageStats.getAppUsageStats(startTime, endTime);
    } catch (error) {
        console.error('[appUsageStatsService] Error getting usage stats:', error);
        return [];
    }
}

/**
 * Get today's usage in minutes for specific packages
 */
export async function getTodayUsageForPackages(packageNames: string[]): Promise<Record<string, number>> {
    if (!isAppUsageStatsAvailable()) {
        return {};
    }
    try {
        return await AppUsageStats.getTodayUsageForPackages(packageNames);
    } catch (error) {
        console.error('[appUsageStatsService] Error getting today usage:', error);
        return {};
    }
}

/**
 * Get currently foreground app package name
 */
export async function getCurrentForegroundApp(): Promise<string | null> {
    if (!isAppUsageStatsAvailable()) {
        return null;
    }
    try {
        return await AppUsageStats.getCurrentForegroundApp();
    } catch (error) {
        console.error('[appUsageStatsService] Error getting foreground app:', error);
        return null;
    }
}

/**
 * Get total usage today across all apps in minutes
 */
export async function getTotalUsageToday(): Promise<number> {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const stats = await getAppUsageStats(startOfDay.getTime(), now);
    const totalMs = stats.reduce((sum, stat) => sum + stat.totalTimeInForeground, 0);
    return totalMs / 60000; // Convert to minutes
}

/**
 * Start the app monitoring service
 * @param packageNames List of package names to monitor
 */
export async function startAppMonitorService(packageNames: string[]): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        console.warn('[appUsageStatsService] Native module not available');
        return false;
    }
    try {
        return await AppUsageStats.startAppMonitorService(packageNames);
    } catch (error) {
        console.error('[appUsageStatsService] Error starting monitor service:', error);
        return false;
    }
}

/**
 * Stop the app monitoring service
 */
export async function stopAppMonitorService(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.stopAppMonitorService();
    } catch (error) {
        console.error('[appUsageStatsService] Error stopping monitor service:', error);
        return false;
    }
}

/**
 * Update the list of monitored packages in the running service
 */
export async function updateMonitoredPackages(packageNames: string[]): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.updateMonitoredPackages(packageNames);
    } catch (error) {
        console.error('[appUsageStatsService] Error updating monitored packages:', error);
        return false;
    }
}

/**
 * Check if the monitoring service is currently running
 */
export async function isMonitorServiceRunning(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.isMonitorServiceRunning();
    } catch (error) {
        console.error('[appUsageStatsService] Error checking service status:', error);
        return false;
    }
}

/**
 * Update available time in native SharedPreferences for the blocking service to check
 * This should be called whenever the time bank changes
 */
export async function updateAvailableTime(minutes: number): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.updateAvailableTime(Math.floor(minutes));
    } catch (error) {
        console.error('[appUsageStatsService] Error updating available time:', error);
        return false;
    }
}

/**
 * Get spent minutes tracked by native service
 */
export async function getSpentMinutesFromNative(): Promise<number> {
    if (!isAppUsageStatsAvailable()) {
        return 0;
    }
    try {
        return await AppUsageStats.getSpentMinutesFromNative();
    } catch (error) {
        console.error('[appUsageStatsService] Error getting native spent minutes:', error);
        return 0;
    }
}

/**
 * Reset native spent minutes counter after syncing to React Native
 */
export async function resetNativeSpentMinutes(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.resetNativeSpentMinutes();
    } catch (error) {
        console.error('[appUsageStatsService] Error resetting native spent minutes:', error);
        return false;
    }
}

/**
 * Check if overlay (draw over apps) permission is granted
 */
export async function hasOverlayPermission(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.hasOverlayPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error checking overlay permission:', error);
        return false;
    }
}

/**
 * Open overlay permission settings
 */
export async function requestOverlayPermission(): Promise<void> {
    if (!isAppUsageStatsAvailable()) {
        return;
    }
    try {
        await AppUsageStats.requestOverlayPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error requesting overlay permission:', error);
    }
}

/**
 * Check if accessibility service is enabled
 */
export async function hasAccessibilityPermission(): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        return await AppUsageStats.hasAccessibilityPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error checking accessibility permission:', error);
        return false;
    }
}

/**
 * Open accessibility settings
 */
export async function requestAccessibilityPermission(): Promise<void> {
    if (!isAppUsageStatsAvailable()) {
        return;
    }
    try {
        await AppUsageStats.requestAccessibilityPermission();
    } catch (error) {
        console.error('[appUsageStatsService] Error requesting accessibility permission:', error);
    }
}

/**
 * Save tracked packages to native SharedPreferences for accessibility service
 */
export async function saveTrackedPackagesToNative(packages: string[]): Promise<boolean> {
    if (!isAppUsageStatsAvailable()) {
        return false;
    }
    try {
        const packagesJson = JSON.stringify(packages);
        return await AppUsageStats.saveTrackedPackagesToNative(packagesJson);
    } catch (error) {
        console.error('[appUsageStatsService] Error saving tracked packages:', error);
        return false;
    }
}
