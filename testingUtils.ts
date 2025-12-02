/**
 * Testing utilities for simulating date changes
 * Allows testing NRA calculations without waiting for real days to pass
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DATE_OFFSET_KEY = '@iSparta:dateOffset';

/**
 * Get the current virtual date (real date + offset)
 */
export async function getVirtualDate(): Promise<Date> {
    try {
        const offsetStr = await AsyncStorage.getItem(DATE_OFFSET_KEY);
        const offsetDays = offsetStr ? parseInt(offsetStr, 10) : 0;

        const now = new Date();
        now.setDate(now.getDate() + offsetDays);

        return now;
    } catch (error) {
        console.error('Error getting virtual date:', error);
        return new Date();
    }
}

/**
 * Get the current date offset in days
 */
export async function getDateOffset(): Promise<number> {
    try {
        const offsetStr = await AsyncStorage.getItem(DATE_OFFSET_KEY);
        return offsetStr ? parseInt(offsetStr, 10) : 0;
    } catch (error) {
        console.error('Error getting date offset:', error);
        return 0;
    }
}

/**
 * Set the date offset in days
 */
async function setDateOffset(days: number): Promise<void> {
    try {
        await AsyncStorage.setItem(DATE_OFFSET_KEY, days.toString());
        console.log(`[TestingUtils] Date offset set to ${days} days`);
    } catch (error) {
        console.error('Error setting date offset:', error);
    }
}

/**
 * Move to the next day (for testing)
 * Returns the new virtual date
 */
export async function moveToNextDay(): Promise<Date> {
    const currentOffset = await getDateOffset();
    const newOffset = currentOffset + 1;
    await setDateOffset(newOffset);

    const newDate = await getVirtualDate();
    console.log(`[TestingUtils] Moved to next day. Virtual date: ${newDate.toLocaleDateString()}`);

    return newDate;
}

/**
 * Move to the previous day (Ctrl+Z / undo)
 * Returns the new virtual date
 */
export async function moveToPreviousDay(): Promise<Date> {
    const currentOffset = await getDateOffset();
    const newOffset = currentOffset - 1;
    await setDateOffset(newOffset);

    const newDate = await getVirtualDate();
    console.log(`[TestingUtils] Moved to previous day. Virtual date: ${newDate.toLocaleDateString()}`);

    return newDate;
}

/**
 * Reset date offset to 0 (return to real date)
 */
export async function resetDateOffset(): Promise<void> {
    await setDateOffset(0);
    console.log('[TestingUtils] Date offset reset to 0');
}

/**
 * Get a formatted string showing current virtual date and offset
 */
export async function getDateInfo(): Promise<string> {
    const virtualDate = await getVirtualDate();
    const offset = await getDateOffset();
    const realDate = new Date();

    if (offset === 0) {
        return `Real date: ${realDate.toLocaleDateString()}`;
    }

    return `Virtual date: ${virtualDate.toLocaleDateString()} (${offset > 0 ? '+' : ''}${offset} days from ${realDate.toLocaleDateString()})`;
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

/**
 * Get the end of the week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
}

/**
 * Check if two dates are in the same week
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
    const week1Start = getWeekStart(date1);
    const week2Start = getWeekStart(date2);
    return week1Start.getTime() === week2Start.getTime();
}

/**
 * Get week number in year (ISO week)
 */
export function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
