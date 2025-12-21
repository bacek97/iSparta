/**
 * Tests for Running Session Persistence (TDD)
 * Write tests first → implement code → tests pass
 */

import { convertRunningToWorkout, kilometersToSteps } from '../runningSessionConverter';
import type { RunningSession } from '../runningTrackingService';
import type { SimpleWorkoutSession } from '../exerciseTrackingService';
import { EXERCISES } from '../types';

describe('Running Session Persistence (TDD)', () => {
    const mockRunningSession: RunningSession = {
        sessionId: 'run_123456',
        startTime: 1703174400000, // 2023-12-21 12:00:00
        endTime: 1703175000000,   // 2023-12-21 12:10:00 (10 min later)
        route: [
            { latitude: 52.52, longitude: 13.405, altitude: 50, timestamp: 1703174400000, accuracy: 10 },
            { latitude: 52.521, longitude: 13.406, altitude: 51, timestamp: 1703174500000, accuracy: 8 },
            { latitude: 52.522, longitude: 13.407, altitude: 52, timestamp: 1703175000000, accuracy: 12 },
        ],
        metrics: {
            distance: 0.33,      // km
            duration: 600,       // 10 minutes in seconds
            currentPace: 30.3,   // min/km
            averagePace: 30.3,
            currentSpeed: 1.98,  // km/h
            averageSpeed: 1.98,
            calories: 25,
        },
        isPaused: false,
        pausedDuration: 0,
    };

    describe('convertRunningToWorkout', () => {
        it('should convert running session to workout format', () => {
            const workout = convertRunningToWorkout(mockRunningSession);

            expect(workout.sessionId).toBe('run_123456');
            expect(workout.startTime).toEqual(new Date(1703174400000));
            expect(workout.endTime).toEqual(new Date(1703175000000));
            expect(workout.exercises[EXERCISES.RUNNING]).toBeDefined();
        });

        it('should include distance in kilometers', () => {
            const workout = convertRunningToWorkout(mockRunningSession);
            const runningExercise = workout.exercises[EXERCISES.RUNNING];

            expect(runningExercise.kilometers).toBe(0.33);
        });

        it('should include duration in seconds', () => {
            const workout = convertRunningToWorkout(mockRunningSession);
            const runningExercise = workout.exercises[EXERCISES.RUNNING];

            expect(runningExercise.duration).toBe(600);
        });

        it('should include route points', () => {
            const workout = convertRunningToWorkout(mockRunningSession);
            const runningExercise = workout.exercises[EXERCISES.RUNNING];

            expect(runningExercise.route_points).toHaveLength(3);
            expect(runningExercise.route_points?.[0].latitude).toBe(52.52);
        });

        it('should generate SVG path from route', () => {
            const workout = convertRunningToWorkout(mockRunningSession);
            const runningExercise = workout.exercises[EXERCISES.RUNNING];

            expect(runningExercise['svg:path[d]']).toBeDefined();
            expect(typeof runningExercise['svg:path[d]']).toBe('string');
            expect(runningExercise['svg:path[d]']?.length).toBeGreaterThan(0);
        });

        it('should calculate route bounds', () => {
            const workout = convertRunningToWorkout(mockRunningSession);
            const runningExercise = workout.exercises[EXERCISES.RUNNING];

            expect(runningExercise.route_bounds).toBeDefined();
            expect(runningExercise.route_bounds?.minLat).toBe(52.52);
            expect(runningExercise.route_bounds?.maxLat).toBe(52.522);
            expect(runningExercise.route_bounds?.minLon).toBe(13.405);
            expect(runningExercise.route_bounds?.maxLon).toBe(13.407);
        });

        it('should only include RUNNING exercise (no other exercises)', () => {
            const workout = convertRunningToWorkout(mockRunningSession);

            expect(Object.keys(workout.exercises)).toHaveLength(1);
            expect(workout.exercises[EXERCISES.RUNNING]).toBeDefined();
            expect(workout.exercises[EXERCISES.PUSHUPS]).toBeUndefined();
            expect(workout.exercises[EXERCISES.SQUATS]).toBeUndefined();
        });

        it('should handle empty route gracefully', () => {
            const emptySession: RunningSession = {
                ...mockRunningSession,
                route: [],
                metrics: { ...mockRunningSession.metrics, distance: 0 },
            };

            const workout = convertRunningToWorkout(emptySession);

            expect(workout.exercises[EXERCISES.RUNNING].kilometers).toBe(0);
            expect(workout.exercises[EXERCISES.RUNNING].route_points).toEqual([]);
            expect(workout.exercises[EXERCISES.RUNNING]['svg:path[d]']).toBe('');
        });
    });

    describe('kilometersToSteps', () => {
        it('should convert 1 km to approximately 1250 steps', () => {
            expect(kilometersToSteps(1)).toBe(1250);
        });

        it('should convert 0.33 km to approximately 412 steps', () => {
            const steps = kilometersToSteps(0.33);
            expect(steps).toBeCloseTo(412, 0);
        });

        it('should convert 5 km to 6250 steps', () => {
            expect(kilometersToSteps(5)).toBe(6250);
        });

        it('should handle 0 km', () => {
            expect(kilometersToSteps(0)).toBe(0);
        });

        it('should round to nearest integer', () => {
            expect(kilometersToSteps(0.5)).toBe(625);
            expect(kilometersToSteps(0.001)).toBe(1); // Should round 1.25 to 1
        });
    });
});
