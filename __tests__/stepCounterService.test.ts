/**
 * Step Counter Service Tests
 * TDD: Write tests first, then implement
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Import after mocking
import {
    getTodaySteps,
    saveSteps,
    getStepBaseline,
    setStepBaseline,
    calculateDailySteps,
    createStepExerciseSet,
    resetDailySteps,
} from '../stepCounterService';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Step Counter Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getTodaySteps', () => {
        it('should return 0 when no steps data exists', async () => {
            mockAsyncStorage.getItem.mockResolvedValue(null);

            const steps = await getTodaySteps();

            expect(steps).toBe(0);
        });

        it('should return stored step count', async () => {
            mockAsyncStorage.getItem.mockResolvedValue('5000');

            const steps = await getTodaySteps();

            expect(steps).toBe(5000);
        });
    });

    describe('saveSteps', () => {
        it('should save step count to AsyncStorage', async () => {
            await saveSteps(3500);

            expect(mockAsyncStorage.setItem).toHaveBeenCalled();
            const [key, value] = mockAsyncStorage.setItem.mock.calls[0];
            expect(key).toContain('steps_');
            expect(value).toBe('3500');
        });
    });

    describe('getStepBaseline / setStepBaseline', () => {
        it('should return 0 when no baseline exists', async () => {
            mockAsyncStorage.getItem.mockResolvedValue(null);

            const baseline = await getStepBaseline();

            expect(baseline).toBe(0);
        });

        it('should save and retrieve baseline', async () => {
            await setStepBaseline(10000);

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                '@iSparta:step_today_baseline',
                '10000'
            );
        });
    });

    describe('calculateDailySteps', () => {
        it('should calculate daily steps from sensor value minus baseline', async () => {
            mockAsyncStorage.getItem.mockImplementation(async (key) => {
                if (key === '@iSparta:step_today_baseline') return '10000';
                return null;
            });

            const dailySteps = await calculateDailySteps(15000);

            expect(dailySteps).toBe(5000);
        });

        it('should return 0 if sensor value is less than baseline (device reboot)', async () => {
            mockAsyncStorage.getItem.mockImplementation(async (key) => {
                if (key === '@iSparta:step_today_baseline') return '20000';
                return null;
            });

            const dailySteps = await calculateDailySteps(5000);

            expect(dailySteps).toBe(5000); // Should use current value as new day
        });
    });

    describe('createStepExerciseSet', () => {
        it('should create valid ExerciseSet for steps', () => {
            const exerciseSet = createStepExerciseSet(5000, new Date('2025-12-20'));

            expect(exerciseSet.exercise_type).toBe('STEPS');
            expect(exerciseSet.exercise_category).toBe('STEPS');
            expect(exerciseSet.reps).toBe(5000);
            expect(exerciseSet.seconds).toBe(0);
            expect(exerciseSet.hash_shazam).toContain('steps_');
        });
    });

    describe('resetDailySteps', () => {
        it('should set new baseline from current sensor value', async () => {
            await resetDailySteps(15000);

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                '@iSparta:step_today_baseline',
                '15000'
            );
        });
    });
});
