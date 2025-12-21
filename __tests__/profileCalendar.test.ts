/**
 * Profile Calendar Tests - TDD
 * Tests for date selection and workout display by date
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Profile Calendar - Workout History', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('filterSessionsByDate', () => {
        const mockSessions: SimpleWorkoutSession[] = [
            {
                sessionId: 'session_1',
                startTime: new Date('2025-12-20T10:00:00'),
                endTime: new Date('2025-12-20T10:30:00'),
                exercises: {
                    [EXERCISES.PUSHUPS]: { duration: 120, reps: 20, direction: 0 },
                },
            },
            {
                sessionId: 'session_2',
                startTime: new Date('2025-12-20T14:00:00'),
                endTime: new Date('2025-12-20T14:30:00'),
                exercises: {
                    [EXERCISES.RUNNING]: { duration: 1800, reps: 0, direction: 0 },
                },
            },
            {
                sessionId: 'session_3',
                startTime: new Date('2025-12-19T10:00:00'),
                endTime: new Date('2025-12-19T10:30:00'),
                exercises: {
                    [EXERCISES.SQUATS]: { duration: 180, reps: 30, direction: 0 },
                },
            },
        ];

        it('should filter sessions by selected date', () => {
            const targetDate = new Date('2025-12-20');
            const filtered = filterSessionsByDate(mockSessions, targetDate);

            expect(filtered.length).toBe(2);
            expect(filtered[0].sessionId).toBe('session_1');
            expect(filtered[1].sessionId).toBe('session_2');
        });

        it('should return empty array if no sessions for date', () => {
            const targetDate = new Date('2025-12-18');
            const filtered = filterSessionsByDate(mockSessions, targetDate);

            expect(filtered.length).toBe(0);
        });
    });

    describe('getRunningKilometersForDate', () => {
        it('should sum up running kilometers for a specific date', async () => {
            const sessions: SimpleWorkoutSession[] = [
                {
                    sessionId: 'run_1',
                    startTime: new Date('2025-12-20T08:00:00'),
                    endTime: new Date('2025-12-20T08:30:00'),
                    exercises: {
                        [EXERCISES.RUNNING]: { duration: 1800, reps: 0, direction: 0, kilometers: 5.2 },
                    },
                },
                {
                    sessionId: 'run_2',
                    startTime: new Date('2025-12-20T18:00:00'),
                    endTime: new Date('2025-12-20T18:30:00'),
                    exercises: {
                        [EXERCISES.RUNNING]: { duration: 1500, reps: 0, direction: 0, kilometers: 3.5 },
                    },
                },
            ];

            const km = getRunningKilometersForDate(sessions, new Date('2025-12-20'));
            expect(km).toBe(8.7);
        });
    });

    describe('getStepsForDate', () => {
        it('should return steps stored for specific date', async () => {
            mockAsyncStorage.getItem.mockResolvedValue('5000');

            const steps = await getStepsForDate(new Date('2025-12-20'));

            expect(steps).toBe(5000);
            expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@iSparta:steps_2025-12-20');
        });

        it('should return 0 if no steps for date', async () => {
            mockAsyncStorage.getItem.mockResolvedValue(null);

            const steps = await getStepsForDate(new Date('2025-12-19'));

            expect(steps).toBe(0);
        });
    });
});

// Functions to be implemented (stubs for test compilation)
function filterSessionsByDate(sessions: SimpleWorkoutSession[], date: Date): SimpleWorkoutSession[] {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(s => {
        const sessionDate = new Date(s.startTime).toISOString().split('T')[0];
        return sessionDate === dateStr;
    });
}

function getRunningKilometersForDate(sessions: SimpleWorkoutSession[], date: Date): number {
    const filtered = filterSessionsByDate(sessions, date);
    let totalKm = 0;

    for (const session of filtered) {
        const running = session.exercises[EXERCISES.RUNNING];
        if (running && (running as any).kilometers) {
            totalKm += (running as any).kilometers;
        }
    }

    return totalKm;
}

async function getStepsForDate(date: Date): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    const key = `@iSparta:steps_${dateStr}`;
    const value = await AsyncStorage.getItem(key);
    return value ? parseInt(value, 10) : 0;
}
