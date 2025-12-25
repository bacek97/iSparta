import { LeaderboardCalculator } from '../utils/LeaderboardCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('LeaderboardCalculator Integration Tests', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    afterEach(async () => {
        await AsyncStorage.clear();
    });

    describe('calculateStats', () => {
        it('should return empty stats when no sessions exist', async () => {
            const stats = await LeaderboardCalculator.calculateStats();

            expect(stats.totalWorkouts).toBe(0);
            expect(stats.totalWorkoutTime).toBe(0);
            expect(stats.totalPoints).toBe(0);
            expect(stats.exerciseLeaderboard).toEqual([]);
            expect(stats.last7DaysSessions).toEqual([]);
            expect(stats.olderWeeks).toEqual([]);
        });

        it('should calculate stats for single session', async () => {
            const mockSession = {
                signature: 'test-sig-1',
                startTime: new Date().toISOString(),
                exercises: {
                    PUSHUPS: { duration: 60, reps: 20 },
                    SQUATS: { duration: 90, reps: 30 }
                }
            };

            await AsyncStorage.setItem('session_test1', JSON.stringify(mockSession));

            const stats = await LeaderboardCalculator.calculateStats();

            expect(stats.totalWorkouts).toBe(1);
            expect(stats.totalWorkoutTime).toBe(150); // 60 + 90
            expect(stats.exerciseLeaderboard.length).toBeGreaterThan(0);
        });

        it('should separate last 7 days and older sessions', async () => {
            const now = new Date();
            const recent = new Date(now);
            recent.setDate(now.getDate() - 3);

            const old = new Date(now);
            old.setDate(now.getDate() - 10);

            const recentSession = {
                signature: 'recent-1',
                startTime: recent.toISOString(),
                exercises: { PUSHUPS: { duration: 60, reps: 10 } }
            };

            const oldSession = {
                signature: 'old-1',
                startTime: old.toISOString(),
                exercises: { SQUATS: { duration: 90, reps: 15 } }
            };

            await AsyncStorage.setItem('session_recent', JSON.stringify(recentSession));
            await AsyncStorage.setItem('session_old', JSON.stringify(oldSession));

            const stats = await LeaderboardCalculator.calculateStats();

            expect(stats.last7DaysSessions.length).toBe(1);
            expect(stats.olderWeeks.length).toBeGreaterThan(0);
        });
    });

    describe('formatDuration', () => {
        it('should format seconds only', () => {
            expect(LeaderboardCalculator.formatDuration(45)).toBe('45с');
        });

        it('should format minutes and seconds', () => {
            expect(LeaderboardCalculator.formatDuration(125)).toBe('2м 5с');
        });

        it('should format hours and minutes', () => {
            expect(LeaderboardCalculator.formatDuration(3665)).toBe('1ч 1м');
        });

        it('should handle zero', () => {
            expect(LeaderboardCalculator.formatDuration(0)).toBe('0с');
        });
    });
});
