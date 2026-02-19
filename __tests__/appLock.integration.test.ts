/**
 * Integration tests for App Lock feature
 * TDD approach - tests first, then implementation
 * No mocks - uses real AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    TimeBank,
    TrackedApp,
    TimeEarningSource,
    TIME_BANK_CONSTANTS,
    calculateAvailableMinutes,
    canTakeCredit,
    calculateEarnedMinutes,
    createDefaultTimeBank,
} from '../appLockTypes';

// Import services (to be implemented)
import {
    getTimeBank,
    saveTimeBank,
    getTrackedApps,
    saveTrackedApps,
    earnTime,
    spendTime,
    requestCredit,
    repayCredit,
    resetTimeBank,
} from '../timeBankService';

import {
    getUsageHistory,
    addUsageRecord,
    clearUsageHistory,
} from '../appLockStorageService';

// Test prefix for isolation
const TEST_PREFIX = '@iSparta:test:appLock:';

describe('App Lock Integration Tests', () => {
    beforeEach(async () => {
        // Clear test data before each test
        const keys = await AsyncStorage.getAllKeys();
        const testKeys = keys.filter(k => k.startsWith(TEST_PREFIX) || k.includes('appLock'));
        if (testKeys.length > 0) {
            await AsyncStorage.multiRemove(testKeys);
        }
        await resetTimeBank();
    });

    afterAll(async () => {
        // Cleanup after all tests
        await resetTimeBank();
    });

    describe('Type Utilities', () => {
        it('should calculate available minutes correctly', () => {
            const timeBank: TimeBank = {
                earnedMinutes: 100,
                spentMinutes: 30,
                creditMinutes: 20,
                lastUpdated: new Date().toISOString(),
            };

            expect(calculateAvailableMinutes(timeBank)).toBe(50);
        });

        it('should check credit limit correctly', () => {
            const timeBank: TimeBank = {
                earnedMinutes: 0,
                spentMinutes: 0,
                creditMinutes: 40,
                lastUpdated: new Date().toISOString(),
            };

            expect(canTakeCredit(timeBank, 20)).toBe(true);  // 40 + 20 = 60 <= 60
            expect(canTakeCredit(timeBank, 21)).toBe(false); // 40 + 21 = 61 > 60
        });

        it('should calculate earned minutes from squats', () => {
            expect(calculateEarnedMinutes(TimeEarningSource.SQUATS, 10)).toBe(10);
        });

        it('should calculate earned minutes from pushups', () => {
            expect(calculateEarnedMinutes(TimeEarningSource.PUSHUPS, 5)).toBe(5);
        });

        it('should calculate earned minutes from running', () => {
            expect(calculateEarnedMinutes(TimeEarningSource.RUNNING, 2)).toBe(2);
        });

        it('should calculate earned minutes from steps', () => {
            expect(calculateEarnedMinutes(TimeEarningSource.STEPS, 300)).toBe(3);
            expect(calculateEarnedMinutes(TimeEarningSource.STEPS, 150)).toBe(1);
            expect(calculateEarnedMinutes(TimeEarningSource.STEPS, 50)).toBe(0);
        });
    });

    describe('Time Bank Earning', () => {
        it('should earn 10 minutes from 10 squats', async () => {
            await earnTime(TimeEarningSource.SQUATS, 10);

            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(10);
        });

        it('should earn 5 minutes from 5 pushups', async () => {
            await earnTime(TimeEarningSource.PUSHUPS, 5);

            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(5);
        });

        it('should earn 2 minutes from 2km running', async () => {
            await earnTime(TimeEarningSource.RUNNING, 2);

            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(2);
        });

        it('should earn 3 minutes from 300 steps', async () => {
            await earnTime(TimeEarningSource.STEPS, 300);

            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(3);
        });

        it('should accumulate earnings from multiple sources', async () => {
            await earnTime(TimeEarningSource.SQUATS, 5);
            await earnTime(TimeEarningSource.PUSHUPS, 3);
            await earnTime(TimeEarningSource.RUNNING, 1);

            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(9); // 5 + 3 + 1
        });
    });

    describe('Time Bank Spending', () => {
        it('should spend time and update balance', async () => {
            await earnTime(TimeEarningSource.SQUATS, 10);
            const result = await spendTime(5, 'com.example.app');

            expect(result.success).toBe(true);

            const timeBank = await getTimeBank();
            expect(timeBank.spentMinutes).toBe(5);
            expect(calculateAvailableMinutes(timeBank)).toBe(5);
        });

        it('should fail to spend more than available', async () => {
            await earnTime(TimeEarningSource.SQUATS, 5);
            const result = await spendTime(10, 'com.example.app');

            expect(result.success).toBe(false);
            expect(result.error?.toLowerCase()).toContain('insufficient');

            const timeBank = await getTimeBank();
            expect(timeBank.spentMinutes).toBe(0);
        });

        it('should track usage history when spending', async () => {
            await earnTime(TimeEarningSource.SQUATS, 10);
            await spendTime(5, 'com.example.app');

            const history = await getUsageHistory();
            expect(history.length).toBe(1);
            expect(history[0].packageName).toBe('com.example.app');
            expect(history[0].usageMinutes).toBe(5);
        });
    });

    describe('Credit System', () => {
        it('should allow taking credit up to 60 minutes', async () => {
            const result = await requestCredit(60, 'com.example.app');

            expect(result.success).toBe(true);

            const timeBank = await getTimeBank();
            expect(timeBank.creditMinutes).toBe(60);
        });

        it('should reject credit request over 60 minutes', async () => {
            const result = await requestCredit(61, 'com.example.app');

            expect(result.success).toBe(false);
            expect(result.error).toContain('exceeds');
        });

        it('should reject credit when already at max', async () => {
            await requestCredit(60, 'com.example.app');
            const result = await requestCredit(1, 'com.example.app');

            expect(result.success).toBe(false);
        });

        it('should auto-repay credit from new earnings', async () => {
            // Take 30 min credit
            await requestCredit(30, 'com.example.app');

            // Earn 50 minutes
            await earnTime(TimeEarningSource.SQUATS, 50);

            const timeBank = await getTimeBank();
            // Credit should be repaid: 30 - 50 = 0 (can't go negative)
            expect(timeBank.creditMinutes).toBe(0);
            // Remaining earned: 50 - 30 = 20
            expect(timeBank.earnedMinutes).toBe(50);
        });

        it('should partially repay credit if earnings are less', async () => {
            // Take 30 min credit
            await requestCredit(30, 'com.example.app');

            // Earn 10 minutes
            await earnTime(TimeEarningSource.SQUATS, 10);

            const timeBank = await getTimeBank();
            // Credit should be reduced: 30 - 10 = 20
            expect(timeBank.creditMinutes).toBe(20);
            expect(timeBank.earnedMinutes).toBe(10);
        });
    });

    describe('Tracked Apps Persistence', () => {
        it('should persist tracked apps across saves', async () => {
            const apps: TrackedApp[] = [
                { packageName: 'com.app1', appName: 'App 1', isTracked: true },
                { packageName: 'com.app2', appName: 'App 2', isTracked: false },
                { packageName: 'com.app3', appName: 'App 3', isTracked: true },
            ];

            await saveTrackedApps(apps);
            const loaded = await getTrackedApps();

            expect(loaded).toHaveLength(3);
            expect(loaded.find(a => a.packageName === 'com.app1')?.isTracked).toBe(true);
            expect(loaded.find(a => a.packageName === 'com.app2')?.isTracked).toBe(false);
        });

        it('should return empty array when no apps saved', async () => {
            const apps = await getTrackedApps();
            expect(apps).toEqual([]);
        });
    });

    describe('Time Bank Persistence', () => {
        it('should persist time bank across restarts', async () => {
            await earnTime(TimeEarningSource.SQUATS, 10);
            await spendTime(3, 'com.test.app');

            // Simulate "restart" by getting fresh time bank
            const timeBank = await getTimeBank();

            expect(timeBank.earnedMinutes).toBe(10);
            expect(timeBank.spentMinutes).toBe(3);
        });

        it('should create default time bank if none exists', async () => {
            const timeBank = await getTimeBank();

            expect(timeBank.earnedMinutes).toBe(0);
            expect(timeBank.spentMinutes).toBe(0);
            expect(timeBank.creditMinutes).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero amounts gracefully', async () => {
            await earnTime(TimeEarningSource.SQUATS, 0);
            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(0);
        });

        it('should handle negative amounts as zero', async () => {
            await earnTime(TimeEarningSource.SQUATS, -5);
            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(0);
        });

        it('should round down partial minutes from steps', async () => {
            await earnTime(TimeEarningSource.STEPS, 250);
            const timeBank = await getTimeBank();
            expect(timeBank.earnedMinutes).toBe(2); // 250/100 = 2.5 -> 2
        });
    });
});
